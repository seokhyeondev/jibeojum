import { Injectable } from "@nestjs/common";
import type { NotificationItem } from "@zipazum/shared";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { PushService } from "../push/push.service.js";

/** 거래(transaction) 안에서 만든 알림은 커밋된 뒤에 푸시한다. 그 사이 롤백되면 행이 없으므로 보내지 않는다 */
const PUSH_DELAY_MS = 1500;

type Db = Pick<Prisma.TransactionClient, "notification">;

export interface NewNotification {
  userId: string;
  type: "proposal_arrived" | "chat_reply";
  title: string;
  body: string;
  link: string | null;
}

/** 앱 안 알림함. 앱을 쓰는 사용자에게는 같은 내용을 푸시로도 보낸다 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async create(input: NewNotification, db: Db = this.prisma) {
    const row = await db.notification.create({ data: input });
    if (this.push.enabled) {
      setTimeout(() => {
        void this.prisma.notification
          .findUnique({ where: { id: row.id }, select: { id: true } })
          .then((committed) => (committed ? this.push.sendToUser(input.userId, { title: input.title, body: input.body, link: input.link }) : undefined))
          .catch(() => undefined);
      }, PUSH_DELAY_MS);
    }
    return row;
  }

  async list(userId: string): Promise<{ items: NotificationItem[]; unreadCount: number }> {
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }
}
