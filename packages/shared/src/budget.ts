/**
 * 월세 예산 판단. 보증금을 덜 내면 그만큼 월세를 더 낼 수 있다고 본다 (전월세 전환).
 * 보증금 1,000만원당 월세 5만원: 상한이 보증금 3,000 / 월세 50이면 보증금 1,000짜리는 월세 60까지 맞음.
 * 보증금이 상한보다 많은 집은 월세가 싸도 맞지 않는다 (가진 목돈을 넘으므로).
 */
export const RENT_PER_DEPOSIT = 5 / 1000;

/** 이 보증금일 때 낼 수 있는 월세 상한 (만원). 보증금이 상한을 넘으면 null */
export function allowedMonthlyRent(depositMax: number, monthlyRentMax: number, deposit: number): number | null {
  if (deposit > depositMax) return null;
  return monthlyRentMax + (depositMax - deposit) * RENT_PER_DEPOSIT;
}

/** 보증금·월세가 월세 예산 안인지 (전월세 전환 적용, flex배만큼 상한을 늘려서) */
export function fitsMonthlyBudget(
  deposit: number,
  monthlyRent: number,
  depositMax: number,
  monthlyRentMax: number,
  flex = 1,
): boolean {
  const allowed = allowedMonthlyRent(depositMax * flex, monthlyRentMax * flex, deposit);
  return allowed !== null && monthlyRent <= allowed;
}
