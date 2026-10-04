"use client";

import type { ChatMessageView, ProposedListing } from "@zipazum/shared";
import { formatPrice } from "@zipazum/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoginPrompt, useMe } from "@/components/auth/kakao-login";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingBlock } from "@/components/common/hydrated";
import { isExternal, listingImages } from "@/components/listing/listing-photo";
import { useListing } from "@/components/listing/use-recommendations";
import { SimpleHead } from "@/components/navigation/simple-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, fetchChat, fetchMyChats, sendChat } from "@/lib/api/client";

const QUICK_MESSAGES = ["이번 주말 방문 가능할까요?", "보증금 조정이 가능할까요?", "실제 관리비가 궁금해요"];
/** 대화를 열어둔 동안 새 메시지를 확인하는 간격 (실시간 연결 대신) */
const POLL_MS = 4000;

const timeText = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
const dayText = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

/** /messages: 매물을 고르고 들어오면 그 매물 대화, 아니면 대화 목록 */
export function ChatView() {
  const listingId = useSearchParams().get("listing");
  const { data: me, isPending: meLoading } = useMe();
  if (meLoading) return <LoadingBlock />;
  if (!me?.user) {
    return (
      <section className="chat">
        <SimpleHead title="중개사 문의" fallbackHref="/listings" />
        <LoginPrompt
          title="로그인하고 중개사와 대화하세요"
          description="매물에 대해 묻고 방문 일정을 잡을 수 있어요."
          returnTo={listingId ? `/messages?listing=${listingId}` : "/messages"}
        />
      </section>
    );
  }
  return listingId ? <ListingChat listingId={listingId} /> : <ChatList />;
}

function ChatList() {
  const { data, isPending, error, refetch } = useQuery({ queryKey: ["chats"], queryFn: fetchMyChats, refetchInterval: 15_000 });
  return (
    <section className="chat">
      <SimpleHead title="상담" fallbackHref="/listings" />
      {isPending && <LoadingBlock />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <EmptyState
          icon={<MessageCircle />}
          title="아직 나눈 대화가 없어요"
          description="도착한 매물 상세에서 문의·방문 요청을 누르면 중개사와 대화할 수 있어요."
          actionLabel="도착한 매물 보기"
          actionHref="/listings"
        />
      )}
      {data && data.length > 0 && (
        <ul className="chat-list">
          {data.map((t) => (
            <li key={t.id}>
              <Link href={`/messages?listing=${t.listing.id}`}>
                {t.listing.imageUrl ? (
                  <Image src={t.listing.imageUrl} alt="" width={56} height={56} unoptimized={isExternal(t.listing.imageUrl)} />
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
                  <p>{t.lastMessage ? `${t.lastMessage.sender === "user" ? "나: " : ""}${t.lastMessage.body}` : "아직 메시지가 없어요"}</p>
                </span>
                <span className="chat-meta">
                  <small>{timeText(t.lastMessageAt)}</small>
                  {t.unread > 0 && <em aria-label={`안 읽은 메시지 ${t.unread}개`}>{t.unread}</em>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ListingChat({ listingId }: { listingId: string }) {
  const { data: listing, isPending, error, refetch } = useListing(listingId);
  if (isPending) return <LoadingBlock />;
  if (error && !(error instanceof ApiError && error.status === 404)) {
    return (
      <section className="chat">
        <SimpleHead title="중개사 문의" fallbackHref="/messages" />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </section>
    );
  }
  if (!listing) {
    return (
      <section className="chat">
        <SimpleHead title="중개사 문의" fallbackHref="/messages" />
        <EmptyState icon={<MessageCircle />} title="대화할 매물을 찾을 수 없어요" description="거래가 끝났거나 내 요청에 제안된 매물이 아니에요." actionLabel="상담 목록" actionHref="/messages" />
      </section>
    );
  }
  return <Conversation listing={listing} />;
}

function Conversation({ listing }: { listing: ProposedListing }) {
  const { agent } = listing;
  const queryClient = useQueryClient();
  const key = ["chat", listing.id];
  const { data: chat } = useQuery({ queryKey: key, queryFn: () => fetchChat(listing.id), refetchInterval: POLL_MS });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const messages = chat?.messages ?? [];
  const lastId = messages.at(-1)?.id;

  // 새 메시지가 오면 맨 아래로
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  const submit = async (body: string) => {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      queryClient.setQueryData(key, await sendChat(listing.id, trimmed));
      setText("");
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "보내지 못했어요. 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  };

  // 내가 보낸 마지막 메시지가 상대에게 읽혔는지
  const lastMine = [...messages].reverse().find((m) => m.sender === "user");
  const readByAgent = Boolean(lastMine && chat?.counterpartReadAt && chat.counterpartReadAt >= lastMine.createdAt);

  return (
    <section className="chat">
      <SimpleHead title={`${agent.name} 공인중개사`} fallbackHref={`/listings/${listing.id}`} />
      <Link className="chat-house" href={`/listings/${listing.id}`}>
        <Image src={listingImages(listing.images)[0].src} alt="" width={72} height={56} unoptimized={isExternal(listingImages(listing.images)[0].src)} />
        <span>
          <b>{listing.title}</b>
          <small>{formatPrice(listing)}</small>
        </span>
      </Link>
      <div className="hello">
        <i>{agent.name.slice(0, 1)}</i>
        <p>
          <b>{agent.name} 공인중개사</b>
          {agent.officeName && <small> · {agent.officeName}</small>}
          <br />
          궁금한 점이나 방문 희망 일정을 남겨주세요.
          <br />
          확인하는 대로 답장드려요.
        </p>
      </div>
      {messages.length === 0 && (
        <div className="quick">
          {QUICK_MESSAGES.map((message) => (
            <button type="button" key={message} onClick={() => void submit(message)} disabled={sending}>
              {message}
            </button>
          ))}
        </div>
      )}
      <div className="messages" aria-live="polite">
        {messages.map((m, i) => (
          <Bubble key={m.id} message={m} showDay={i === 0 || dayText(messages[i - 1].createdAt) !== dayText(m.createdAt)} read={m.id === lastMine?.id && readByAgent} />
        ))}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div ref={bottom} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(text);
        }}
      >
        <Input placeholder="메시지를 입력해주세요" aria-label="메시지" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
        <Button type="submit" disabled={!text.trim() || sending}>
          보내기
        </Button>
      </form>
    </section>
  );
}

function Bubble({ message, showDay, read }: { message: ChatMessageView; showDay: boolean; read: boolean }) {
  const mine = message.sender === "user";
  return (
    <>
      {showDay && <p className="chat-day">{dayText(message.createdAt)}</p>}
      <div className={mine ? "bubble-row mine" : "bubble-row"}>
        <div className={mine ? "sent" : "received"}>{message.body}</div>
        <small>
          {mine && read && <b>읽음 </b>}
          {timeText(message.createdAt)}
        </small>
      </div>
    </>
  );
}
