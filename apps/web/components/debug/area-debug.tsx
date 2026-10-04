"use client";

import type { AreaCommuteFit, AreaCriteria, AreaRecommendationResult, HousingType, PlaceCandidate, RequestDraft } from "@zipazum/shared";
import { COMMUTE_CHOICES, DEFAULT_DRAFT, HOUSING_TYPE_CHOICES, NO_TRANSFER_EXTRA_CHOICES, choiceLabel, formatManwon } from "@zipazum/shared";
import { ExternalLink, MapPin, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { SingleChips } from "@/components/common/chip-group";
import { BudgetStep, HousingTypeStep } from "@/components/request/request-steps";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  computeAreas,
  fetchDebugRequests,
  getDebugToken,
  recomputeRequestAreas,
  searchPlaces,
  setDebugToken,
  type DebugRequestRow,
} from "@/lib/api/debug";

const FIT_LABEL: Record<AreaCommuteFit, string> = {
  within: "시간 내",
  no_transfer_extra: "환승 없는 추천",
  over: "초과",
  no_route: "경로 없음",
};

const money = (value: number | null) => (value === null ? "-" : formatManwon(value));

/** 요청 초안에서 추천 조건(스텝 2·3)만 꺼낸다 */
const criteriaOf = (draft: RequestDraft): AreaCriteria => ({
  housingTypes: draft.housingTypes,
  transactionPreference: draft.transactionPreference,
  depositMax: draft.depositMax,
  monthlyRentMax: draft.monthlyRentMax,
  jeonseMax: draft.jeonseMax,
  budgetFlexibility: draft.budgetFlexibility,
});

/**
 * 출근지 + 요청 스텝 1~3 조건 → 추천 생활권 확인용 디버그 화면.
 * 조건과 통근시간을 모두 만족한 생활권만 나온다. 실사용자에게는 링크하지 않는다.
 */
