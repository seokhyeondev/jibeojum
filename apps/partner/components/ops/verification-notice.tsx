"use client";

import type { AgentSummary } from "@zipazum/shared";
import { agentLicenseSchema } from "@zipazum/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { agentApi } from "@/lib/api/ops";
import { LicenseInput } from "./license-input";
import { errorText } from "./use-ops-query";

/** 등록증 확인 전·반려 안내. 승인된 계정이면 아무것도 그리지 않는다 */
export function VerificationNotice({ agent }: { agent: AgentSummary }) {
  if (agent.verificationStatus === "verified") return null;
  if (agent.verificationStatus === "pending") {
    return (
      <div className="ops-verify pending">
        <ShieldCheck aria-hidden />
        <span>
          <b>운영팀이 중개사무소 등록증을 확인하고 있어요</b>
          <small>확인되면 매물을 올릴 수 있어요. 그동안 배정된 요청은 미리 볼 수 있어요.</small>
        </span>
      </div>
    );
  }
  return <Resubmit agent={agent} />;
}

function Resubmit({ agent }: { agent: AgentSummary }) {
  const queryClient = useQueryClient();
  const [registrationNo, setRegistrationNo] = useState(agent.registrationNo ?? "");
  const [licenseImageKey, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="ops-verify rejected">
      <ShieldAlert aria-hidden />
      <span>
        <b>등록증을 다시 올려주세요</b>
        <small>{agent.rejectReason ? `운영팀 메모: ${agent.rejectReason}` : "확인이 어려웠어요."}</small>
        <div className="ops-verify-form">
          <input className="ops-input" aria-label="중개사무소 등록번호" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} placeholder="중개사무소 등록번호" />
          <LicenseInput value={licenseImageKey} onChange={setKey} />
          <button
            type="button"
            className="ops-btn primary"
            disabled={busy}
            onClick={async () => {
              const parsed = agentLicenseSchema.safeParse({ registrationNo, licenseImageKey });
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "입력을 확인해주세요");
                return;
              }
              setBusy(true);
              try {
                await agentApi.resubmitLicense(parsed.data);
                toast("다시 보냈어요. 확인되면 매물을 올릴 수 있어요.");
                await queryClient.invalidateQueries({ queryKey: ["agent", "me"] });
              } catch (err) {
                toast.error(errorText(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            다시 보내기
          </button>
        </div>
      </span>
    </div>
  );
}
