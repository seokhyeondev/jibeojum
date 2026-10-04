import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  error: Error;
  onRetry: () => void;
}

/** 서버 오류나 네트워크 오류. 화면의 다른 상태는 그대로 두고 다시 시도만 하게 한다. */
export function ErrorState({ error, onRetry }: Props) {
  return (
    <div className="empty-state" role="alert">
      <i aria-hidden>
        <WifiOff />
      </i>
      <h2>정보를 불러오지 못했어요</h2>
      <p>{error.message}</p>
      <Button className="primary wide" onClick={onRetry}>
        <RefreshCw aria-hidden /> 다시 시도
      </Button>
    </div>
  );
}
