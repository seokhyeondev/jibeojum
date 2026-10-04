import { BellRing, Building2, Clock3, MapPinned, Search, ShieldCheck, TrainFront, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/site";

const START = "/request?step=1";

const PAINS = [
  { icon: <Search />, title: "올라온 매물 절반이 허위·중복", body: "연락해보면 이미 나간 집, 같은 집이 여러 번 올라온 광고." },
  { icon: <TrainFront />, title: "출근시간은 내가 직접 계산", body: "매물마다 지도 앱을 열어 환승·도보 시간을 따로 찾아봐야 해요." },
  { icon: <Clock3 />, title: "매일 앱을 새로고침", body: "좋은 매물은 금방 나가니 퇴근 후에도 계속 들여다보게 돼요." },
];

const STEPS = [
  { title: "출근지·예산 입력", body: "회사 위치, 최대 통근시간, 예산, 집 유형만 1분이면 끝나요." },
  { title: "근처 중개사가 매물 확인", body: "출근하기 좋은 동네를 골라 그 동네 공인중개사가 조건에 맞는 실제 매물을 확인해요." },
  { title: "알림으로 제안 도착", body: "도착한 매물을 통근시간과 함께 비교하고, 마음에 들면 바로 문의하세요." },
];

const FEATURES = [
  { icon: <TrainFront />, title: "실제 통근시간", body: "평일 아침 출근 시간 기준 대중교통 경로로 계산해요." },
  { icon: <MapPinned />, title: "환승 없는 동네까지", body: "조금 더 걸려도 갈아타지 않는 동네를 같이 찾아드려요." },
  { icon: <ShieldCheck />, title: "안심 조건", body: "여성 전용 건물, 공동현관 보안, CCTV 같은 조건도 골라요." },
  { icon: <Users />, title: "중개사가 확인한 매물만", body: "이미 나간 매물은 신고할 수 있고, 확인되면 바로 내려요." },
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
        <small>무료 · 카카오로 시작</small>

        <div className="lp-preview" aria-label="제안 매물 예시">
          <span className="lp-tag">예시</span>
          <div className="lp-card">
            <Image src="/room-1.png" alt="" width={112} height={84} />
            <div>
              <b>역삼역 3분 채광 좋은 원룸</b>
              <strong>보증금 1,000 / 월 65</strong>
              <span>
                <TrainFront aria-hidden /> 출근 14분 · 환승 없음
              </span>
            </div>
          </div>
          <div className="lp-card dim">
            <Image src="/room-2.png" alt="" width={112} height={84} />
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
        <h2>집 구하기, 이게 제일 힘들죠</h2>
        <ul className="lp-list">
          {PAINS.map((p) => (
            <li key={p.title}>
              <i aria-hidden>{p.icon}</i>
              <span>
                <b>{p.title}</b>
                <small>{p.body}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="lp-section">
        <span className="lp-eyebrow">이렇게 바뀌어요</span>
        <h2>찾아다니지 말고, 받아보세요</h2>
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
        <h2>출근하는 사람을 위해 만들었어요</h2>
        <div className="lp-grid">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <i aria-hidden>{f.icon}</i>
              <b>{f.title}</b>
              <small>{f.body}</small>
            </div>
          ))}
        </div>
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

      <footer className="lp-footer">
        <Link href="/partners" className="lp-partner-link">
          <Building2 aria-hidden /> 공인중개사이신가요? 집어줌과 함께하기
        </Link>
        <small>
          {SITE.name} · 문의 <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
        </small>
      </footer>

      <div className="lp-sticky">
        <Link href={START} className="lp-cta">
          매물 요청 시작하기
        </Link>
      </div>
    </div>
  );
}
