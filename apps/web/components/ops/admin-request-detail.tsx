"use client";

import type { AdminRequestDetail, AgentSummary, AreaRecommendation, AssignmentSummary } from "@zipazum/shared";
import { HOUSING_TYPE_CHOICES, choiceLabel, formatManwon, requestConditionLabels, summarizeRequest } from "@zipazum/shared";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin, RefreshCw, Search, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api/ops";
import { OpsShell } from "./ops-shell";
import { BrokerPanel, OutreachCard } from "./outreach";
import { errorText, useOpsQuery } from "./use-ops-query";

const money = (v: number | null) => (v === null ? "-" : formatManwon(v));

export function AdminRequestDetailPage({ id }: { id: string }) {
  const { data, isPending, error, refetch } = useOpsQuery("admin", ["request", id], () => adminApi.request(id), { refetchInterval: 15_000 });
  return (
    <OpsShell kind="admin">
      <Link href="/admin" className="ops-back">
        ← 요청 목록
      </Link>
      {isPending && <p className="ops-muted">불러오는 중…</p>}
      {error && <p className="ops-error">{errorText(error)}</p>}
      {data && <Detail detail={data} onChanged={() => void refetch()} />}
    </OpsShell>
  );
}

function Detail({ detail, onChanged }: { detail: AdminRequestDetail; onChanged: () => void }) {
  const { request, area } = detail;
  // 다시 계산하는 동안에는 이전 조건으로 구한 목록을 보여주지 않는다
  const areas = area.status === "done" ? (area.result?.areas ?? []) : [];
  const { data: agents = [] } = useOpsQuery("admin", ["agents"], adminApi.agents);
  const assignedZones = new Set(detail.assignments.flatMap((a) => a.zoneKeys)).size;

  return (
    <div className="ops-grid">
      <section className="ops-col">
        <div className="ops-card">
          <span className="ops-eyebrow">요청</span>
          <h1>
            {request.commuteDestination.label} 출근 <small>{new Date(request.submittedAt).toLocaleString("ko-KR")}</small>
          </h1>
          {request.commuteDestination.address && (
            <p className="ops-muted">
              <MapPin aria-hidden /> {request.commuteDestination.address}
            </p>
          )}
          <p>{summarizeRequest(request)}</p>
          <div className="ops-chips">
            {requestConditionLabels(request).map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <p className="ops-muted">입주 {request.moveInDate}</p>
        </div>

        <div className="ops-card">
          <div className="ops-card-head">
            <h2>추천 생활권 {areas.length > 0 && <small>{areas.length}곳 · 배정한 곳 {assignedZones}</small>}</h2>
            <button
              type="button"
              className="ops-btn ghost"
              onClick={async () => {
                await adminApi.recompute(request.id);
                toast("다시 계산을 시작했어요. 잠시 뒤 새로고침돼요.");
                onChanged();
              }}
            >
              <RefreshCw aria-hidden /> 다시 계산
            </button>
          </div>
          {area.status !== "done" && <p className="ops-muted">{area.status === "failed" ? `계산 실패: ${area.error}` : "추천 생활권을 계산하고 있어요…"}</p>}
          {area.status === "done" && area.result?.warnings.map((w) => (
            <p key={w} className="ops-warn">
              {w}
            </p>
          ))}
          {areas.length > 0 && (
            <ul className="ops-zones">
              {areas.map((a) => (
                <ZoneRow
                  key={a.zoneKey}
                  requestId={request.id}
                  area={a}
                  agents={agents}
                  assignments={detail.assignments.filter((x) => x.zoneKeys.includes(a.zoneKey))}
                  onChanged={onChanged}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <aside className="ops-col side">
        <OutreachCard contacts={detail.contacts} onChanged={onChanged} />
        <AssignmentSummaryCard areas={areas} assignments={detail.assignments} hasAgents={agents.some((a) => a.status === "active")} onChanged={onChanged} />
        <div className="ops-card">
          <h2>들어온 매물 {detail.proposals.length > 0 && <small>{detail.proposals.length}건</small>}</h2>
          {detail.proposals.length === 0 && <p className="ops-muted">아직 공인중개사가 올린 매물이 없어요.</p>}
          <ul className="ops-list">
            {detail.proposals.map((p) => (
              <li key={p.proposalId}>
                <b>{p.title}</b>
                <small>
                  {p.agent.name} · {p.transactionType === "jeonse" ? `전세 ${money(p.deposit)}` : `${money(p.deposit)} / ${money(p.monthlyRent)}`} · {p.station.name} 도보 {p.station.walkMinutes}분 ·
                  통근 {p.commute.totalMinutes}분
                </small>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function ZoneRow({
  requestId,
  area,
  agents,
  assignments,
  onChanged,
}: {
  requestId: string;
  area: AreaRecommendation;
  agents: AgentSummary[];
  assignments: AssignmentSummary[];
  onChanged: () => void;
}) {
  const [panel, setPanel] = useState<"brokers" | "assign" | null>(null);
  const toggle = (next: "brokers" | "assign") => setPanel(panel === next ? null : next);
  return (
    <li className={assignments.length ? "on" : ""}>
      <div className="ops-zone-main">
        <span>
          <b>{area.name}</b>
          <small>
            {area.sigungu} · 통근 {area.commute.bestMinutes ?? "-"}분
            {area.commute.walkMinutes !== null && ` (도보 ${area.commute.walkMinutes} + 대중교통 ${area.commute.transitMinutes ?? "-"})`} · 환승{" "}
            {area.commute.bestTransferCount ?? "-"}회{area.commute.estimated && " · 추정"}
          </small>
          <small>
            {area.matchedTypes
              .map((m) => `${choiceLabel(HOUSING_TYPE_CHOICES, m.type)} ${m.stats.count}건 ${money(m.stats.monthlyDepositMedian)}/${money(m.stats.monthlyRentMedian)}`)
              .join(" · ")}
          </small>
        </span>
        <span className="ops-zone-actions">
          <button type="button" className="ops-btn ghost" aria-expanded={panel === "brokers"} onClick={() => toggle("brokers")}>
            <Search aria-hidden /> 근처 부동산
          </button>
          <button type="button" className="ops-btn ghost" aria-expanded={panel === "assign"} onClick={() => toggle("assign")}>
            <UserPlus aria-hidden /> 중개사 배정
          </button>
        </span>
      </div>
      {assignments.length > 0 && (
        <ul className="ops-assigned" aria-label={`${area.name} 배정된 공인중개사`}>
          {assignments.map((a) => (
            <li key={a.id}>
              {a.agent.name}
              {a.proposalCount > 0 && <em>매물 {a.proposalCount}</em>}
              <button
                type="button"
                aria-label={`${area.name}에서 ${a.agent.name} 배정 빼기`}
                onClick={async () => {
                  if (!window.confirm(`${area.name}에서 ${a.agent.name}님 배정을 뺄까요?`)) return;
                  try {
                    await adminApi.unassign(a.id, area.zoneKey);
                    onChanged();
                  } catch (err) {
                    toast.error(errorText(err));
                  }
                }}
              >
                <X aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {panel === "brokers" && <BrokerPanel requestId={requestId} zoneKey={area.zoneKey} onChanged={onChanged} />}
      {panel === "assign" && (
        <AssignForm
          requestId={requestId}
          zoneKey={area.zoneKey}
          agents={agents}
          assignedIds={assignments.map((a) => a.agent.id)}
          onDone={() => {
            setPanel(null);
            onChanged();
          }}
        />
      )}
    </li>
  );
}

/** 이 생활권에 공인중개사 여러 명을 한 번에 배정 */
function AssignForm({
  requestId,
  zoneKey,
  agents,
  assignedIds,
  onDone,
}: {
  requestId: string;
  zoneKey: string;
  agents: AgentSummary[];
  assignedIds: string[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const candidates = agents.filter((a) => a.status === "active" && !assignedIds.includes(a.id));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  if (!candidates.length) {
    return (
      <p className="ops-muted ops-assign">
        {agents.some((a) => a.status === "active") ? "활성 공인중개사가 모두 이 생활권에 배정돼 있어요." : "등록된 공인중개사가 없어요."}{" "}
        <Link href="/admin/agents">공인중개사 만들기</Link>
      </p>
    );
  }
  return (
    <div className="ops-assign">
      <div className="ops-agent-picks">
        {candidates.map((a) => (
          <label key={a.id} className={picked.includes(a.id) ? "on" : ""}>
            <input type="checkbox" checked={picked.includes(a.id)} onChange={() => toggle(a.id)} />
            <span>
              <b>{a.name}</b>
              <small>{[a.loginId, a.address].filter(Boolean).join(" · ")}</small>
            </span>
          </label>
        ))}
      </div>
      <input
        className="ops-input"
        aria-label="메모 (공인중개사에게 보임)"
        placeholder="메모 (선택, 공인중개사에게 보여요)"
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        type="button"
        className="ops-btn primary"
        disabled={!picked.length || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await adminApi.assign(requestId, { zoneKey, agentIds: picked, note: note.trim() || null });
            toast(`${picked.length}명에게 배정했어요. 공인중개사 웹에 바로 보여요.`);
            void queryClient.invalidateQueries({ queryKey: ["admin", "requests"] });
            onDone();
          } catch (err) {
            toast.error(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <UserPlus aria-hidden /> {picked.length ? `${picked.length}명 배정하기` : "공인중개사를 고르세요"}
      </button>
    </div>
  );
}

/** 공인중개사별 배정 현황 */
function AssignmentSummaryCard({
  areas,
  assignments,
  hasAgents,
  onChanged,
}: {
  areas: AreaRecommendation[];
  assignments: AssignmentSummary[];
  hasAgents: boolean;
  onChanged: () => void;
}) {
  const zoneName = (key: string) => areas.find((a) => a.zoneKey === key)?.name ?? key;
  return (
    <div className="ops-card">
      <h2>배정 현황 {assignments.length > 0 && <small>{assignments.length}명</small>}</h2>
      {assignments.length === 0 && (
        <p className="ops-muted">
          생활권마다 &ldquo;중개사 배정&rdquo;을 눌러 여러 공인중개사에게 맡기세요.
          {!hasAgents && (
            <>
              {" "}
              <Link href="/admin/agents">공인중개사 만들기</Link>
            </>
          )}
        </p>
      )}
      {assignments.length > 0 && (
        <ul className="ops-list">
          {assignments.map((a) => (
            <li key={a.id}>
              <b>
                {a.agent.name}{" "}
                <span className={`ops-badge ${a.status === "proposed" ? "on" : ""}`}>{a.status === "proposed" ? `매물 ${a.proposalCount}건` : "배정됨"}</span>
              </b>
              <small>{a.zoneKeys.map(zoneName).join(", ")}</small>
              {a.note && <small>메모: {a.note}</small>}
              <button
                type="button"
                className="ops-icon"
                aria-label={`${a.agent.name} 배정 모두 취소`}
                onClick={async () => {
                  if (!window.confirm(`${a.agent.name}님의 이 요청 배정을 모두 취소할까요?`)) return;
                  await adminApi.unassign(a.id);
                  onChanged();
                }}
              >
                <Trash2 aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
