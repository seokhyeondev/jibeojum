"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { REQUEST_STEP_COUNT, firstInvalidStep, toHousingRequest, validateStep } from "@/lib/schema/request";
import { createId, useDraft, useSubmittedRequest } from "@/lib/store/app-store";
import {
  BudgetStep,
  CommuteStep,
  HousingTypeStep,
  MoveInStep,
  STEP_COPY,
  VerifyStep,
} from "./request-steps";

function readStep(raw: string | null): number {
  const step = Number(raw);
  return Number.isInteger(step) && step >= 1 && step <= REQUEST_STEP_COUNT ? step : 1;
}

// 입력 단계 사이를 앞으로 이동한 횟수. "이전"이 브라우저 히스토리와 어긋나지 않게 쓴다.
let forwardSteps = 0;

function todayInSeoul(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function RequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { draft, update } = useDraft();
  const [, setRequest] = useSubmittedRequest();
  const [attemptedStep, setAttemptedStep] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [today] = useState(todayInSeoul);

  // 앞 단계가 비어 있으면 URL로 건너뛰어도 그 단계부터 보여준다.
  const requested = readStep(searchParams.get("step"));
  const blocked = firstInvalidStep(draft);
  const step = blocked !== null && blocked < requested ? blocked : requested;
  const error = validateStep(draft, step);
  const showError = error !== null && attemptedStep === step;
  const copy = STEP_COPY[step - 1];

  const goForward = () => {
    setAttemptedStep(null);
    forwardSteps++;
    router.push(`/request?step=${step + 1}`);
  };

  const goBack = () => {
    setAttemptedStep(null);
    if (forwardSteps > 0) {
      forwardSteps--;
      router.back();
    } else {
      router.replace(`/request?step=${step - 1}`);
    }
  };

  const submit = () => {
    if (submittingRef.current) return;
    const request = toHousingRequest(draft, createId("req"), new Date().toISOString());
    if (!request) return;
    submittingRef.current = true;
    setSubmitting(true);
    setRequest(request);
    forwardSteps = 0;
    router.push("/request/complete");
  };

  const next = () => {
    if (error) {
      setAttemptedStep(step);
      return;
    }
    if (step < REQUEST_STEP_COUNT) goForward();
    else submit();
  };

  const stepProps = { draft, update };
  const nextLabel =
    step === REQUEST_STEP_COUNT ? (submitting ? "요청 중..." : "매물 요청하기") : "다음";

  return (
    <section className="flow">
      <div className="progress-label">
        <span>맞춤 매물 요청</span>
        <b>
          {step}/{REQUEST_STEP_COUNT}
        </b>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={REQUEST_STEP_COUNT}
        aria-valuenow={step}
        aria-label="요청 진행 단계"
      >
        <i style={{ width: `${(step / REQUEST_STEP_COUNT) * 100}%` }} />
      </div>
      <div className="heading">
        <span>STEP {step}</span>
        <h1>{copy.title}</h1>
        <p>{copy.sub}</p>
      </div>
      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        {step === 1 && <CommuteStep {...stepProps} />}
        {step === 2 && <BudgetStep {...stepProps} />}
        {step === 3 && <HousingTypeStep {...stepProps} />}
        {step === 4 && <MoveInStep {...stepProps} today={today} />}
        {step === 5 && <VerifyStep {...stepProps} />}
        {showError && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={goBack}>
              이전
            </Button>
          )}
          <Button type="submit" disabled={submitting}>
            {nextLabel}
          </Button>
        </div>
      </form>
    </section>
  );
}
