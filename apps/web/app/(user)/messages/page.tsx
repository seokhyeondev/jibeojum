import { Suspense } from "react";
import { Hydrated } from "@/components/common/hydrated";
import { ChatView } from "@/components/messages/chat-view";

export default function MessagesPage() {
  return (
    <Suspense>
      <Hydrated>
        <ChatView />
      </Hydrated>
    </Suspense>
  );
}
