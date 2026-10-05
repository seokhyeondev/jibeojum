import { AgentAssignmentPage } from "@/components/ops/agent-assignment";

export default async function AgentAssignmentRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentAssignmentPage id={id} />;
}
