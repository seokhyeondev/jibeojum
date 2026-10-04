export interface CommuteSummary {
  totalMinutes: number;
  walkMinutes: number;
  busMinutes: number;
  subwayMinutes: number;
  transferCount: number;
  fare?: number;
  routeSummary: string;
  calculatedAt: string;
  provider: "odsay" | "internal";
}
