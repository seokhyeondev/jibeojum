import { Check, Home, Search } from "lucide-react";

export function RequestTimeline() {
  return (
    <div className="timeline">
      <div className="done">
        <i>
          <Check aria-hidden />
        </i>
        <span>
          <b>요청 접수</b>
          <small>조건 확인 완료</small>
        </span>
      </div>
      <div className="active">
        <i>
          <Search aria-hidden />
        </i>
        <span>
          <b>매물 매칭 중</b>
          <small>중개사에게 확인하고 있어요</small>
        </span>
      </div>
      <div>
        <i>
          <Home aria-hidden />
        </i>
        <span>
          <b>제안 도착</b>
          <small>확인되는 대로 알려드려요</small>
        </span>
      </div>
    </div>
  );
}
