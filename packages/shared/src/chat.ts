import { z } from "zod";

// 고객 ↔ 공인중개사 채팅 (매물 하나당 대화 하나)

export type ChatSender = "user" | "agent";

export interface ChatMessageView {
  id: string;
  sender: ChatSender;
  body: string;
  createdAt: string;
}

/** 대화 목록 한 줄 */
export interface ChatThreadSummary {
  id: string;
  listing: { id: string; title: string; imageUrl: string | null; price: string };
  /** 고객이 보면 공인중개사, 공인중개사가 보면 요청 요약 */
  counterpart: string;
  lastMessage: ChatMessageView | null;
  /** 내가 아직 안 읽은 상대 메시지 수 */
  unread: number;
  lastMessageAt: string;
}

/** 고객이 매물 화면에서 여는 대화. 아직 보낸 적 없으면 threadId가 null */
export interface UserChat {
  threadId: string | null;
  messages: ChatMessageView[];
  /** 상대가 마지막으로 읽은 시각 (내 메시지 "읽음" 표시) */
  counterpartReadAt: string | null;
}

/** 공인중개사가 보는 대화 */
export interface AgentChat {
  id: string;
  listing: ChatThreadSummary["listing"];
  /** 고객 요청 요약 (개인정보 없음) */
  request: { destinationLabel: string; summary: string };
  messages: ChatMessageView[];
  counterpartReadAt: string | null;
}

export const chatMessageSchema = z.object({
  body: z.string({ required_error: "메시지를 입력해주세요" }).trim().min(1, "메시지를 입력해주세요").max(1000, "메시지는 1000자까지 보낼 수 있어요"),
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
