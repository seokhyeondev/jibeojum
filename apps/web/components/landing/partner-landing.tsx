import { BellRing, Building2, Check, FileCheck2, MapPin, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/common/site-footer";
import { SITE } from "@/lib/site";

const SIGNUP = "/agent/signup";

const STEPS = [
  { title: "1분 가입", body: "아이디, 이름, 연락처, 사무소 주소만 있으면 돼요." },
  { title: "우리 동네 요청 받기", body: "출근지를 기준으로 사무소 동네에서 집을 찾는 고객이 있으면 집어줌이 요청을 보내드려요." },
  { title: "맞는 매물만 제안", body: "조건에 맞는 매물을 사진과 함께 올리면 고객에게 바로 알림이 가요." },
];

const FAQ = [
  { q: "고객 연락처는 언제 받나요?", a: "고객이 올려주신 매물을 보고 문의하면 연결돼요. 요청 단계에서는 출근지·예산 같은 조건만 공개돼요." },
  { q: "중개보수는 어떻게 되나요?", a: "기존과 같아요. 계약과 중개보수는 고객과 직접 진행하시면 돼요." },
  { q: "우리 지역도 되나요?", a: "수도권으로 출근하는 고객 요청부터 받고 있어요. 고객의 출근지에서 다니기 좋은 동네를 골라, 그 동네 사무소에 요청을 보내드려요." },
];

/** 공인중개사 소개 페이지 (영업 연락할 때 함께 보내는 링크) */
export function PartnerLanding() {
  return (
    <div className="lp lp-partner">
      <header className="lp-top">
        <Link href="/partners" className="lp-brand">
          <i>
            <Building2 aria-hidden />
          </i>
          {SITE.name} <span>공인중개사</span>
        </Link>
        <Link href="/agent/login" className="lp-login">
          로그인
        </Link>
      </header>

      <section className="lp-hero">
        <span className="lp-eyebrow">공인중개사를 위한 집어줌</span>
        <h1>
          광고비 없이,
          <br />
          <em>이사가 정해진 고객</em>에게
          <br />
          매물을 제안하세요
        </h1>
        <p>출근지·예산·입주일이 확정된 고객 요청을 보고, 조건에 맞는 매물만 골라 보내면 돼요.</p>
        <Link href={SIGNUP} className="lp-cta">
          무료로 가입하기
        </Link>
      </section>

      <section className="lp-section">
        <h2>문의를 기다리지 말고, 요청을 골라보세요</h2>
        <div className="lp-compare">
          <div>
            <b>매물 광고</b>
            <ul>
              <li>
                <X aria-hidden /> 매달 나가는 고정 광고비
              </li>
              <li>
                <X aria-hidden /> 문의가 오기를 기다려야 해요
              </li>
              <li>
                <X aria-hidden /> 조건이 안 맞는 문의가 많아요
              </li>
            </ul>
          </div>
          <div className="on">
            <b>집어줌</b>
            <ul>
              <li>
                <Check aria-hidden /> 광고비 없이 시작
              </li>
              <li>
                <Check aria-hidden /> 고객 요청을 먼저 보고 골라요
              </li>
              <li>
                <Check aria-hidden /> 예산·입주일이 정해진 고객만
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <h2>이런 요청이 들어와요</h2>
        <div className="lp-request" aria-label="고객 요청 예시">
          <span className="lp-tag">예시</span>
          <b>강남역 출근 · 맞춤 매물 요청</b>
          <p>
            <MapPin aria-hidden /> 신림역권 · 서원동 근처
          </p>
          <ul>
            <li>보증금 1,000만 · 월세 60만 이하</li>
            <li>원룸 · 오피스텔</li>
            <li>11월 초 입주 · 엘리베이터 · 공동현관 보안</li>
          </ul>
          <small>고객 이름·연락처는 요청 단계에서 공개되지 않아요.</small>
        </div>
      </section>

      <section className="lp-section">
        <h2>이렇게 시작해요</h2>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <em>{i + 1}</em>
              <span>
                <b>{s.title}</b>
                <small>{s.body}</small>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-section">
        <h2>성실한 중개사가 손해 보지 않게</h2>
        <ul className="lp-list">
          <li>
            <i aria-hidden>
              <FileCheck2 />
            </i>
            <span>
              <b>올린 매물이 묻히지 않아요</b>
              <small>요청마다 배정된 중개사만 제안할 수 있어서, 고객은 몇 개의 제안만 받아요. 광고 수십 개 사이에서 경쟁하지 않아도 돼요.</small>
            </span>
          </li>
          <li>
            <i aria-hidden>
              <ShieldCheck />
            </i>
            <span>
              <b>허위·거래완료 매물은 신고로 정리</b>
              <small>고객 신고를 운영팀이 확인해 반복되는 허위 매물을 걸러내요.</small>
            </span>
          </li>
          <li>
            <i aria-hidden>
              <BellRing />
            </i>
            <span>
              <b>올리면 바로 알림</b>
              <small>매물을 올리는 순간 고객에게 알림이 가고, 출근시간도 자동으로 계산돼 보여요.</small>
            </span>
          </li>
        </ul>
      </section>

      <section className="lp-section">
        <h2>자주 묻는 질문</h2>
        <div className="lp-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <SiteFooter>
        <Link href="/" className="lp-partner-link">
          집을 찾고 계신가요? 고객용 서비스 보기
        </Link>
      </SiteFooter>

      <div className="lp-sticky">
        <Link href={SIGNUP} className="lp-cta">
          무료로 가입하기
        </Link>
      </div>
    </div>
  );
}
