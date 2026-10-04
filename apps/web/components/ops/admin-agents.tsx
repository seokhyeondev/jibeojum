"use client";

import type { AgentSummary } from "@zipazum/shared";
import { adminCreateAgentSchema } from "@zipazum/shared";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api/ops";
import { OpsShell } from "./ops-shell";
import { PhotoInput } from "./photo-input";
import { errorText, useOpsQuery } from "./use-ops-query";

export function AdminAgents() {
  const { data, isPending, error } = useOpsQuery("admin", ["agents"], adminApi.agents);
  return (
    <OpsShell kind="admin">
      <div className="ops-head">
        <h1>공인중개사</h1>
        <p>공인중개사는 공인중개사 웹(/agent/signup)에서 직접 가입하거나 여기서 만들 수 있어요.</p>
      </div>
      <div className="ops-grid">
        <section className="ops-col">
          {isPending && <p className="ops-muted">불러오는 중…</p>}
          {error && <p className="ops-error">{errorText(error)}</p>}
          {data && data.length === 0 && <p className="ops-muted">아직 공인중개사가 없어요.</p>}
          {data && data.length > 0 && (
            <table className="ops-table">
              <thead>
                <tr>
                  <th>공인중개사</th>
                  <th>전화번호 · 사무소</th>
                  <th>가입</th>
                  <th>배정</th>
                  <th>상태</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <AgentRow key={a.id} agent={a} />
                ))}
              </tbody>
            </table>
          )}
        </section>
        <aside className="ops-col side">
          <CreateAgentForm />
        </aside>
      </div>
    </OpsShell>
  );
}

export function AgentAvatar({ photoUrl }: { photoUrl: string | null }) {
  return (
    <span className="ops-avatar" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL 프로필 사진 */}
      {photoUrl ? <img src={photoUrl} alt="" /> : <UserRound />}
    </span>
  );
}

const formatPhone = (phone: string | null) => (phone ? phone.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, "$1-$2-$3") : "-");

function AgentRow({ agent }: { agent: AgentSummary }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "agents"] });
  const active = agent.status === "active";
  return (
    <tr className={active ? "" : "dim"}>
      <td>
        <span className="ops-person">
          <AgentAvatar photoUrl={agent.photoUrl} />
          <span>
            <b>{agent.name}</b>
            <small>{agent.loginId}</small>
          </span>
        </span>
      </td>
      <td>
        <span className="nowrap">{agent.phone ? <a href={`tel:${agent.phone}`}>{formatPhone(agent.phone)}</a> : "-"}</span>
        {agent.address && <small>{agent.address}</small>}
      </td>
      <td>
        {agent.createdBy === "self" ? "직접 가입" : "운영자"}
        <small>{new Date(agent.createdAt).toLocaleDateString("ko-KR")}</small>
      </td>
      <td>{agent.assignmentCount}건</td>
      <td>
        <span className={`ops-badge ${active ? "on" : "warn"}`}>{active ? "활성" : "중지"}</span>
      </td>
      <td className="ops-actions">
        <button
          type="button"
          className="ops-btn ghost"
          onClick={async () => {
            if (!window.confirm(`${agent.name}님의 비밀번호를 새 임시 비밀번호로 바꿀까요?`)) return;
            try {
              const { temporaryPassword } = await adminApi.resetPassword(agent.id);
              window.prompt(`${agent.name}님에게 전달할 임시 비밀번호`, temporaryPassword);
            } catch (err) {
              toast.error(errorText(err));
            }
          }}
        >
          <KeyRound aria-hidden /> 비밀번호
        </button>
        <button
          type="button"
          className="ops-btn ghost"
          onClick={async () => {
            try {
              await adminApi.setStatus(agent.id, active ? "inactive" : "active");
              await refresh();
            } catch (err) {
              toast.error(errorText(err));
            }
          }}
        >
          {active ? "중지" : "다시 활성"}
        </button>
      </td>
    </tr>
  );
}

const EMPTY = { loginId: "", name: "", phone: "", address: "", password: "", photoUrl: null as string | null };

function CreateAgentForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ loginId: string; password: string | null } | null>(null);
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <form
      className="ops-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = adminCreateAgentSchema.safeParse({ ...form, password: form.password || null });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "입력을 확인해주세요");
          return;
        }
        setBusy(true);
        setError(null);
        try {
          const { agent, temporaryPassword } = await adminApi.createAgent(parsed.data);
          setCreated({ loginId: agent.loginId, password: temporaryPassword });
          setForm(EMPTY);
          await queryClient.invalidateQueries({ queryKey: ["admin", "agents"] });
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>공인중개사 만들기</h2>
      <PhotoInput value={form.photoUrl} onChange={(photoUrl) => set({ photoUrl })} />
      <label htmlFor="new-agent-id">아이디</label>
      <input id="new-agent-id" className="ops-input" value={form.loginId} onChange={(e) => set({ loginId: e.target.value })} placeholder="영문 소문자·숫자 4~20자" autoComplete="off" />
      <label htmlFor="new-agent-name">이름</label>
      <input id="new-agent-name" className="ops-input" value={form.name} onChange={(e) => set({ name: e.target.value })} />
      <label htmlFor="new-agent-phone">전화번호</label>
      <input id="new-agent-phone" className="ops-input" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="010-1234-5678" />
      <label htmlFor="new-agent-address">사무소 주소</label>
      <input id="new-agent-address" className="ops-input" value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="예) 서울 강남구 테헤란로 123 1층" />
      <label htmlFor="new-agent-password">비밀번호 (선택)</label>
      <input
        id="new-agent-password"
        className="ops-input"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={(e) => set({ password: e.target.value })}
        placeholder="비우면 임시 비밀번호를 만들어요"
      />
      {error && <p className="ops-error">{error}</p>}
      <button type="submit" className="ops-btn primary" disabled={busy}>
        {busy ? "만드는 중…" : "만들기"}
      </button>
      {created && (
        <p className="ops-done" role="status">
          <b>{created.loginId}</b> 계정을 만들었어요.
          {created.password && (
            <>
              {" "}
              임시 비밀번호 <code>{created.password}</code> 를 공인중개사에게 전달하세요. 이 화면을 벗어나면 다시 볼 수 없어요.
            </>
          )}
        </p>
      )}
    </form>
  );
}
