import { Suspense } from "react";
import { AgentSignup } from "@/components/ops/agent-pages";

export default function AgentSignupPage() {
  return (
    <Suspense>
      <AgentSignup />
    </Suspense>
  );
}
