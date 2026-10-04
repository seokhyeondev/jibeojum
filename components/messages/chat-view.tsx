"use client";

import { MessageCircle } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { SimpleHead } from "@/components/navigation/simple-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAgent, getListing } from "@/lib/api/listings";
import { formatPrice } from "@/lib/format";
import { useMessages } from "@/lib/store/app-store";
import type { Listing } from "@/types/listing";

const QUICK_MESSAGES = ["이번 주말 방문 가능할까요?", "보증금 조정이 가능할까요?", "실제 관리비가 궁금해요"];

export function ChatView() {
  const listingId = useSearchParams().get("listing");
  const listing = listingId ? getListing(listingId) : undefined;
  if (!listing) {
    return (
      <section className="chat">
        <SimpleHead title="중개사 문의" fallbackHref="/listings" />
        <EmptyState
          icon={<MessageCircle />}
          title="문의할 매물을 골라주세요"
          description="매물 상세에서 문의·방문 요청을 누르면 중개사와 대화할 수 있어요."
          actionLabel="매물 목록 보기"
          actionHref="/listings"
        />
      </section>
    );
  }
  return <Conversation listing={listing} />;
}

function Conversation({ listing }: { listing: Listing }) {
  const agent = getAgent(listing.agentId);
  const { messages, send } = useMessages(listing.id);
  const [text, setText] = useState("");

  const submit = (body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    send(trimmed);
    setText("");
  };

  return (
    <section className="chat">
      <SimpleHead title="중개사 문의" fallbackHref={`/listings/${listing.id}`} />
      <div className="chat-house">
        <Image src={listing.images[0].src} alt="" width={72} height={56} />
        <span>
          <b>{listing.title}</b>
          <small>{formatPrice(listing)}</small>
        </span>
      </div>
      <div className="hello">
        <i>{agent?.name.slice(0, 1) ?? "중"}</i>
        <p>
          <b>{agent ? `${agent.name} 공인중개사` : "담당 중개사"}</b>
          <br />
          안녕하세요. 궁금한 점을 남겨주시면
          <br />
          확인 후 연락드리겠습니다.
        </p>
      </div>
      <div className="quick">
        {QUICK_MESSAGES.map((message) => (
          <button type="button" key={message} onClick={() => submit(message)}>
            {message}
          </button>
        ))}
      </div>
      <div className="messages" aria-live="polite">
        {messages.map((message) => (
          <div className="sent" key={message.id}>
            {message.body}
          </div>
        ))}
        {messages.length > 0 && <small className="mock-note">프로토타입에서는 메시지가 실제로 전달되지 않아요.</small>}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <Input
          placeholder="메시지를 입력해주세요"
          aria-label="메시지"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <Button type="submit" disabled={!text.trim()}>
          보내기
        </Button>
      </form>
    </section>
  );
}
