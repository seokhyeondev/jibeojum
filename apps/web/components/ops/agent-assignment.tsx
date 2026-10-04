"use client";

import type { AgentAssignmentDetail, AgentListingDraft } from "@zipazum/shared";
import { HOUSING_TYPE_CHOICES, REQUIRED_OPTION_CHOICES, SAFETY_CHOICES, agentListingInputSchema, formatPrice } from "@zipazum/shared";
import { ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { agentApi, naverMapUrl } from "@/lib/api/ops";
import { AddressSearch, ListingPhotos, type PickedAddress } from "./listing-media";
import { OpsShell } from "./ops-shell";
import { errorText, useOpsQuery } from "./use-ops-query";

export function AgentAssignmentPage({ id }: { id: string }) {
  const { data, isPending, error, refetch } = useOpsQuery("agent", ["assignment", id], () => agentApi.assignment(id));
  return (
    <OpsShell kind="agent">
      <Link href="/agent" className="ops-back">
        ← 배정 목록
      </Link>
      {isPending && <p className="ops-muted">불러오는 중…</p>}
      {error && <p className="ops-error">{errorText(error)}</p>}
      {data && (
        <div className="ops-grid">
          <section className="ops-col">
            <RequestCard detail={data} />
            <ListingForm assignmentId={data.id} defaultType={data.request.housingTypes[0]} jeonse={data.request.transactionPreference === "jeonse"} onCreated={() => void refetch()} />
          </section>
          <aside className="ops-col side">
            <div className="ops-card">
              <h2>올린 매물 {data.myListings.length > 0 && <small>{data.myListings.length}건</small>}</h2>
              {data.myListings.length === 0 && <p className="ops-muted">아직 올린 매물이 없어요.</p>}
              <ul className="ops-list">
                {data.myListings.map((l) => (
                  <li key={l.id}>
                    <b>{l.title}</b>
                    <small>
                      {formatPrice(l)} · {l.station.name} 도보 {l.station.walkMinutes}분 · 출근 {l.commute.totalMinutes}분
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </OpsShell>
  );
}

function RequestCard({ detail }: { detail: AgentAssignmentDetail }) {
  return (
    <div className="ops-card">
      <span className="ops-eyebrow">고객 요청</span>
      <h1>{detail.destinationLabel} 출근</h1>
      {detail.request.commuteDestination.address && (
        <p className="ops-muted">
          <MapPin aria-hidden /> {detail.request.commuteDestination.address}
        </p>
      )}
      <p>{detail.summary}</p>
      <div className="ops-chips">
        {detail.conditions.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <p className="ops-muted">입주 {detail.request.moveInDate}</p>
      {detail.note && <p className="ops-note">운영팀 메모: {detail.note}</p>}
      {detail.zones.length > 0 && (
        <>
          <h2>찾아볼 생활권</h2>
          <ul className="ops-chips links">
            {detail.zones.map((z) => (
              <li key={z.zoneKey}>
                <a href={naverMapUrl(z.stationName ?? z.name.split(" · ")[0])} target="_blank" rel="noreferrer">
                  {z.name} <ExternalLink aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const blank = (jeonse: boolean, housingType: AgentListingDraft["housingType"] = "studio") => ({
  title: "",
  housingType,
  transactionType: (jeonse ? "jeonse" : "rent") as "rent" | "jeonse",
  deposit: "",
  monthlyRent: "",
  maintenanceFee: "",
  place: null as PickedAddress | null,
  exclusiveAreaM2: "",
  floor: "",
  totalFloors: "",
  floorType: "normal" as "normal" | "semi_basement" | "rooftop",
  builtYear: "",
  availableFrom: "",
  moveInNote: "",
  options: [] as string[],
  security: [] as string[],
  description: "",
  imageUrls: [] as string[],
  agentNote: "",
});

type Form = ReturnType<typeof blank>;

const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v.replace(/,/g, "")));

function toDraft({ place, ...f }: Form) {
  return {
    ...f,
    address: place?.address ?? "",
    latitude: place?.latitude,
    longitude: place?.longitude,
    deposit: num(f.deposit),
    monthlyRent: f.transactionType === "jeonse" ? 0 : num(f.monthlyRent),
    maintenanceFee: f.maintenanceFee ? num(f.maintenanceFee) : 0,
    exclusiveAreaM2: num(f.exclusiveAreaM2),
    floor: num(f.floor),
    totalFloors: num(f.totalFloors),
    builtYear: num(f.builtYear),
    availableFrom: f.availableFrom || null,
    moveInNote: f.moveInNote.trim() || null,
    agentNote: f.agentNote.trim() || null,
  };
}

function ListingForm({ assignmentId, defaultType, jeonse, onCreated }: { assignmentId: string; defaultType: AgentListingDraft["housingType"] | undefined; jeonse: boolean; onCreated: () => void }) {
  const [form, setForm] = useState<Form>(() => blank(jeonse, defaultType));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const toggle = (key: "options" | "security", value: string) => set({ [key]: form[key].includes(value) ? form[key].filter((v) => v !== value) : [...form[key], value] });
  const rent = form.transactionType === "rent";

  return (
    <form
      className="ops-card ops-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = agentListingInputSchema.safeParse(toDraft(form));
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "입력을 확인해주세요");
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await agentApi.registerListing(assignmentId, parsed.data);
          toast("매물을 올렸어요. 고객에게 알림을 보냈어요.");
          setForm(blank(jeonse, defaultType));
          onCreated();
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>매물 올리기</h2>
      <p className="ops-muted">주소를 검색해서 고르면 가까운 역과 출근 시간을 자동으로 계산해요. 동·호수는 넣지 않아요.</p>

      <label htmlFor="l-title">제목</label>
      <input id="l-title" className="ops-input" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="예) 역삼역 3분 채광 좋은 원룸" />

      <div className="ops-row">
        <span>
          <label htmlFor="l-type">유형</label>
          <select id="l-type" className="ops-input" value={form.housingType} onChange={(e) => set({ housingType: e.target.value as Form["housingType"] })}>
            {HOUSING_TYPE_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </span>
        <span>
          <label htmlFor="l-tx">거래</label>
          <select id="l-tx" className="ops-input" value={form.transactionType} onChange={(e) => set({ transactionType: e.target.value as Form["transactionType"] })}>
            <option value="rent">월세</option>
            <option value="jeonse">전세</option>
          </select>
        </span>
      </div>

      <div className="ops-row">
        <span>
          <label htmlFor="l-deposit">{rent ? "보증금" : "전세금"} (만원)</label>
          <input id="l-deposit" className="ops-input" inputMode="numeric" value={form.deposit} onChange={(e) => set({ deposit: e.target.value })} />
        </span>
        {rent && (
          <span>
            <label htmlFor="l-rent">월세 (만원)</label>
            <input id="l-rent" className="ops-input" inputMode="numeric" value={form.monthlyRent} onChange={(e) => set({ monthlyRent: e.target.value })} />
          </span>
        )}
        <span>
          <label htmlFor="l-fee">관리비 (만원)</label>
          <input id="l-fee" className="ops-input" inputMode="numeric" value={form.maintenanceFee} onChange={(e) => set({ maintenanceFee: e.target.value })} placeholder="0" />
        </span>
      </div>

      <label htmlFor="l-address">주소</label>
      <AddressSearch value={form.place} onChange={(place) => set({ place })} />

      <div className="ops-row">
        <span>
          <label htmlFor="l-area">전용면적 (㎡)</label>
          <input id="l-area" className="ops-input" inputMode="decimal" value={form.exclusiveAreaM2} onChange={(e) => set({ exclusiveAreaM2: e.target.value })} />
        </span>
        <span>
          <label htmlFor="l-floor">층</label>
          <input id="l-floor" className="ops-input" inputMode="numeric" value={form.floor} onChange={(e) => set({ floor: e.target.value })} />
        </span>
        <span>
          <label htmlFor="l-floors">건물 층수</label>
          <input id="l-floors" className="ops-input" inputMode="numeric" value={form.totalFloors} onChange={(e) => set({ totalFloors: e.target.value })} />
        </span>
      </div>

      <div className="ops-row">
        <span>
          <label htmlFor="l-floortype">층 구분</label>
          <select id="l-floortype" className="ops-input" value={form.floorType} onChange={(e) => set({ floorType: e.target.value as Form["floorType"] })}>
            <option value="normal">일반</option>
            <option value="semi_basement">반지하</option>
            <option value="rooftop">옥탑</option>
          </select>
        </span>
        <span>
          <label htmlFor="l-built">준공연도</label>
          <input id="l-built" className="ops-input" inputMode="numeric" value={form.builtYear} onChange={(e) => set({ builtYear: e.target.value })} placeholder="2018" />
        </span>
        <span>
          <label htmlFor="l-from">입주 가능일</label>
          <input id="l-from" type="date" className="ops-input" value={form.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} />
        </span>
      </div>
      <input className="ops-input" aria-label="입주 메모" value={form.moveInNote} maxLength={40} onChange={(e) => set({ moveInNote: e.target.value })} placeholder="입주 메모 (선택, 예: 날짜 협의 가능)" />

      <fieldset>
        <legend>옵션</legend>
        <div className="ops-checks">
          {REQUIRED_OPTION_CHOICES.map((c) => (
            <label key={c.value}>
              <input type="checkbox" checked={form.options.includes(c.value)} onChange={() => toggle("options", c.value)} /> {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>안심</legend>
        <div className="ops-checks">
          {SAFETY_CHOICES.map((c) => (
            <label key={c.value}>
              <input type="checkbox" checked={form.security.includes(c.value)} onChange={() => toggle("security", c.value)} /> {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="l-desc">설명</label>
      <textarea id="l-desc" className="ops-input" rows={4} maxLength={1000} value={form.description} onChange={(e) => set({ description: e.target.value })} />
      <span className="ops-field-label">사진</span>
      <ListingPhotos value={form.imageUrls} onChange={(imageUrls) => set({ imageUrls })} />
      <label htmlFor="l-note">고객에게 한마디 (선택)</label>
      <input id="l-note" className="ops-input" maxLength={300} value={form.agentNote} onChange={(e) => set({ agentNote: e.target.value })} />

      {error && <p className="ops-error">{error}</p>}
      <button type="submit" className="ops-btn primary" disabled={busy}>
        {busy ? "주소 확인·출근 시간 계산 중…" : "매물 올리고 고객에게 알리기"}
      </button>
    </form>
  );
}
