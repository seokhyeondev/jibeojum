import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { SessionUser } from "../session/session.service.js";
import type { KakaoProfile } from "./kakao.js";

/**
 * 카카오 로그인 결과를 사용자에 붙인다.
 * - 처음 로그인: 지금 브라우저의 익명 사용자에 카카오 계정을 붙인다 (요청·알림이 그대로 이어진다)
 * - 이미 가입한 카카오 계정: 그 사용자로 로그인하고, 이 브라우저에서 로그인 전에 만든 요청·알림을 옮겨온다
 */
@Injectable()
export class UserAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async loginWithKakao(current: SessionUser | null, profile: KakaoProfile): Promise<string> {
    const profileData = { nickname: profile.nickname, profileImageUrl: profile.profileImageUrl };
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({ where: { kakaoId: profile.id }, select: { id: true } });
      if (owner) {
        await tx.user.update({ where: { id: owner.id }, data: profileData });
        // 다른 카카오 계정에 붙지 않은 익명 사용자의 것만 옮긴다
        if (current && current.id !== owner.id && !current.kakaoId) {
          await tx.housingRequest.updateMany({ where: { userId: current.id }, data: { userId: owner.id } });
          await tx.notification.updateMany({ where: { userId: current.id }, data: { userId: owner.id } });
        }
        return owner.id;
      }
      if (current && !current.kakaoId) {
        await tx.user.update({ where: { id: current.id }, data: { kakaoId: profile.id, ...profileData } });
        return current.id;
      }
      const created = await tx.user.create({ data: { kakaoId: profile.id, ...profileData }, select: { id: true } });
      return created.id;
    });
  }
}
