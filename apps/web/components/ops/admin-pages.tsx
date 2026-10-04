"use client";

import type { AdminRequestSummary } from "@zipazum/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminApi } from "@/lib/api/ops";
import { OpsShell } from "./ops-shell";
import { errorText, useOpsQuery } from "./use-ops-query";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <OpsShell kind="admin" signedIn={false}>
      <form
        className="ops-card ops-login"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await adminApi.login(password);
            router.replace("/admin");
          } catch (err) {
            setError(errorText(err));
            setBusy(false);
          }
        }}
      >
        <h1>운영자 로그인</h1>
        <label htmlFor="admin-password">비밀번호</label>
        <input id="admin-password" type="password" className="ops-input" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        {error && <p className="ops-error">{error}</p>}
        <button type="submit" className="ops-btn primary" disabled={busy || !password}>
          {busy ? "확인 중…" : "로그인"}
        </button>
      </form>
    </OpsShell>
  );
}

const AREA_LABEL: Record<AdminRequestSummary["areaStatus"], string> = {
  none: "계산 안 함",
  pending: "대기",
  running: "계산 중",
  done: "완료",
  failed: "실패",
};

export function AdminRequests() {
  const { data, isPending, error } = useOpsQuery("admin", ["requests"], adminApi.requests, { refetchInterval: 30_000 });
  return (
    <OpsShell kind="admin">
      <div className="ops-head">
        <h1>매물 요청</h1>
        <p>요청마다 추천 생활권을 보고 근처 부동산에 연락한 뒤 공인중개사에게 배정하세요.</p>
      </div>
      {isPending && <p className="ops-muted">불러오는 중…</p>}
      {error && <p className="ops-error">{errorText(error)}</p>}
      {data && data.length === 0 && <p className="ops-muted">아직 요청이 없어요.</p>}
      {data && data.length > 0 && (
        <table className="ops-table">
          <thead>
            <tr>
              <th>접수</th>
              <th>출근지 · 조건</th>
              <th>추천 생활권</th>
              <th>배정</th>
              <th>제안</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{new Date(r.submittedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td>
                  <Link href={`/admin/requests/${r.id}`} className="ops-link">
                    <b>{r.destinationLabel}</b>
                  </Link>
                  <small>{r.summary}</small>
                </td>
                <td>
                  <span className={`ops-badge area-${r.areaStatus}`}>{AREA_LABEL[r.areaStatus]}</span>
                  {r.fitZoneCount !== null && <small>{r.fitZoneCount}곳</small>}
                </td>
                <td>{r.assignmentCount ? <span className="ops-badge on">{r.assignmentCount}명</span> : <span className="ops-badge warn">미배정</span>}</td>
                <td>{r.proposalCount ? <b>{r.proposalCount}건</b> : <span className="ops-muted">-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsShell>
  );
}
