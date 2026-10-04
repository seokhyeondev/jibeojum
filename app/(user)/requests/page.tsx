import { Hydrated } from "@/components/common/hydrated";
import { MyRequests } from "@/components/request/my-requests";

export default function RequestsPage() {
  return (
    <Hydrated>
      <MyRequests />
    </Hydrated>
  );
}
