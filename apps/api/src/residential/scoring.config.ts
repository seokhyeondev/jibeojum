import type { RentSource } from "./rent-normalize.js";

/**
 * 주거 앵커 점수 규칙. 머신러닝 없이 설명 가능한 가중치만 쓴다.
 * 값을 바꾼 뒤 `pnpm pipeline:anchors`를 다시 실행하면 반영된다.
 */
export const SCORING = {
  /** H3 해상도 8: 셀 한 변 약 460m, 면적 약 0.74㎢ */
  h3Resolution: 8,
  /** 거래 1건당 점수. 원룸·투룸·오피스텔 수요에 가까운 유형일수록 높다 */
  transactionWeight: { offi: 3, rh: 2, apt: 1, sh: 0 } satisfies Record<RentSource, number>,
  /** 전용 40㎡ 이하(원룸·투룸) 거래 1건당 추가 점수 */
  smallUnitBonus: 1,
  smallUnitMaxAreaM2: 40,
  /** 같은 법정동 단독다가구 거래(위치 미공개)는 log 스케일로만 더한다 */
  dongDetachedWeight: 2,
  /** 이보다 작으면 앵커로 만들지 않는다 */
  minBuildings: 2,
  minTransactions: 5,
  /** 정확한 weighted medoid를 계산할 최대 건물 수. 넘으면 가중 중심에 가장 가까운 건물로 근사 */
  exactMedoidMaxBuildings: 300,
} as const;
