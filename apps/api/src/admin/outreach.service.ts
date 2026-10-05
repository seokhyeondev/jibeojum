import { Injectable } from "@nestjs/common";
import type {
  AgentInviteLink,
  BrokerContactCreateInput,
  BrokerContactStatus,
  BrokerContactUpdateInput,
  BrokerContactView,
} from "@zipazum/shared";
import { HOUSING_TYPE_CHOICES, choiceLabel, formatManwon, wantsJeonse, wantsRent } from "@zipazum/shared";
import { randomBytes } from "node:crypto";
import { sha256 } from "../auth/signed-cookie.js";
import { notFound } from "../common/api-exception.js";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { toHousingRequest } from "../requests/request-mapper.js";

const INVITE_TTL_MS = 14 * 24 * 60 * 60_000;

const contactInclude = {
  office: { select: { name: true, address: true, phone: true } },
  invites: { orderBy: { createdAt: "desc" }, take: 1, include: { acceptedAgent: { select: { name: true } } } },
} satisfies Prisma.BrokerContactInclude;

type ContactRow = Prisma.BrokerContactGetPayload<{ include: typeof contactInclude }>;

function toContactView(row: ContactRow): BrokerContactView {
  const invite = row.invites[0];
  return {
    id: row.id,
    requestId: row.requestId,
    officeId: row.officeId,
    officeName: row.office.name,
    officeAddress: row.office.address,
    phone: row.office.phone,
    zoneKey: row.zoneKey,
    status: row.status as BrokerContactStatus,
    note: row.note,
    contactedAt: row.contactedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    invite: invite
      ? {
          createdAt: invite.createdAt.toISOString(),
          expiresAt: invite.expiresAt.toISOString(),
          acceptedAt: invite.acceptedAt?.toISOString() ?? null,
          agentName: invite.acceptedAgent?.name ?? null,
        }
      : null,
  };
}

/** 초대 링크 토큰은 원문을 링크에만 두고 DB에는 해시를 둔다 */
export const inviteTokenHash = (token: string) => sha256(`invite:${token}`);

/**
 * 운영팀의 부동산 영업 기록.
 * 부동산(broker_offices)은 처음 연락할 때 우리 목록에 쌓이고, 요청마다 연락 결과(broker_contacts)를 남긴다.
 */
@Injectable()
export class OutreachService {
  constructor(private readonly prisma: PrismaService) {}

  async contactsFor(requestId: string): Promise<BrokerContactView[]> {
    const rows = await this.prisma.brokerContact.findMany({ where: { requestId }, orderBy: { contactedAt: "desc" }, include: contactInclude });
    return rows.map(toContactView);
  }

  /** 연락 기록을 남긴다. 처음 보는 부동산이면 우리 목록에 먼저 넣는다. 이미 기록이 있으면 상태·메모를 고친다 */
  async record(requestId: string, input: BrokerContactCreateInput): Promise<BrokerContactView[]> {
    const request = await this.prisma.housingRequest.findUnique({ where: { id: requestId }, select: { id: true } });
    if (!request) throw notFound();
    let officeId = input.officeId;
    if (!officeId && input.office) {
      const { name, address, phone, link, latitude, longitude } = input.office;
      const office = await this.prisma.brokerOffice.upsert({
        where: { name_address: { name, address } },
        create: { name, address, phone, link, latitude, longitude, source: "naver" },
        // 운영자가 적은 전화번호는 네이버 값으로 덮지 않는다
        update: { link: link ?? undefined, latitude: latitude ?? undefined, longitude: longitude ?? undefined },
      });
      officeId = office.id;
    }
    if (!officeId) throw notFound();
    await this.prisma.brokerContact.upsert({
      where: { requestId_officeId: { requestId, officeId } },
      create: { requestId, officeId, zoneKey: input.zoneKey, status: input.status, note: input.note },
      update: { status: input.status, note: input.note ?? undefined, zoneKey: input.zoneKey ?? undefined },
    });
    return this.contactsFor(requestId);
  }

  async update(contactId: string, input: BrokerContactUpdateInput): Promise<BrokerContactView[]> {
    const contact = await this.prisma.brokerContact.findUnique({ where: { id: contactId }, select: { requestId: true, officeId: true } });
    if (!contact) throw notFound();
    await this.prisma.$transaction(async (tx) => {
      if (input.status !== undefined || input.note !== undefined) {
        await tx.brokerContact.update({ where: { id: contactId }, data: { status: input.status, note: input.note } });
      }
      if (input.phone !== undefined) await tx.brokerOffice.update({ where: { id: contact.officeId }, data: { phone: input.phone } });
    });
    return this.contactsFor(contact.requestId);
  }

  async remove(contactId: string): Promise<BrokerContactView[]> {
    const contact = await this.prisma.brokerContact.findUnique({ where: { id: contactId }, select: { requestId: true } });
    if (!contact) throw notFound();
    await this.prisma.brokerContact.delete({ where: { id: contactId } });
    return this.contactsFor(contact.requestId);
  }

  /** 이 부동산에 보낼 초대 링크와 문구. 링크로 가입·로그인하면 이 요청(생활권)이 배정된다 */
  async createInvite(contactId: string): Promise<AgentInviteLink> {
    const contact = await this.prisma.brokerContact.findUnique({ where: { id: contactId }, include: { request: true } });
    if (!contact) throw notFound();
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const zoneKeys = contact.zoneKey ? [contact.zoneKey] : [];
    await this.prisma.agentInvite.create({
      data: { tokenHash: inviteTokenHash(token), requestId: contact.requestId, officeId: contact.officeId, contactId, zoneKeys, expiresAt },
    });
    const zone = contact.zoneKey ? await this.prisma.commuteZone.findUnique({ where: { zoneKey: contact.zoneKey }, select: { name: true } }) : null;
    // 공인중개사 웹은 사용자 웹과 따로 배포한다 (OPS_ORIGIN)
    const url = `${(process.env.OPS_ORIGIN ?? "https://partner.zipazum.com").replace(/\/$/, "")}/agent/invite/${token}`;
    return { url, message: inviteMessage(toHousingRequest(contact.request), zone?.name ?? null, url), expiresAt: expiresAt.toISOString() };
  }
}

/** 부동산에 보낼 문자·카톡 문구. 사용자 개인정보(이름·연락처)는 넣지 않는다 */
export function inviteMessage(request: ReturnType<typeof toHousingRequest>, zoneName: string | null, url: string): string {
  const budget = [
    wantsRent(request.transactionPreference) ? `보증금 ${formatManwon(request.depositMax ?? 0)} · 월세 ${formatManwon(request.monthlyRentMax ?? 0)} 이하` : null,
    wantsJeonse(request.transactionPreference) ? `전세 ${formatManwon(request.jeonseMax ?? 0)} 이하` : null,
  ]
    .filter(Boolean)
    .join(" 또는 ");
  const types = request.housingTypes.map((t) => choiceLabel(HOUSING_TYPE_CHOICES, t)).join("·") + (request.minPyeong ? ` (${request.minPyeong}평 이상)` : "");
  const where = zoneName ? `${zoneName.split(" · ")[0]} 근처` : "출근 1시간 이내";
  return [
    "안녕하세요, 집어줌입니다.",
    `${request.commuteDestination.label} 출근하시는 분이 ${where}에서 ${types} 매물을 찾고 있어요.`,
    `· ${budget}`,
    `· ${request.moveInDate} 입주 희망`,
    "조건에 맞는 매물이 있으시면 아래 링크에서 요청을 확인하고 매물을 올려주실 수 있을까요? (가입 1분)",
    url,
  ].join("\n");
}
