"use client";

import { Building2, CalendarDays, Check, ChevronDown, MapPin, Search, ShieldCheck, Sparkles, TrainFront, UserRound } from "lucide-react";
import { useId, useState } from "react";
import { MultiChips, SingleChips } from "@/components/common/chip-group";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  BUDGET_FLEXIBILITY_CHOICES,
  BUILDING_AGE_CHOICES,
  COMMUTE_CHOICES,
  FLOOR_EXCLUSION_CHOICES,
  FLOOR_PREFERENCE_CHOICES,
  HOUSING_TYPE_CHOICES,
  INFRA_CHOICES,
  MOVE_IN_FLEXIBILITY_CHOICES,
  NO_TRANSFER_EXTRA_CHOICES,
  REQUIRED_OPTION_CHOICES,
  SAFETY_CHOICES,
} from "@/data/options";
import { formatNumber, parseManwon } from "@/lib/format";
import { moveInDateWarning } from "@/lib/schema/request";
import type { RequestDraft } from "@/types/request";

export interface StepProps {
  draft: RequestDraft;
  update: (patch: Partial<RequestDraft>) => void;
}

export const STEP_COPY = [
  { title: "어디로 출근하세요?", sub: "출근지를 기준으로 살기 좋은 동네를 찾아드려요" },
  { title: "예산을 알려주세요", sub: "관리비를 제외한 최대 금액을 입력해주세요" },
  { title: "어떤 집을 찾으세요?", sub: "여러 개를 선택하셔도 괜찮아요" },
  { title: "입주 조건을 확인할게요", sub: "꼭 필요한 조건만 골라주세요" },
  { title: "마지막으로 본인 확인", sub: "실제 이사 의향이 있는 요청인지 확인해요" },
];

export function CommuteStep({ draft, update }: StepProps) {
  return (
    <>
      <label htmlFor="destination">출근지</label>
      <div className="inputbox">
        <MapPin aria-hidden />
        <Input
          id="destination"
          value={draft.commuteDestination.label}
          onChange={(e) => update({ commuteDestination: { label: e.target.value } })}
          placeholder="회사명, 역 또는 주소 검색"
          autoComplete="off"
        />
        <Search aria-hidden />
      </div>
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
        onChange={(noTransferExtraMinutes) => update({ noTransferExtraMinutes })}
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

export function BudgetStep({ draft, update }: StepProps) {
  return (
    <div className="fields">
      <div>
        <label htmlFor="deposit">최대 보증금</label>
        <div className="money">
          <Input
            id="deposit"
            inputMode="numeric"
            value={formatNumber(draft.depositMax)}
            onChange={(e) => update({ depositMax: parseManwon(e.target.value) })}
          />
          <span>만원</span>
        </div>
      </div>
      <div>
        <label htmlFor="rent">최대 월세</label>
        <div className="money">
          <Input
            id="rent"
            inputMode="numeric"
            value={formatNumber(draft.monthlyRentMax)}
            onChange={(e) => update({ monthlyRentMax: parseManwon(e.target.value) })}
          />
          <span>만원</span>
        </div>
      </div>
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
          보증금 <b>{formatNumber(draft.depositMax) || "-"}만원</b> · 월세 <b>{formatNumber(draft.monthlyRentMax) || "-"}만원 이하</b>
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
    <div className="types" role="group" aria-label="주택 유형">
      {HOUSING_TYPE_CHOICES.map(({ value, label, description }) => {
        const on = draft.housingTypes.includes(value);
        return (
          <button type="button" aria-pressed={on} className={on ? "on" : ""} onClick={() => toggle(value)} key={value}>
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
  );
}

export function MoveInStep({ draft, update, today }: StepProps & { today: string }) {
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
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        <span>
          <b>더 꼼꼼하게 고르기</b>
          <small>{count > 0 ? `${count}개 선택됨` : "선택 · 안심 조건, 층수, 연식, 주변 시설"}</small>
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
        <h3>건물 연식</h3>
        <SingleChips
          label="건물 연식"
          choices={BUILDING_AGE_CHOICES}
          value={draft.buildingAge}
          onChange={(buildingAge) => update({ buildingAge })}
        />
        <p className="choice-desc">
          {BUILDING_AGE_CHOICES.find((choice) => choice.value === draft.buildingAge)?.description ?? "신축과 구축 모두 제안받아요"}
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
    draft.floorExclusions.length +
    draft.infrastructure.length +
    (draft.floorPreference !== "any" ? 1 : 0) +
    (draft.buildingAge !== "any" ? 1 : 0)
  );
}

export function VerifyStep({ draft, update }: StepProps) {
  const verified = draft.verificationStatus === "verified";
  return (
    <div className="verify">
      <i>
        <UserRound aria-hidden />
      </i>
      <h2>휴대폰 본인인증</h2>
      <p>
        중개사가 믿고 제안할 수 있도록
        <br />
        최초 요청 시 한 번만 인증해요.
      </p>
      <Button
        type="button"
        className={verified ? "done" : ""}
        onClick={() => update({ verificationStatus: "verified" })}
        disabled={verified}
      >
        {verified ? (
          <>
            <Check aria-hidden /> 인증 완료
          </>
        ) : (
          "휴대폰으로 인증하기"
        )}
      </Button>
      <small className="mock-note">프로토타입에서는 버튼을 누르면 인증이 완료돼요.</small>
      <label className="agree">
        <Checkbox checked={draft.privacyAgreed} onCheckedChange={(v) => update({ privacyAgreed: v === true })} />
        <span>개인정보 수집 및 매물 제안 전달에 동의합니다. (필수)</span>
      </label>
    </div>
  );
}
