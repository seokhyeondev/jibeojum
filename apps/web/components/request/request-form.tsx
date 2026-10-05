"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, createRequest, updateRequest } from "@/lib/api/client";
import { REQUEST_STEP_COUNT, firstInvalidStep, toRequestInput, validateStep, type RequestInput } from "@zipazum/shared";
import { KakaoSymbol, useMe } from "@/components/auth/kakao-login";
import { startLogin } from "@/lib/native";
import { createId, useDraft, useSubmittedRequest } from "@/lib/store/app-store";
import {
  BudgetStep,
  CommuteStep,
  HousingTypeStep,
  MoveInStep,
  STEP_COPY,
  ReviewStep,
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
  const { draft, update, reset } = useDraft();
  const [request, setRequest] = useSubmittedRequest();
  const { data: me, isPending: meLoading } = useMe();
  const queryClient = useQueryClient();
  const clientKeyRef = useRef<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptedStep, setAttemptedStep] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [today] = useState(todayInSeoul);

  // 앞 단계가 비어 있으면 URL로 건너뛰어도 그 단계부터 보여준다.
  const requested = readStep(searchParams.get("step"));
  // 완료 화면의 "수정"으로 들어왔을 때만 기존 요청을 고친다. 그 밖에는 언제나 새 요청
  const editId = searchParams.get("edit");
  const editing = Boolean(editId && request?.id === editId && request.status !== "closed");
  const stepHref = (n: number) => `/request?step=${n}${editing ? `&edit=${editId}` : ""}`;
  const blocked = firstInvalidStep(draft);
  const step = blocked !== null && blocked < requested ? blocked : requested;
  const error = validateStep(draft, step);
  const showError = error !== null && attemptedStep === step;
  const copy = STEP_COPY[step - 1];

  const goForward = () => {
    setAttemptedStep(null);
    forwardSteps++;
    router.push(stepHref(step + 1));
  };

  const goBack = () => {
    setAttemptedStep(null);
    if (forwardSteps > 0) {
      forwardSteps--;
      router.back();
    } else {
      router.replace(stepHref(step - 1));
    }
  };

  /** 수정 모드면 그 요청을 고치고(서버에서 사라졌으면 새로 만든다), 아니면 새 요청을 만든다. */
  const save = async (input: RequestInput) => {
    clientKeyRef.current ??= createId("submit");
    if (editing && editId) {
      try {
        return await updateRequest(editId, input);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
    }
    return createRequest(input, clientKeyRef.current);
  };

  const submit = async () => {
    if (submittingRef.current) return;
    if (!me?.user) {
      setSubmitError("카카오로 로그인한 뒤 요청을 보낼 수 있어요.");
      return;
    }
    const input = toRequestInput(draft);
    if (!input) {
      setSubmitError("입력값을 다시 확인해주세요.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = await save(input);
      setRequest(saved);
      // 다음 요청은 빈 초안에서 시작한다
      reset();
      await queryClient.invalidateQueries({ queryKey: ["proposals", saved.id] });
      await queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      forwardSteps = 0;
      router.push("/request/complete");
    } catch (e) {
      // 입력값은 그대로 두고 다시 시도할 수 있게 한다.
      setSubmitError(e instanceof Error ? e.message : "잠시 후 다시 시도해주세요.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const next = () => {
    if (error) {
      setAttemptedStep(step);
      return;
    }
    if (step < REQUEST_STEP_COUNT) goForward();
    else void submit();
  };

  const stepProps = { draft, update };
  // 마지막 단계에서 로그인 전이면 제출 버튼이 "카카오로 로그인하고 요청하기"가 된다
  const needsLogin = step === REQUEST_STEP_COUNT && !meLoading && !me?.user;
  const autoSubmit = searchParams.get("submit") === "1";

  // 카카오 로그인 후 돌아오면 (입력은 브라우저에 남아 있다) 한 번만 자동으로 보낸다
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (!autoSubmit || autoSubmitted.current || step !== REQUEST_STEP_COUNT || !me?.user || error) return;
    autoSubmitted.current = true;
    void submit();
    // submit은 매 렌더 새로 만들어지지만 한 번만 부르므로 의존성에서 뺀다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmit, step, me?.user, error]);

  const loginAndSubmit = (provider: "kakao" | "apple" = "kakao") => {
    if (error) {
      setAttemptedStep(step);
      return;
    }
    void startLogin(provider, `${stepHref(REQUEST_STEP_COUNT)}&submit=1`);
  };
  const nextLabel =
    step === REQUEST_STEP_COUNT
      ? submitting
        ? "보내는 중..."
        : editing
          ? "요청 수정하기"
          : "매물 요청하기"
      : "다음";

  return (
    <section className="flow">
      <div className="progress-label">
        <span>{editing ? "요청 수정" : "맞춤 매물 요청"}</span>
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
        {step === 5 && <ReviewStep {...stepProps} onEdit={(n) => router.push(stepHref(n))} />}
        {(showError || submitError) && (
          <p className="field-error" role="alert">
            {showError ? error : submitError}
          </p>
        )}
        {needsLogin && me?.appleEnabled && (
          <button type="button" className="apple-alt" onClick={() => loginAndSubmit("apple")}>
            Apple로 로그인하고 요청하기
          </button>
        )}
        <div className="actions">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={goBack}>
              이전
            </Button>
          )}
          {needsLogin ? (
            <button type="button" className="kakao-submit" onClick={() => loginAndSubmit()}>
              <KakaoSymbol />
              카카오로 로그인하고 요청하기
            </button>
          ) : (
            <Button type="submit" disabled={submitting || (step === REQUEST_STEP_COUNT && meLoading)}>
              {nextLabel}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
