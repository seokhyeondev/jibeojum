import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { SessionUser } from "../session/session.service.js";
import { appleConfigFromEnv, openToken, revokeApple, sealToken } from "./apple.js";

/** 소셜 로그인으로 확인한 사용자 */
export interface SocialIdentity {
  provider: "kakao" | "apple";
  id: string;
  nickname: string | null;
  profileImageUrl: string | null;
  /** Apple만: 탈퇴할 때 연결 해제에 쓰는 refresh token */
  appleRefreshToken?: string | null;
}

const idField = (provider: SocialIdentity["provider"]) => (provider === "kakao" ? "kakaoId" : "appleSub");

/**
 * 소셜 로그인 결과를 사용자에 붙인다.
 * - 처음 로그인: 이 브라우저의 예전 익명 사용자가 있으면 거기에 붙인다 (요청·알림이 그대로 이어진다)
 * - 이미 가입한 계정: 그 사용자로 로그인하고, 익명 사용자에게 있던 요청·알림을 옮겨온다
 */
@Injectable()
export class UserAuthService {
  private readonly logger = new Logger("Auth");

  constructor(private readonly prisma: PrismaService) {}

  async login(current: SessionUser | null, identity: SocialIdentity): Promise<string> {
    const field = idField(identity.provider);
    const profile = {
      ...(identity.nickname !== null ? { nickname: identity.nickname } : {}),
      ...(identity.profileImageUrl !== null ? { profileImageUrl: identity.profileImageUrl } : {}),
      ...(identity.appleRefreshToken ? { appleRefreshToken: sealToken(identity.appleRefreshToken) } : {}),
    };
    const anonymous = current && !current.kakaoId && !current.appleSub ? current : null;
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({ where: { [field]: identity.id } as { kakaoId: string }, select: { id: true } });
      if (owner) {
        await tx.user.update({ where: { id: owner.id }, data: profile });
        if (anonymous && anonymous.id !== owner.id) {
          await tx.housingRequest.updateMany({ where: { userId: anonymous.id }, data: { userId: owner.id } });
          await tx.notification.updateMany({ where: { userId: anonymous.id }, data: { userId: owner.id } });
        }
        return owner.id;
      }
      if (anonymous) {
        await tx.user.update({ where: { id: anonymous.id }, data: { [field]: identity.id, ...profile } });
        return anonymous.id;
      }
      const created = await tx.user.create({ data: { [field]: identity.id, ...profile }, select: { id: true } });
      return created.id;
    });
  }

  /**
   * 회원탈퇴: 요청(제안·대화·배정 포함)과 알림·신고·세션을 지우고 사용자를 지운다.
   * 카카오·Apple 쪽 연결도 끊는다 (실패해도 우리 쪽 삭제는 끝낸다).
   */
  async withdraw(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { kakaoId: true, appleRefreshToken: true } });
    if (!user) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.housingRequest.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
    const adminKey = process.env.KAKAO_ADMIN_KEY;
    if (user.kakaoId && adminKey) {
      await fetch("https://kapi.kakao.com/v1/user/unlink", {
        method: "POST",
        headers: { Authorization: `KakaoAK ${adminKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ target_id_type: "user_id", target_id: user.kakaoId }),
        signal: AbortSignal.timeout(10_000),
      }).catch((err: unknown) => this.logger.warn(`kakao unlink failed: ${err instanceof Error ? err.message : err}`));
    }
    const apple = appleConfigFromEnv();
    const refresh = user.appleRefreshToken ? openToken(user.appleRefreshToken) : null;
    if (apple && refresh) {
      await revokeApple(apple, refresh).catch((err: unknown) => this.logger.warn(`apple revoke failed: ${err instanceof Error ? err.message : err}`));
    }
  }
}
