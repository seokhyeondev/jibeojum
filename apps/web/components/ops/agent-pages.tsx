"use client";

import { agentSignupSchema } from "@zipazum/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { agentApi } from "@/lib/api/ops";
import { AgentAvatar } from "./admin-agents";
import { OpsShell } from "./ops-shell";
import { PhotoInput } from "./photo-input";
import { errorText, useOpsQuery } from "./use-ops-query";

export function AgentLogin() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <OpsShell kind="agent" signedIn={false}>
      <form
        className="ops-card ops-login"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await agentApi.login(loginId, password);
            router.replace("/agent");
          } catch (err) {
            setError(errorText(err));
            setBusy(false);
          }
        }}
      >
        <h1>공인중개사 로그인</h1>
        <label htmlFor="agent-id">아이디</label>
        <input id="agent-id" className="ops-input" autoComplete="username" value={loginId} onChange={(e) => setLoginId(e.target.value)} autoFocus />
        <label htmlFor="agent-password">비밀번호</label>
        <input id="agent-password" type="password" className="ops-input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="ops-error">{error}</p>}
        <button type="submit" className="ops-btn primary" disabled={busy || !loginId || !password}>
          {busy ? "확인 중…" : "로그인"}
        </button>
        <p className="ops-muted">
          처음이신가요? <Link href="/agent/signup">가입하기</Link>
        </p>
      </form>
    </OpsShell>
  );
}

export function AgentSignup() {
  const router = useRouter();
  const [form, setForm] = useState({ loginId: "", password: "", passwordCheck: "", name: "", phone: "", address: "", photoUrl: null as string | null });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <OpsShell kind="agent" signedIn={false}>
      <form
        className="ops-card ops-login"
        onSubmit={async (e) => {
          e.preventDefault();
          if (form.password !== form.passwordCheck) {
            setError("비밀번호가 서로 달라요");
            return;
          }
          const parsed = agentSignupSchema.safeParse(form);
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "입력을 확인해주세요");
            return;
          }
          setBusy(true);
          setError(null);
          try {
            await agentApi.signup(parsed.data);
            router.replace("/agent");
          } catch (err) {
            setError(errorText(err));
            setBusy(false);
          }
        }}
      >
        <h1>공인중개사 가입</h1>
        <p className="ops-muted">가입하면 집어줌 운영팀이 고객 요청을 배정해드려요.</p>
        <PhotoInput value={form.photoUrl} onChange={(photoUrl) => set({ photoUrl })} />
        <label htmlFor="signup-id">아이디</label>
        <input id="signup-id" className="ops-input" autoComplete="username" value={form.loginId} onChange={(e) => set({ loginId: e.target.value })} placeholder="영문 소문자·숫자 4~20자" />
        <label htmlFor="signup-password">비밀번호</label>
        <input id="signup-password" type="password" className="ops-input" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} placeholder="8자 이상" />
        <label htmlFor="signup-password2">비밀번호 확인</label>
        <input id="signup-password2" type="password" className="ops-input" autoComplete="new-password" value={form.passwordCheck} onChange={(e) => set({ passwordCheck: e.target.value })} />
        <label htmlFor="signup-name">이름</label>
        <input id="signup-name" className="ops-input" autoComplete="name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
        <label htmlFor="signup-phone">전화번호</label>
        <input id="signup-phone" className="ops-input" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="010-1234-5678" />
        <label htmlFor="signup-address">사무소 주소</label>
        <input id="signup-address" className="ops-input" autoComplete="street-address" value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="예) 서울 강남구 테헤란로 123 1층" />
        {error && <p className="ops-error">{error}</p>}
        <button type="submit" className="ops-btn primary" disabled={busy}>
          {busy ? "가입 중…" : "가입하기"}
        </button>
        <p className="ops-muted">
          이미 계정이 있나요? <Link href="/agent/login">로그인</Link>
        </p>
      </form>
    </OpsShell>
  );
}

export function AgentAssignments() {
  const me = useOpsQuery("agent", ["me"], agentApi.me);
  const { data, isPending, error } = useOpsQuery("agent", ["assignments"], agentApi.assignments, { refetchInterval: 60_000 });
  return (
    <OpsShell kind="agent">
      <div className="ops-head">
        {me.data && (
          <span className="ops-person">
            <AgentAvatar photoUrl={me.data.photoUrl} />
            <span>
              <b>{me.data.name}님</b>
              <small>{me.data.loginId}</small>
            </span>
          </span>
        )}
        <h1>배정된 요청</h1>
        <p>요청 조건과 생활권을 보고 맞는 매물을 올려주세요. 올리면 고객에게 바로 알림이 가요.</p>
      </div>
      {isPending && <p className="ops-muted">불러오는 중…</p>}
      {error && <p className="ops-error">{errorText(error)}</p>}
      {data && data.length === 0 && <p className="ops-muted">아직 배정된 요청이 없어요.</p>}
      <ul className="ops-cards">
        {data?.map((a) => (
          <li key={a.id}>
            <Link href={`/agent/assignments/${a.id}`} className="ops-card ops-tap">
              <span className={`ops-badge ${a.proposalCount ? "on" : "warn"}`}>{a.proposalCount ? `매물 ${a.proposalCount}건 올림` : "새 요청"}</span>
              <h2>{a.destinationLabel} 출근</h2>
              <p>{a.summary}</p>
              {a.zoneNames.length > 0 && <small>생활권: {a.zoneNames.join(", ")}</small>}
              <small>{new Date(a.createdAt).toLocaleString("ko-KR")} 배정</small>
            </Link>
          </li>
        ))}
      </ul>
    </OpsShell>
  );
}
