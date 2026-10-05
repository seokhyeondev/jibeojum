"use client";

import { LISTING_REPORT_LABEL, REPORT_SUSPEND_THRESHOLD } from "@zipazum/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api/ops";
import { OpsShell } from "./ops-shell";
import { errorText, useOpsQuery } from "./use-ops-query";

const STATUS_LABEL = { open: "확인 전", confirmed: "확인됨", rejected: "반려" } as const;

/** 사용자 매물 신고. 확인하면 그 매물은 "거래 완료"로 내려가고 공인중개사 신고 횟수에 쌓인다 */
export function AdminReports() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const { data, isPending, error } = useOpsQuery("admin", ["reports", filter], () => adminApi.reports(filter));
  const review = async (id: string, status: "confirmed" | "rejected") => {
    try {
      await adminApi.reviewReport(id, status);
      toast(status === "confirmed" ? "확인했어요. 매물을 내렸어요." : "반려했어요.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "agents"] });
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <OpsShell kind="admin">
      <div className="ops-head">
        <h1>매물 신고</h1>
        <p>
          사실이면 &ldquo;맞아요&rdquo;를 눌러 매물을 내리세요. 확인된 신고가 {REPORT_SUSPEND_THRESHOLD}회 쌓인 공인중개사는 정지를 검토하세요.
        </p>
      </div>
      <div className="ops-filter" role="radiogroup" aria-label="보기">
        {(["open", "all"] as const).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={filter === f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
            {f === "open" ? "확인 전" : "전체"}
          </button>
        ))}
      </div>
      {isPending && <p className="ops-muted">불러오는 중…</p>}
      {error && <p className="ops-error">{errorText(error)}</p>}
      {data && data.length === 0 && <p className="ops-muted">{filter === "open" ? "확인할 신고가 없어요." : "신고가 없어요."}</p>}
      {data && data.length > 0 && (
        <table className="ops-table">
          <thead>
            <tr>
              <th>신고</th>
              <th>매물 · 공인중개사</th>
              <th>내용</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{new Date(r.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td>
                  <b>{r.listingTitle}</b>
                  <small>
                    {r.agent.name}
                    {r.agentConfirmedCount > 0 && (
                      <span className={`ops-badge ${r.agentConfirmedCount >= REPORT_SUSPEND_THRESHOLD ? "danger" : "warn"}`}>확인된 신고 {r.agentConfirmedCount}회</span>
                    )}
                  </small>
                </td>
                <td>
                  <b>{LISTING_REPORT_LABEL[r.reason]}</b>
                  {r.note && <small>{r.note}</small>}
                </td>
                <td>
                  <span className={`ops-badge ${r.status === "confirmed" ? "warn" : r.status === "rejected" ? "" : "on"}`}>{STATUS_LABEL[r.status]}</span>
                </td>
                <td className="ops-actions">
                  {r.status === "open" && (
                    <>
                      <button type="button" className="ops-btn ghost" onClick={() => void review(r.id, "confirmed")}>
                        맞아요
                      </button>
                      <button type="button" className="ops-btn ghost" onClick={() => void review(r.id, "rejected")}>
                        반려
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsShell>
  );
}
