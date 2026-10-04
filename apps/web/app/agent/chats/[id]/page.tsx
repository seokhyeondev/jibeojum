import { AgentChatPage } from "@/components/ops/agent-chats";

export default async function AgentChatRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentChatPage id={id} />;
}
