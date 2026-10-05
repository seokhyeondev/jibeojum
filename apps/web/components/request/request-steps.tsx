"use client";

import {
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  TrainFront,
} from "lucide-react";
import { useId, useState } from "react";
import { MultiChips, SingleChips } from "@/components/common/chip-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  BUDGET_FLEXIBILITY_CHOICES,
  BUILDING_AGE_CHOICES,
  DIRECTION_CHOICES,
  MIN_PYEONG_CHOICES,
  pyeongToM2,
  COMMUTE_CHOICES,
  FLOOR_EXCLUSION_CHOICES,
  FLOOR_PREFERENCE_CHOICES,
  HOUSING_TYPE_CHOICES,
  INFRA_CHOICES,
  MOVE_IN_FLEXIBILITY_CHOICES,
  NO_TRANSFER_EXTRA_CHOICES,
  REQUIRED_OPTION_CHOICES,
  SAFETY_CHOICES,
  TRANSACTION_CHOICES,
} from "@zipazum/shared";
import { formatManwon, formatNumber, parseManwon } from "@zipazum/shared";
import { DestinationSearch } from "./destination-search";
import {
  choiceLabel,
  moveInDateWarning,
  requestConditionLabels,
  wantsJeonse,
  wantsRent,
} from "@zipazum/shared";
import type { RequestDraft } from "@zipazum/shared";

export interface StepProps {
  draft: RequestDraft;
  update: (patch: Partial<RequestDraft>) => void;
}

export const STEP_COPY = [
  {
    title: "어디로 출근하세요?",
    sub: "출근지를 기준으로 살기 좋은 동네를 찾아드려요",
  },
  {
    title: "예산을 알려주세요",
    sub: "관리비를 제외한 최대 금액을 입력해주세요",
  },
  { title: "어떤 집을 찾으세요?", sub: "여러 개를 선택하셔도 괜찮아요" },
  { title: "입주 조건을 확인할게요", sub: "꼭 필요한 조건만 골라주세요" },
  {
    title: "이 조건으로 찾아드릴게요",
    sub: "보내기 전에 한 번만 확인해주세요",
  },
];

export function CommuteStep({ draft, update }: StepProps) {
  return (
    <>
      <label htmlFor="destination">출근지</label>
      <DestinationSearch
        value={draft.commuteDestination}
        onChange={(commuteDestination) => update({ commuteDestination })}
      />
      <label className="mt">최대 통근시간</label>
      <SingleChips
        label="최대 통근시간"
        choices={COMMUTE_CHOICES}
        value={draft.maxCommuteMinutes}
        onChange={(maxCommuteMinutes) => update({ maxCommuteMinutes })}
      />
      <label className="mt">환승 없이 갈 수 있다면 더 걸려도 괜찮나요?</label>
      <SingleChips
        label="환승 없는 곳 추가 허용 시간"
        choices={NO_TRANSFER_EXTRA_CHOICES}
        value={draft.noTransferExtraMinutes}
        onChange={(noTransferExtraMinutes) =>
          update({ noTransferExtraMinutes })
        }
      />
      <div className="info">
        <TrainFront aria-hidden />
        <span>
          <b>대중교통 기준으로 계산해요</b>
          <small>
            도보·버스·지하철 환승시간을 모두 포함합니다.
            {draft.noTransferExtraMinutes > 0 &&
              ` 한 번에 가는 동네는 ${draft.maxCommuteMinutes + draft.noTransferExtraMinutes}분까지 함께 추천해요.`}
          </small>
        </span>
      </div>
    </>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <div className="money">
        <Input
          id={id}
          inputMode="numeric"
          value={formatNumber(value)}
          onChange={(e) => onChange(parseManwon(e.target.value))}
        />
        <span>만원</span>
      </div>
    </div>
  );
}

