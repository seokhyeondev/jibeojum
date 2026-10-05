import { AgentInvitePage } from "@/components/ops/agent-invite";

export default async function AgentInviteRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AgentInvitePage token={token} />;
}
