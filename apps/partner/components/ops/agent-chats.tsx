"use client";

import type { ChatMessageView } from "@zipazum/shared";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { agentApi } from "@/lib/api/ops";
import { OpsShell } from "./ops-shell";
import { errorText, useOpsQuery } from "./use-ops-query";

const timeText = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });

/** 고객 문의 목록 */
export function AgentChats() {
  const { data, isPending, error } = useOpsQuery("agent", ["chats"], agentApi.chats, { refetchInterval: 15_000 });
  return (
    <OpsShell kind="agent">
      <div className="ops-head">
        <h1>고객 문의</h1>
        <p>올린 매물을 보고 고객이 보낸 메시지예요. 답장하면 고객에게 알림이 가요.</p>
      </div>
      {isPending && <p className="ops-muted">불러오는 중…</p>}
      {error && <p className="ops-error">{errorText(error)}</p>}
      {data && data.length === 0 && <p className="ops-muted">아직 문의가 없어요. 매물을 올리면 고객이 여기로 문의해요.</p>}
      {data && data.length > 0 && (
        <ul className="ops-chat-list">
          {data.map((t) => (
            <li key={t.id}>
              <Link href={`/agent/chats/${t.id}`} className={t.unread ? "unread" : ""}>
                {t.listing.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 매물 대표 사진 (CloudFront)
                  <img src={t.listing.imageUrl} alt="" />
                ) : (
                  <i aria-hidden>
                    <MessageCircle />
                  </i>
                )}
                <span>
                  <b>{t.listing.title}</b>
                  <small>
                    {t.counterpart} · {t.listing.price}
                  </small>
                  <p>{t.lastMessage ? `${t.lastMessage.sender === "agent" ? "나: " : ""}${t.lastMessage.body}` : ""}</p>
                </span>
                <span className="ops-chat-meta">
                  <small>{timeText(t.lastMessageAt)}</small>
                  {t.unread > 0 && <em>{t.unread}</em>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OpsShell>
  );
}

/** 고객과의 대화. 열어둔 동안 4초마다 새 메시지를 확인한다 */
export function AgentChatPage({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: chat, isPending, error } = useOpsQuery("agent", ["chat", id], () => agentApi.chat(id), { refetchInterval: 4000 });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const lastId = chat?.messages.at(-1)?.id;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [lastId]);
  // 열면 읽음 처리되므로 메뉴 배지를 다시 센다
  useEffect(() => {
    if (lastId) void queryClient.invalidateQueries({ queryKey: ["agent", "chat-unread"] });
  }, [lastId, queryClient]);

  const submit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      queryClient.setQueryData(["agent", "chat", id], await agentApi.sendChat(id, body));
      setText("");
    } catch (err) {
      setSendError(errorText(err));
    } finally {
      setSending(false);
    }
  };

  const messages = chat?.messages ?? [];
  const lastMine = [...messages].reverse().find((m) => m.sender === "agent");
  const read = Boolean(lastMine && chat?.counterpartReadAt && chat.counterpartReadAt >= lastMine.createdAt);

  return (
    <OpsShell kind="agent">
      <Link href="/agent/chats" className="ops-back">
        ← 문의 목록
      </Link>
      {isPending && <p className="ops-muted">불러오는 중…</p>}
      {error && <p className="ops-error">{errorText(error)}</p>}
      {chat && (
        <div className="ops-card ops-chat">
          <div className="ops-chat-head">
            <b>{chat.listing.title}</b>
            <small>
              {chat.listing.price} · {chat.request.destinationLabel} 출근 고객 · {chat.request.summary}
            </small>
          </div>
          <div className="ops-chat-messages" aria-live="polite">
            {messages.map((m) => (
              <Bubble key={m.id} message={m} read={m.id === lastMine?.id && read} />
            ))}
            <div ref={bottom} />
          </div>
          {sendError && <p className="ops-error">{sendError}</p>}
          <form
            className="ops-chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <textarea
              className="ops-input"
              rows={2}
              maxLength={1000}
              aria-label="답장"
              placeholder="답장을 입력하세요 (Enter 보내기, Shift+Enter 줄바꿈)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <button type="submit" className="ops-btn primary" disabled={!text.trim() || sending}>
              보내기
            </button>
          </form>
        </div>
      )}
    </OpsShell>
  );
}

function Bubble({ message, read }: { message: ChatMessageView; read: boolean }) {
  const mine = message.sender === "agent";
  return (
    <div className={mine ? "ops-bubble mine" : "ops-bubble"}>
      <p>{message.body}</p>
      <small>
        {mine && read && <b>읽음 </b>}
        {timeText(message.createdAt)}
      </small>
    </div>
  );
}
