import { Injectable, Logger } from "@nestjs/common";
import { createSign } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";

// 앱 푸시 알림 (Firebase Cloud Messaging HTTP v1). iOS도 FCM을 거쳐 APNs로 간다.
// FIREBASE_SERVICE_ACCOUNT(서비스 계정 JSON)가 없으면 보내지 않는다 (앱 안 알림함은 그대로 쌓인다).

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** 누르면 열 앱 안 경로 (/listings/…, /messages?listing=…) */
  link: string | null;
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    return parsed.project_id && parsed.client_email && parsed.private_key ? { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") } : null;
  } catch {
    return null;
  }
}

@Injectable()
export class PushService {
  private readonly logger = new Logger("Push");
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  get enabled() {
    return serviceAccount() !== null;
  }

  async register(userId: string, token: string, platform: "ios" | "android") {
    await this.prisma.pushDevice.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, lastSeenAt: new Date() },
    });
  }

  async unregister(userId: string, token: string) {
    await this.prisma.pushDevice.deleteMany({ where: { token, userId } });
  }

  /** 사용자의 모든 기기로 보낸다. 실패해도 예외를 던지지 않는다 */
  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    const account = serviceAccount();
    if (!account) return;
    const devices = await this.prisma.pushDevice.findMany({ where: { userId }, select: { token: true } });
    if (!devices.length) return;
    try {
      const token = await this.oauthToken(account);
      await Promise.all(devices.map((d) => this.sendOne(account, token, d.token, message)));
    } catch (err) {
      this.logger.warn(`push failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async sendOne(account: ServiceAccount, accessToken: string, deviceToken: string, message: PushMessage) {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title: message.title, body: message.body },
          data: message.link ? { link: message.link } : {},
          android: { priority: "high", notification: { channel_id: "default" } },
          apns: { payload: { aps: { sound: "default" } } },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return;
    const body = await response.text();
    // 앱을 지웠거나 토큰이 바뀐 기기는 지운다
    if (response.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(body)) {
      await this.prisma.pushDevice.deleteMany({ where: { token: deviceToken } });
      return;
    }
    this.logger.warn(`fcm ${response.status}: ${body.slice(0, 200)}`);
  }

  /** 서비스 계정으로 FCM 접근 토큰을 받는다 (50분 캐시) */
  private async oauthToken(account: ServiceAccount): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now()) return this.accessToken.value;
    const now = Math.floor(Date.now() / 1000);
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })}`;
    const assertion = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(account.private_key).toString("base64url")}`;
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token) throw new Error(`google oauth: HTTP ${response.status}`);
    this.accessToken = { value: body.access_token, expiresAt: Date.now() + 50 * 60_000 };
    return body.access_token;
  }
}