export function AreaDebug() {
  const [token, setToken] = useState(getDebugToken);
  const [query, setQuery] = useState("강남역");
  const [places, setPlaces] = useState<PlaceCandidate[] | null>(null);
  const [place, setPlace] = useState<PlaceCandidate | null>(null);
  // 스텝 1~3 입력은 실제 요청 초안과 같은 형태로 들고, 저장하지 않는다
  const [draft, setDraft] = useState<RequestDraft>(DEFAULT_DRAFT);
  const update = (patch: Partial<RequestDraft>) => setDraft((prev) => ({ ...prev, ...patch }));
  const [useCriteria, setUseCriteria] = useState(true);
  const [result, setResult] = useState<AreaRecommendationResult | null>(null);
  const [busy, setBusy] = useState<"search" | "compute" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async <T,>(kind: "search" | "compute", task: () => Promise<T>) => {
    setBusy(kind);
    setError(null);
    try {
      return await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const search = async () => {
    const found = await run("search", () => searchPlaces(query));
    if (found) {
      setPlaces(found);
      setPlace(found[0] ?? null);
    }
  };

  const compute = async () => {
    if (!place) return;
    const computed = await run("compute", () =>
      computeAreas({
        label: place.label,
        latitude: place.latitude,
        longitude: place.longitude,
        maxCommuteMinutes: draft.maxCommuteMinutes,
        noTransferExtraMinutes: draft.noTransferExtraMinutes,
        criteria: useCriteria ? criteriaOf(draft) : null,
      }),
    );
    if (computed) setResult(computed);
  };

  return (
    <section className="debug">
      <span className="eyebrow">DEBUG</span>
      <h1>출근지 → 추천 생활권</h1>
      <p className="debug-note">
        개발·운영 확인용 화면이에요. 요청 스텝 1~3 조건과 통근시간을 모두 만족한 생활권(역세권 도보 15분 / 행정동 버스권)만 보여요. 실제
        사용자에게는 보이지 않습니다.
      </p>

      <div className="debug-card">
        <h2>STEP 1 · 출근</h2>
        <label htmlFor="debug-query">출근지</label>
        <form
          className="debug-row"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <Input id="debug-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="역, 회사·빌딩명, 도로명 주소" />
          <Button type="submit" disabled={busy !== null || !query.trim()}>
            <Search aria-hidden /> 검색
          </Button>
        </form>
        {places && places.length === 0 && <p className="debug-muted">검색 결과가 없어요. 빌딩·회사 이름이 안 나오면 도로명 주소로 검색해보세요.</p>}
        {places && places.length > 0 && (
          <ul className="debug-places">
            {places.map((p) => (
              <li key={`${p.source}-${p.label}-${p.latitude}`}>
                <button type="button" className={place === p ? "on" : ""} onClick={() => setPlace(p)}>
                  <b>{p.label}</b>
                  <small>
                    {p.address ?? ""} · {p.category ?? ""} · {p.source}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}
        <label>최대 통근시간</label>
        <SingleChips label="최대 통근시간" choices={COMMUTE_CHOICES} value={draft.maxCommuteMinutes} onChange={(maxCommuteMinutes) => update({ maxCommuteMinutes })} />
        <label>환승 없으면 더 허용</label>
        <SingleChips
          label="환승 없는 곳 추가 허용"
          choices={NO_TRANSFER_EXTRA_CHOICES}
          value={draft.noTransferExtraMinutes}
          onChange={(noTransferExtraMinutes) => update({ noTransferExtraMinutes })}
        />
      </div>

      <div className={useCriteria ? "debug-card" : "debug-card debug-off"}>
        <label className="debug-toggle">
          <Checkbox checked={useCriteria} onCheckedChange={(v) => setUseCriteria(v === true)} />
          <span>STEP 2·3 조건(예산·주택 유형)으로 거르기</span>
        </label>
        <h2>STEP 2 · 예산</h2>
        <BudgetStep draft={draft} update={update} />
        <h2 className="debug-gap">STEP 3 · 주택 유형</h2>
        <HousingTypeStep draft={draft} update={update} />
      </div>

      <Button className="primary wide debug-go" disabled={!place || busy !== null} onClick={() => void compute()}>
        {busy === "compute" ? "TMAP으로 계산 중… (처음 보는 출근지는 30초 이상)" : place ? `${place.label} 기준 생활권 찾기` : "출근지를 먼저 검색하세요"}
      </Button>
      <details className="debug-token">
        <summary>디버그 토큰</summary>
        <Input
          value={token}
          placeholder="API에 DEBUG_TOKEN을 설정했을 때만"
          onChange={(e) => {
            setToken(e.target.value);
            setDebugToken(e.target.value);
          }}
        />
      </details>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {result && <AreaResult result={result} />}
      <RecentRequests />
    </section>
  );
}

function AreaResult({ result }: { result: AreaRecommendationResult }) {
  const f = result.funnel;
  const criteria = result.criteria;
  return (
    <div className="debug-card">
      <h2>
        <MapPin aria-hidden /> {result.destination.label} · {result.maxCommuteMinutes}분
        {result.noTransferExtraMinutes > 0 && ` (+환승 없으면 ${result.noTransferExtraMinutes}분)`}
      </h2>
      {criteria && (
        <p className="debug-muted">
          조건: {criteria.housingTypes.map((t) => choiceLabel(HOUSING_TYPE_CHOICES, t)).join("·") || "유형 전체"} ·{" "}
          {criteria.transactionPreference !== "jeonse" && `보증금 ${money(criteria.depositMax)} / 월세 ${money(criteria.monthlyRentMax)} (보증금 1,000만원당 월세 5만원 환산)`}
          {criteria.transactionPreference === "both" && " · "}
          {criteria.transactionPreference !== "rent" && `전세 ${money(criteria.jeonseMax)}`} · 예산 조정 {criteria.budgetFlexibility}
        </p>
      )}
      <ol className="debug-funnel">
        <li>
          반경 안 생활권 <b>{f.zonesInRadius}</b>
        </li>
        <li>
          유형·예산 맞음 <b>{f.matchedConditions}</b>
        </li>
        <li>
          직선 추정 통과 <b>{f.afterEstimate}</b>
        </li>
        <li>
          통근 맞음 <b>{f.fit}</b>
          <small>
            실측 {f.measured} · 추정 {f.estimated}
          </small>
        </li>
      </ol>
      {result.warnings.map((warning) => (
        <p className="field-hint" key={warning}>
          {warning}
        </p>
      ))}
      {result.areas.length === 0 ? (
        <p className="debug-muted">조건에 맞는 생활권이 없어요.</p>
      ) : (
        <div className="debug-table" role="table">
          <div className="debug-tr head" role="row">
            <span>생활권</span>
            <span>통근 대표값</span>
            <span>무환승</span>
            <span>맞는 유형 · 시세(중위)</span>
            <span>점수</span>
          </div>
          {result.areas.map((area) => (
            <div className={`debug-tr fit-${area.commute.fit}`} role="row" key={area.zoneId}>
              <span>
                <b>{area.name}</b>
                <em className={`fit fit-${area.commute.fit}`}>{FIT_LABEL[area.commute.fit]}</em>
                <small>
                  {area.sigungu} · 직선 {area.distanceKm}km ·{" "}
                  <a href={`https://www.google.com/maps?q=${area.latitude},${area.longitude}`} target="_blank" rel="noreferrer">
                    대표 위치 <ExternalLink aria-hidden />
                  </a>
                </small>
              </span>
              <span>
                <b>{area.commute.bestMinutes === null ? "-" : `${area.commute.bestMinutes}분`}</b>
                <small>
                  {area.commute.walkMinutes !== null ? `도보 ${area.commute.walkMinutes} + ` : ""}
                  대중교통 {area.commute.transitMinutes ?? "-"}분 · 환승 {area.commute.bestTransferCount ?? "-"}회
                </small>
                {area.commute.estimated && <em className="fit estimate">추정</em>}
              </span>
              <span>{area.commute.noTransferMinutes === null ? "-" : `${area.commute.noTransferMinutes}분`}</span>
              <span>
                {area.matchedTypes.map((m) => (
                  <small key={m.type} className="debug-type">
                    <b>{choiceLabel(HOUSING_TYPE_CHOICES, m.type as HousingType)}</b> {m.stats.count}건 · 월세 {money(m.stats.monthlyDepositMedian)}/
                    {money(m.stats.monthlyRentMedian)} · 전세 {money(m.stats.jeonseDepositMedian)}
                  </small>
                ))}
              </span>
              <span>{area.residentialScore}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentRequests() {
  const [rows, setRows] = useState<DebugRequestRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetchDebugRequests()
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));

  useEffect(() => {
    void load();
  }, []);

  const current = rows?.find((r) => r.requestId === selected)?.recommendation ?? null;

  return (
    <div className="debug-card">
      <h2>
        최근 사용자 요청
        <button type="button" className="debug-icon" aria-label="새로고침" onClick={() => void load()}>
          <RefreshCw aria-hidden />
        </button>
      </h2>
      <p className="debug-muted">요청이 제출되면 서버가 그 요청의 조건으로 추천 생활권을 계산해 저장해요.</p>
      {error && <p className="field-error">{error}</p>}
      {rows && rows.length === 0 && <p className="debug-muted">아직 요청이 없어요.</p>}
      {rows && rows.length > 0 && (
        <ul className="debug-places">
          {rows.map((r) => {
            const rec = r.recommendation;
            return (
              <li key={r.requestId}>
                <button type="button" className={selected === r.requestId ? "on" : ""} onClick={() => setSelected(r.requestId)}>
                  <b>
                    {r.destinationLabel} · {r.maxCommuteMinutes}분
                  </b>
                  <small>
                    {new Date(r.submittedAt).toLocaleString("ko-KR")} · {rec ? rec.status : "계산 안 함"}
                    {rec?.result?.funnel && ` · 맞는 생활권 ${rec.result.funnel.fit}곳`}
                    {rec?.error && ` · ${rec.error}`}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected && (
        <Button variant="outline" className="debug-go" onClick={() => void recomputeRequestAreas(selected).then(load)}>
          <RefreshCw aria-hidden /> 이 요청 다시 계산
        </Button>
      )}
      {current?.result?.funnel && <AreaResult result={current.result} />}
      {current?.result && !current.result.funnel && <p className="debug-muted">이전 방식(법정동)으로 계산된 결과예요. 다시 계산해 주세요.</p>}
    </div>
  );
}
