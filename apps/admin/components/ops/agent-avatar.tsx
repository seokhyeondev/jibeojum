import { UserRound } from "lucide-react";

/** 공인중개사 프로필 사진 (없으면 기본 아이콘) */
export function AgentAvatar({ photoUrl }: { photoUrl: string | null }) {
  return (
    <span className="ops-avatar" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- 프로필 사진 */}
      {photoUrl ? <img src={photoUrl} alt="" /> : <UserRound />}
    </span>
  );
}
