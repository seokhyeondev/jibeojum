import { AlertCircle, Check } from "lucide-react";
import type { Recommendation } from "@/lib/recommend";

interface Props {
  recommendation: Recommendation;
  /** 카드처럼 공간이 좁으면 개수를 줄인다 */
  limit?: number;
}

export function ReasonList({ recommendation, limit }: Props) {
  const reasons = limit ? recommendation.reasons.slice(0, limit) : recommendation.reasons;
  const warnings = limit ? recommendation.warnings.slice(0, Math.max(1, limit - reasons.length)) : recommendation.warnings;
  if (reasons.length === 0 && warnings.length === 0) return null;
  return (
    <ul className="reasons" aria-label="추천 근거">
      {reasons.map((reason) => (
        <li key={reason} className="ok">
          <Check aria-hidden />
          {reason}
        </li>
      ))}
      {warnings.map((warning) => (
        <li key={warning} className="warn">
          <AlertCircle aria-hidden />
          {warning}
        </li>
      ))}
    </ul>
  );
}
