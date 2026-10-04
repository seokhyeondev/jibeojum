import { Injectable } from "@nestjs/common";
import type { NotificationItem } from "@zipazum/shared";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

type Db = Pick<Prisma.TransactionClient, "notification">;

export interface NewNotification {
  userId: string;
  type: "proposal_arrived" | "chat_reply";
  title: string;
  body: string;
  link: string | null;
}

/** 앱 안 알림함. 알림톡·푸시를 붙일 때도 이 행을 기준으로 보낸다 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: NewNotification, db: Db = this.prisma) {
    return db.notification.create({ data: input });
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
