import { BellRing, Building2, Check, TrainFront, X } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/common/site-footer";

const START = "/request?step=1";

/** 직접 찾을 때 vs 집어줌으로 받을 때 */
const BEFORE = ["허위·중복 매물 사이에서 진짜 매물 찾기", "매물마다 지도 앱으로 출근시간 따로 계산", "어느 동네가 맞는지 하나하나 비교"];
const AFTER = ["동네 중개사가 확인한 매물만 받아요", "출근시간이 계산된 채로 도착해요", "출근하기 좋은 동네를 먼저 골라드려요"];

const FLOW = ["출근지·예산 1분 입력", "근처 중개사가 매물 확인", "알림으로 제안 도착"];

/** 누구를 위한 서비스인지: 아이콘 카드 대신 짧은 체크 목록 */
const FOR_COMMUTERS = [
  { title: "실제 통근시간", body: "평일 아침 8시 대중교통 경로 기준" },
  { title: "환승 없는 동네까지", body: "조금 더 걸려도 갈아타지 않는 곳" },
  { title: "안심 조건", body: "여성 전용·공동현관 보안·CCTV" },
  { title: "확인된 매물만", body: "이미 나간 매물은 신고하면 바로 내려요" },
];

const FAQ = [
  { q: "이용료가 있나요?", a: "매물 요청과 제안 받기는 무료예요. 계약할 때 중개보수는 일반 부동산 거래와 같아요." },
  { q: "제 연락처가 중개사에게 바로 넘어가나요?", a: "아니요. 중개사는 출근지·예산 같은 조건만 보고 매물을 제안해요. 연락은 원하는 매물에 직접 문의할 때만 이어져요." },
  { q: "매물은 언제 도착하나요?", a: "요청을 보내면 근처 중개사에게 바로 전달되고, 24시간 안에 제안을 받는 것을 목표로 해요. 도착하면 알림으로 알려드려요." },
  { q: "조건을 나중에 바꿀 수 있나요?", a: "내 요청에서 언제든 수정하거나 취소할 수 있어요." },
];

/** 사용자 첫 화면. 서비스 설명 → 요청 시작 */
export function UserLanding() {
  return (
    <div className="lp">
      <section className="lp-hero">
        <span className="lp-eyebrow">출근 조건으로 찾는 전월세</span>
        <h1>
          출근지만 알려주세요.
          <br />
          맞는 집은 <em>중개사가 찾아올게요</em>
        </h1>
        <p>통근시간·예산·안심 조건에 맞는 매물을 동네 공인중개사가 직접 확인해서 보내드려요.</p>
        <Link href={START} className="lp-cta">
          1분 만에 매물 요청하기
        </Link>

        <div className="lp-preview" aria-label="제안 매물 예시">
          <span className="lp-tag">예시</span>
          <div className="lp-card">
            <i className="lp-time" aria-hidden>
              <b>14</b>
              <small>분</small>
            </i>
            <div>
              <b>역삼역 3분 채광 좋은 원룸</b>
              <strong>보증금 1,000 / 월 65</strong>
              <span>
                <TrainFront aria-hidden /> 출근 14분 · 환승 없음
              </span>
            </div>
          </div>
          <div className="lp-card dim">
            <i className="lp-time" aria-hidden>
              <b>19</b>
              <small>분</small>
            </i>
            <div>
              <b>선릉역 신축 오피스텔</b>
              <strong>보증금 2,000 / 월 70</strong>
              <span>
                <TrainFront aria-hidden /> 출근 19분 · 환승 1회
              </span>
            </div>
          </div>
          <div className="lp-toast">
            <BellRing aria-hidden /> 새 매물이 도착했어요
          </div>
        </div>
      </section>

      <section className="lp-section">
        <h2>출근하는 사람을 위해 만들었어요</h2>
        <ul className="lp-checks">
          {FOR_COMMUTERS.map((f) => (
            <li key={f.title}>
              <Check aria-hidden />
              <span>
                <b>{f.title}</b>
                <small>{f.body}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="lp-section">
        <h2>찾아다니지 말고, 받아보세요</h2>
        <div className="lp-ba">
          <div className="before">
            <span>직접 찾을 때</span>
            <ul>
              {BEFORE.map((t) => (
                <li key={t}>
                  <X aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="after">
            <span>집어줌</span>
            <ul>
              {AFTER.map((t) => (
                <li key={t}>
                  <Check aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <ol className="lp-flow">
          {FLOW.map((t, i) => (
            <li key={t}>
              <em>{i + 1}</em>
              {t}
            </li>
          ))}
        </ol>
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
        <Link href="/partners" className="lp-partner-link">
          <Building2 aria-hidden /> 공인중개사이신가요? 집어줌과 함께하기
        </Link>
      </SiteFooter>

      <div className="lp-sticky">
        <Link href={START} className="lp-cta">
          매물 요청 시작하기
        </Link>
      </div>
    </div>
  );
}
