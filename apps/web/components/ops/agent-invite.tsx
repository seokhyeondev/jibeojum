"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { agentApi } from "@/lib/api/ops";
import { OpsShell } from "./ops-shell";
import { errorText } from "./use-ops-query";

/** 운영팀이 보낸 초대 링크. 요청을 보여주고 가입·로그인으로 이어준다 (로그인돼 있으면 바로 받기) */
export function AgentInvitePage({ token }: { token: string }) {
  const router = useRouter();
  const invite = useQuery({ queryKey: ["agent", "invite", token], queryFn: () => agentApi.invite(token), retry: false });
  const me = useQuery({ queryKey: ["agent", "me"], queryFn: agentApi.me, retry: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = invite.data;
  const blocked = preview && (preview.expired || preview.closed || (preview.accepted && !me.data));

  return (
    <OpsShell kind="agent" signedIn={Boolean(me.data)}>
      <div className="ops-card ops-login ops-invite-page">
        {invite.isPending && <p className="ops-muted">불러오는 중…</p>}
        {invite.error && <p className="ops-error">{errorText(invite.error)}</p>}
        {preview && (
          <>
            <span className="ops-eyebrow">집어줌 매물 요청</span>
            <h1>{preview.destinationLabel} 출근하시는 분이 집을 찾고 있어요</h1>
            {preview.zoneNames.length > 0 && (
              <p className="ops-muted">
                <MapPin aria-hidden /> {preview.zoneNames.join(", ")} 근처
              </p>
            )}
            <p>{preview.summary}</p>
            <div className="ops-chips">
              {preview.conditions.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            {preview.officeName && <p className="ops-muted">{preview.officeName} 앞으로 보낸 링크예요.</p>}

            {blocked ? (
              <p className="ops-warn">
                {preview.closed
                  ? "고객이 요청을 취소했어요."
                  : preview.expired
                    ? "링크 기간이 지났어요. 집어줌 운영팀에 새 링크를 요청해주세요."
                    : "이미 다른 계정으로 받은 링크예요. 그 계정으로 로그인해주세요."}
              </p>
            ) : me.data ? (
              <>
                <button
                  type="button"
                  className="ops-btn primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const { assignmentId } = await agentApi.acceptInvite(token);
                      router.replace(`/agent/assignments/${assignmentId}`);
                    } catch (err) {
                      setError(errorText(err));
                      setBusy(false);
                    }
                  }}
                >
                  {me.data.name}님으로 이 요청 받고 매물 올리기
                </button>
                {error && <p className="ops-error">{error}</p>}
              </>
            ) : (
              <>
                <Link href={`/agent/signup?invite=${token}`} className="ops-btn primary">
                  가입하고 매물 올리기 (1분)
                </Link>
                <Link href={`/agent/login?invite=${token}`} className="ops-btn ghost">
                  이미 계정이 있어요
                </Link>
                <small className="ops-muted">가입은 무료예요. 조건에 맞는 매물을 올리면 고객에게 바로 전달돼요.</small>
              </>
            )}
          </>
        )}
      </div>
    </OpsShell>
  );
}
