import { Injectable } from "@nestjs/common";
import type { AgentChat, ChatMessageView, ChatSender, ChatThreadSummary, UserChat } from "@zipazum/shared";
import { formatPrice, summarizeRequest } from "@zipazum/shared";
import { ApiException, notFound } from "../common/api-exception.js";
import type { Prisma } from "../generated/prisma/client.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { toHousingRequest } from "../requests/request-mapper.js";

const MESSAGE_PAGE = 200;

const threadInclude = {
  proposal: { include: { listing: { select: { id: true, title: true, images: true, transactionType: true, deposit: true, monthlyRent: true, agent: { select: { name: true } } } } } },
  messages: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.ChatThreadInclude;

type ThreadRow = Prisma.ChatThreadGetPayload<{ include: typeof threadInclude }>;

const toMessage = (m: { id: string; sender: string; body: string; createdAt: Date }): ChatMessageView => ({
  id: m.id,
  sender: m.sender as ChatSender,
  body: m.body,
  createdAt: m.createdAt.toISOString(),
});

function listingOf(l: ThreadRow["proposal"]["listing"]): ChatThreadSummary["listing"] {
  const images = (l.images as { src?: string }[] | null) ?? [];
  return { id: l.id, title: l.title, imageUrl: images[0]?.src ?? null, price: formatPrice({ transactionType: l.transactionType as "rent" | "jeonse", deposit: l.deposit, monthlyRent: l.monthlyRent }) };
}

/**
 * 고객 ↔ 공인중개사 채팅. 매물 제안(proposal) 하나에 대화 하나.
 * 고객이 처음 메시지를 보낼 때 대화가 생긴다. 실시간 연결 대신 화면이 몇 초마다 다시 읽는다.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───── 고객 ─────

  async userThreads(userId: string): Promise<ChatThreadSummary[]> {
    const rows = await this.prisma.chatThread.findMany({ where: { userId }, orderBy: { lastMessageAt: "desc" }, take: 50, include: threadInclude });
    const unread = await this.unreadCounts(rows.map((r) => ({ id: r.id, since: r.userReadAt })), "agent");
    return rows.map((r) => this.summary(r, r.proposal.listing.agent.name + " 공인중개사", unread.get(r.id) ?? 0));
  }

  /** 매물 화면에서 여는 대화. 열면 읽음으로 바뀐다 */
  async userChat(userId: string, listingId: string): Promise<UserChat> {
    const proposal = await this.myProposal(userId, listingId);
    const thread = await this.prisma.chatThread.findUnique({ where: { proposalId: proposal.id } });
    if (!thread) return { threadId: null, messages: [], counterpartReadAt: null };
    const [messages] = await Promise.all([
      this.messagesOf(thread.id),
      this.prisma.chatThread.update({ where: { id: thread.id }, data: { userReadAt: new Date() } }),
    ]);
    return { threadId: thread.id, messages, counterpartReadAt: thread.agentReadAt?.toISOString() ?? null };
  }

  async userSend(userId: string, listingId: string, body: string): Promise<UserChat> {
    const proposal = await this.myProposal(userId, listingId);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const thread = await tx.chatThread.upsert({
        where: { proposalId: proposal.id },
        create: { proposalId: proposal.id, requestId: proposal.requestId, listingId, userId, agentId: proposal.listing.agentId, lastMessageAt: now, userReadAt: now },
        update: { lastMessageAt: now, userReadAt: now },
      });
      await tx.chatMessage.create({ data: { threadId: thread.id, sender: "user", body } });
      // 유료화 지표: 처음 문의한 시각
      await tx.proposal.updateMany({ where: { id: proposal.id, inquiredAt: null }, data: { inquiredAt: now } });
    });
    return this.userChat(userId, listingId);
  }

  private async myProposal(userId: string, listingId: string) {
    const proposal = await this.prisma.proposal.findFirst({
      where: { listingId, request: { userId } },
      select: { id: true, requestId: true, listing: { select: { agentId: true } } },
    });
    if (!proposal) throw notFound();
    return proposal;
  }

  // ───── 공인중개사 ─────

  async agentThreads(agentId: string): Promise<ChatThreadSummary[]> {
    const rows = await this.prisma.chatThread.findMany({
      where: { agentId },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      include: { ...threadInclude, proposal: { include: { ...threadInclude.proposal.include, request: { select: { destinationLabel: true } } } } },
    });
    const unread = await this.unreadCounts(rows.map((r) => ({ id: r.id, since: r.agentReadAt })), "user");
    return rows.map((r) => this.summary(r, `${r.proposal.request.destinationLabel} 출근 고객`, unread.get(r.id) ?? 0));
  }

  async agentUnreadTotal(agentId: string): Promise<number> {
    const threads = await this.prisma.chatThread.findMany({ where: { agentId }, select: { id: true, agentReadAt: true } });
    const counts = await this.unreadCounts(threads.map((t) => ({ id: t.id, since: t.agentReadAt })), "user");
    return [...counts.values()].reduce((a, b) => a + b, 0);
  }

  async agentChat(agentId: string, threadId: string): Promise<AgentChat> {
    const thread = await this.prisma.chatThread.findFirst({
      where: { id: threadId, agentId },
      include: { ...threadInclude, proposal: { include: { ...threadInclude.proposal.include, request: true } } },
    });
    if (!thread) throw notFound();
    const [messages] = await Promise.all([
      this.messagesOf(thread.id),
      this.prisma.chatThread.update({ where: { id: thread.id }, data: { agentReadAt: new Date() } }),
    ]);
    const request = toHousingRequest(thread.proposal.request);
    return {
      id: thread.id,
      listing: listingOf(thread.proposal.listing),
      request: { destinationLabel: request.commuteDestination.label, summary: summarizeRequest(request) },
      messages,
      counterpartReadAt: thread.userReadAt?.toISOString() ?? null,
    };
  }

  /** 공인중개사 답장 → 고객에게 알림 */
  async agentSend(agentId: string, threadId: string, body: string): Promise<AgentChat> {
    const thread = await this.prisma.chatThread.findFirst({
      where: { id: threadId, agentId },
      include: { agent: { select: { name: true, status: true, verificationStatus: true } }, proposal: { select: { listing: { select: { title: true } } } } },
    });
    if (!thread) throw notFound();
    if (thread.agent.status !== "active") throw new ApiException(403, "forbidden", "사용이 중지된 계정이에요.");
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.chatMessage.create({ data: { threadId, sender: "agent", body } });
      await tx.chatThread.update({ where: { id: threadId }, data: { lastMessageAt: now, agentReadAt: now } });
      await this.notifications.create(
        {
          userId: thread.userId,
          type: "chat_reply",
          title: `${thread.agent.name} 중개사가 답장했어요`,
          body: `${thread.proposal.listing.title} · ${body.length > 40 ? `${body.slice(0, 40)}…` : body}`,
          link: `/messages?listing=${thread.listingId}`,
        },
        tx,
      );
    });
    return this.agentChat(agentId, threadId);
  }

  // ───── 공통 ─────

  private async messagesOf(threadId: string): Promise<ChatMessageView[]> {
    const rows = await this.prisma.chatMessage.findMany({ where: { threadId }, orderBy: { createdAt: "desc" }, take: MESSAGE_PAGE });
    return rows.reverse().map(toMessage);
  }

  /** 대화마다 since 이후에 상대(from)가 보낸 메시지 수 */
  private async unreadCounts(threads: { id: string; since: Date | null }[], from: ChatSender): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!threads.length) return map;
    const rows = await this.prisma.chatMessage.findMany({
      where: { sender: from, OR: threads.map((t) => ({ threadId: t.id, ...(t.since ? { createdAt: { gt: t.since } } : {}) })) },
      select: { threadId: true },
    });
    for (const r of rows) map.set(r.threadId, (map.get(r.threadId) ?? 0) + 1);
    return map;
  }

  private summary(row: ThreadRow, counterpart: string, unread: number): ChatThreadSummary {
    const last = row.messages[0];
    return {
      id: row.id,
      listing: listingOf(row.proposal.listing),
      counterpart,
      lastMessage: last ? toMessage(last) : null,
      unread,
      lastMessageAt: row.lastMessageAt.toISOString(),
    };
  }
}