export function BudgetStep({ draft, update }: StepProps) {
  const rent = wantsRent(draft.transactionPreference);
  const jeonse = wantsJeonse(draft.transactionPreference);
  return (
    <div className="fields">
      <div>
        <label>어떤 계약을 찾으세요?</label>
        <SingleChips
          label="거래 유형"
          choices={TRANSACTION_CHOICES}
          value={draft.transactionPreference}
          onChange={(transactionPreference) =>
            update({ transactionPreference })
          }
        />
      </div>
      {rent && (
        <div className={jeonse ? "budget-group" : "fields"}>
          {jeonse && <h3>월세</h3>}
          <MoneyField
            id="deposit"
            label="최대 보증금"
            value={draft.depositMax}
            onChange={(depositMax) => update({ depositMax })}
          />
          <MoneyField
            id="rent"
            label="최대 월세"
            value={draft.monthlyRentMax}
            onChange={(monthlyRentMax) => update({ monthlyRentMax })}
          />
        </div>
      )}
      {jeonse && (
        <div className={rent ? "budget-group" : "fields"}>
          {rent && <h3>전세</h3>}
          <MoneyField
            id="jeonse"
            label="최대 전세금"
            value={draft.jeonseMax}
            onChange={(jeonseMax) => update({ jeonseMax })}
          />
        </div>
      )}
      <div>
        <label>예산 조정이 가능한가요?</label>
        <SingleChips
          label="예산 조정 가능 여부"
          choices={BUDGET_FLEXIBILITY_CHOICES}
          value={draft.budgetFlexibility}
          onChange={(budgetFlexibility) => update({ budgetFlexibility })}
        />
      </div>
      <div className="info">
        <Sparkles aria-hidden />
        <span>
          {rent && (
            <>
              보증금 <b>{formatNumber(draft.depositMax) || "-"}만원</b> · 월세{" "}
              <b>{formatNumber(draft.monthlyRentMax) || "-"}만원 이하</b>
            </>
          )}
          {rent && jeonse && <br />}
          {jeonse && (
            <>
              전세{" "}
              <b>
                {draft.jeonseMax === null
                  ? "-"
                  : `${formatManwon(draft.jeonseMax)}원`}{" "}
                이하
              </b>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

export function HousingTypeStep({ draft, update }: StepProps) {
  const toggle = (value: RequestDraft["housingTypes"][number]) =>
    update({
      housingTypes: draft.housingTypes.includes(value)
        ? draft.housingTypes.filter((x) => x !== value)
        : [...draft.housingTypes, value],
    });
  return (
    <>
      <div className="types" role="group" aria-label="주택 유형">
        {HOUSING_TYPE_CHOICES.map(({ value, label, description }) => {
          const on = draft.housingTypes.includes(value);
          return (
            <button
              type="button"
              aria-pressed={on}
              className={on ? "on" : ""}
              onClick={() => toggle(value)}
              key={value}
            >
              <i>
                <Building2 aria-hidden />
              </i>
              <span>
                <b>{label}</b>
                <small>{description}</small>
              </span>
              {on && <Check className="tick" aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="min-area">
        <label>
          최소 넓이 <small>선택</small>
        </label>
        <div className="area-seg" role="radiogroup" aria-label="최소 넓이">
          {MIN_PYEONG_CHOICES.map(({ value }) => {
            const on = draft.minPyeong === value;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={on}
                className={on ? "on" : ""}
                onClick={() => update({ minPyeong: value })}
                key={value}
              >
                {value === 0 ? (
                  <b className="any">상관없음</b>
                ) : (
                  <>
                    <b>{value}평+</b>
                    <small>{pyeongToM2(value)}㎡</small>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function MoveInStep({
  draft,
  update,
  today,
}: StepProps & { today: string }) {
  const warning = moveInDateWarning(draft.moveInDate, today);
  return (
    <>
      <label htmlFor="move-in">희망 입주일</label>
      <div className="inputbox">
        <CalendarDays aria-hidden />
        <Input
          id="move-in"
          type="date"
          value={draft.moveInDate}
          min={today}
          onChange={(e) => update({ moveInDate: e.target.value })}
        />
      </div>
      {warning && <p className="field-hint">{warning}</p>}
      <div className="sub-choices">
        <SingleChips
          label="입주일 조정"
          choices={MOVE_IN_FLEXIBILITY_CHOICES}
          value={draft.moveInFlexibility}
          onChange={(moveInFlexibility) => update({ moveInFlexibility })}
        />
      </div>
      <label className="mt">필수 조건</label>
      <MultiChips
        label="필수 조건"
        choices={REQUIRED_OPTION_CHOICES}
        values={draft.requiredOptions}
        onChange={(requiredOptions) => update({ requiredOptions })}
      />
      <MorePreferences draft={draft} update={update} />
    </>
  );
}

/** 선택 조건은 접어 두고, 이미 고른 값이 있으면 펼친 채로 시작한다. */
function MorePreferences({ draft, update }: StepProps) {
  const [open, setOpen] = useState(() => countPreferences(draft) > 0);
  const panelId = useId();
  const count = countPreferences(draft);
  return (
    <div className={open ? "more-prefs open" : "more-prefs"}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <span>
          <b>더 꼼꼼하게 고르기</b>
          <small>
            {count > 0
              ? `${count}개 선택됨`
              : "선택 · 안심 조건, 층수, 연식, 주변 시설"}
          </small>
        </span>
        <ChevronDown aria-hidden />
      </button>
      {open && (
        <div id={panelId}>
          <PreferenceFields draft={draft} update={update} />
        </div>
      )}
    </div>
  );
}

function PreferenceFields({ draft, update }: StepProps) {
  return (
    <div className="prefs">
      <section>
        <h3>
          <ShieldCheck aria-hidden />
          안심 조건
        </h3>
        <p>여성 전용 건물이나 보안 시설을 원하시면 골라주세요.</p>
        <MultiChips
          label="안심 조건"
          choices={SAFETY_CHOICES}
          values={draft.safetyOptions}
          onChange={(safetyOptions) => update({ safetyOptions })}
        />
      </section>
      <section>
        <h3>층수</h3>
        <SingleChips
          label="층수"
          choices={FLOOR_PREFERENCE_CHOICES}
          value={draft.floorPreference}
          onChange={(floorPreference) => update({ floorPreference })}
        />
        <div className="sub-choices">
          <MultiChips
            label="제외할 구조"
            choices={FLOOR_EXCLUSION_CHOICES}
            values={draft.floorExclusions}
            onChange={(floorExclusions) => update({ floorExclusions })}
          />
        </div>
      </section>
      <section>
        <h3>방향</h3>
        <p>원하는 방향을 모두 골라주세요. 고르지 않으면 상관없이 찾아요.</p>
        <MultiChips
          label="방향"
          choices={DIRECTION_CHOICES}
          values={draft.directions}
          onChange={(directions) => update({ directions })}
        />
      </section>
      <section>
        <h3>건물 연식</h3>
        <SingleChips
          label="건물 연식"
          choices={BUILDING_AGE_CHOICES}
          value={draft.buildingAge}
          onChange={(buildingAge) => update({ buildingAge })}
        />
        <p className="choice-desc">
          {BUILDING_AGE_CHOICES.find(
            (choice) => choice.value === draft.buildingAge,
          )?.description ?? "신축과 구축 모두 제안받아요"}
        </p>
      </section>
      <section>
        <h3>가까웠으면 하는 시설</h3>
        <p>도보 10분 이내에 있는지 확인해요.</p>
        <MultiChips
          label="가까웠으면 하는 시설"
          choices={INFRA_CHOICES}
          values={draft.infrastructure}
          onChange={(infrastructure) => update({ infrastructure })}
        />
      </section>
    </div>
  );
}

function countPreferences(draft: RequestDraft): number {
  return (
    draft.safetyOptions.length +
    draft.directions.length +
    draft.floorExclusions.length +
    draft.infrastructure.length +
    (draft.floorPreference !== "any" ? 1 : 0) +
    (draft.buildingAge !== "any" ? 1 : 0)
  );
}

/** 마지막 단계: 입력한 조건을 한눈에 확인하고 동의한다. 로그인·제출은 아래 버튼이 맡는다 */
export function ReviewStep({
  draft,
  update,
  onEdit,
}: StepProps & { onEdit: (step: number) => void }) {
  const types = draft.housingTypes
    .map((t) => choiceLabel(HOUSING_TYPE_CHOICES, t))
    .join(", ");
  // 집 유형·환승 조건은 위 줄에서 이미 보여준다
  const extras = requestConditionLabels(draft).filter(
    (label) =>
      !label.startsWith("환승") &&
      !label.endsWith("평 이상") &&
      !draft.housingTypes.some(
        (t) => choiceLabel(HOUSING_TYPE_CHOICES, t) === label,
      ),
  );
  const budget = [
    wantsRent(draft.transactionPreference)
      ? `보증금 ${formatManwon(draft.depositMax ?? 0)}원 · 월세 ${formatManwon(draft.monthlyRentMax ?? 0)}원`
      : null,
    wantsJeonse(draft.transactionPreference)
      ? `전세 ${formatManwon(draft.jeonseMax ?? 0)}원`
      : null,
  ].filter(Boolean);
  const rows: { step: number; label: string; value: string; sub?: string }[] = [
    {
      step: 1,
      label: "출근지",
      value: draft.commuteDestination.label,
      sub: `최대 ${draft.maxCommuteMinutes}분${draft.noTransferExtraMinutes ? ` · 환승 없으면 +${draft.noTransferExtraMinutes}분까지` : ""}`,
    },
    {
      step: 2,
      label: "예산",
      value: budget.join(" / "),
      sub: choiceLabel(BUDGET_FLEXIBILITY_CHOICES, draft.budgetFlexibility),
    },
    {
      step: 3,
      label: "집 유형",
      value: types,
      sub: draft.minPyeong
        ? `${draft.minPyeong}평(${pyeongToM2(draft.minPyeong)}㎡) 이상`
        : undefined,
    },
    {
      step: 4,
      label: "입주",
      value: `${draft.moveInDate} · ${choiceLabel(MOVE_IN_FLEXIBILITY_CHOICES, draft.moveInFlexibility)}`,
      sub: extras.length ? extras.join(" · ") : undefined,
    },
  ];
  return (
    <div className="review">
      <ul>
        {rows.map((row) => (
          <li key={row.step}>
            <span>{row.label}</span>
            <div>
              <b>{row.value}</b>
              {row.sub && <small>{row.sub}</small>}
            </div>
            <button
              type="button"
              onClick={() => onEdit(row.step)}
              aria-label={`${row.label} 수정`}
            >
              수정
            </button>
          </li>
        ))}
      </ul>
      <label className="agree">
        <Checkbox
          checked={draft.privacyAgreed}
          onCheckedChange={(v) => update({ privacyAgreed: v === true })}
        />
        <span>
          <a href="/privacy" target="_blank" rel="noreferrer">
            개인정보 수집
          </a>{" "}
          및 공인중개사에게 조건 전달에 동의합니다. (필수)
        </span>
      </label>
    </div>
  );
}
