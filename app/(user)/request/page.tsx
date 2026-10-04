import { Suspense } from "react";
import { Hydrated } from "@/components/common/hydrated";
import { RequestForm } from "@/components/request/request-form";

export default function RequestPage() {
  return (
    <Suspense>
      <Hydrated>
        <RequestForm />
      </Hydrated>
    </Suspense>
  );
}
