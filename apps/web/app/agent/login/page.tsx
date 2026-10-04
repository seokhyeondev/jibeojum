import { Suspense } from "react";
import { AgentLogin } from "@/components/ops/agent-pages";

export default function AgentLoginPage() {
  return (
    <Suspense>
      <AgentLogin />
    </Suspense>
  );
}
