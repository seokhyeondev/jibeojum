import { housingRequestSchema, type HousingRequest, type RequestInput } from "@zipazum/shared";
import type { HousingRequest as HousingRequestRow, Prisma } from "../generated/prisma/client.js";

/** "2026-10-25" ↔ DATE 컬럼. 시간대 영향을 받지 않게 UTC 자정으로 다룬다. */
export const toDateColumn = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);
export const fromDateColumn = (date: Date) => date.toISOString().slice(0, 10);

export function toRequestColumns(input: RequestInput) {
  return {
    destinationLabel: input.commuteDestination.label,
    destinationAddress: input.commuteDestination.address ?? null,
    destinationLatitude: input.commuteDestination.latitude ?? null,
    destinationLongitude: input.commuteDestination.longitude ?? null,
    maxCommuteMinutes: input.maxCommuteMinutes,
    noTransferExtraMinutes: input.noTransferExtraMinutes,
    transactionPreference: input.transactionPreference,
    depositMax: input.depositMax,
    monthlyRentMax: input.monthlyRentMax,
    jeonseMax: input.jeonseMax,
    budgetFlexibility: input.budgetFlexibility,
    housingTypes: input.housingTypes,
    moveInDate: toDateColumn(input.moveInDate),
    moveInFlexibility: input.moveInFlexibility,
    requiredOptions: input.requiredOptions,
    floorPreference: input.floorPreference,
    floorExclusions: input.floorExclusions,
    buildingAge: input.buildingAge,
    minPyeong: input.minPyeong,
    safetyOptions: input.safetyOptions,
    directions: input.directions,
    infrastructure: input.infrastructure,
    // 휴대폰 인증 대신 카카오 로그인으로 확인한다 (요청 제출은 로그인한 사용자만)
    verificationStatus: "kakao",
  } satisfies Omit<Prisma.HousingRequestUncheckedCreateInput, "userId" | "clientKey">;
}

/** DB 행을 화면 계약으로 바꾼다. 형태가 어긋나면 예외를 던져 조용히 깨지지 않게 한다. */
export function toHousingRequest(row: HousingRequestRow): HousingRequest {
  return housingRequestSchema.parse({
    id: row.id,
    commuteDestination: {
      label: row.destinationLabel,
      address: row.destinationAddress,
      latitude: row.destinationLatitude,
      longitude: row.destinationLongitude,
    },
    maxCommuteMinutes: row.maxCommuteMinutes,
    noTransferExtraMinutes: row.noTransferExtraMinutes,
    transactionPreference: row.transactionPreference,
    depositMax: row.depositMax,
    monthlyRentMax: row.monthlyRentMax,
    jeonseMax: row.jeonseMax,
    budgetFlexibility: row.budgetFlexibility,
    housingTypes: row.housingTypes,
    moveInDate: fromDateColumn(row.moveInDate),
    moveInFlexibility: row.moveInFlexibility,
    requiredOptions: row.requiredOptions,
    floorPreference: row.floorPreference,
    floorExclusions: row.floorExclusions,
    buildingAge: row.buildingAge,
    minPyeong: row.minPyeong,
    safetyOptions: row.safetyOptions,
    directions: row.directions,
    infrastructure: row.infrastructure,
    status: row.status,
    submittedAt: row.submittedAt.toISOString(),
  });
}
