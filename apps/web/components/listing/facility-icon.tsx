import { Coffee, Cross, Dumbbell, ShoppingCart, Store, Trees, WashingMachine, type LucideIcon } from "lucide-react";
import type { InfraId } from "@zipazum/shared";

/** 주변 시설 종류별 아이콘과 색. 지도 핀과 목록이 같은 것을 쓴다 */
export const FACILITY_ICON: Record<InfraId, { Icon: LucideIcon; color: string }> = {
  convenience_store: { Icon: Store, color: "#f08c00" },
  mart: { Icon: ShoppingCart, color: "#7048e8" },
  hospital: { Icon: Cross, color: "#e03131" },
  park: { Icon: Trees, color: "#2f9e44" },
  gym: { Icon: Dumbbell, color: "#364fc7" },
  laundry: { Icon: WashingMachine, color: "#1c7ed6" },
  cafe: { Icon: Coffee, color: "#8d5a3b" },
};

export function FacilityIcon({ type, className = "facility-icon" }: { type: InfraId; className?: string }) {
  const { Icon, color } = FACILITY_ICON[type];
  return (
    <i className={className} style={{ background: color }} aria-hidden>
      <Icon />
    </i>
  );
}
