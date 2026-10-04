"use client";

import { z } from "zod";
import { DEFAULT_DRAFT, housingRequestSchema, requestDraftSchema } from "@zipazum/shared";
import type { HousingRequest, RequestDraft } from "@zipazum/shared";
import { reactToListing } from "@/lib/api/client";
import { createPersistentStore, usePersistentStore } from "./persistent-store";



export interface SentMessage {
  id: string;
  body: string;
  sentAt: string;
}

const MAX_COMPARE = 2;

const draftStore = createPersistentStore<RequestDraft>("zipazum:draft:v1", DEFAULT_DRAFT, (raw) => {
  const parsed = requestDraftSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
});

const requestStore = createPersistentStore<HousingRequest | null>("zipazum:request:v1", null, (raw) => {
  const parsed = housingRequestSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
});

const stringList = z.array(z.string());
const parseStringList = (raw: unknown) => {
  const parsed = stringList.safeParse(raw);
  return parsed.success ? parsed.data : null;
};
const favoritesStore = createPersistentStore<string[]>("zipazum:favorites:v1", [], parseStringList);
const compareStore = createPersistentStore<string[]>("zipazum:compare:v1", [], (raw) => {
  const list = parseStringList(raw);
  return list ? list.slice(-MAX_COMPARE) : null;
});

const messagesSchema = z.record(
  z.array(z.object({ id: z.string(), body: z.string(), sentAt: z.string() })),
);
const messagesStore = createPersistentStore<Record<string, SentMessage[]>>(
  "zipazum:messages:v1",
  {},
  (raw) => {
    const parsed = messagesSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
);

export function useDraft() {
  const [draft, setDraft] = usePersistentStore(draftStore);
  const update = (patch: Partial<RequestDraft>) => setDraft((prev) => ({ ...prev, ...patch }));
  const reset = (next: RequestDraft = DEFAULT_DRAFT) => setDraft(next);
  return { draft, update, reset };
}

export function useSubmittedRequest() {
  return usePersistentStore(requestStore);
}

export function useFavorites() {
  const [favorites, setFavorites] = usePersistentStore(favoritesStore);
  const toggle = (id: string) => {
    if (!favorites.includes(id)) reactToListing(id, "favorite");
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  return { favorites, toggle };
}

export type CompareToggleResult = "added" | "removed" | "replaced";

export function useCompare() {
  const [selected, setSelected] = usePersistentStore(compareStore);
  /** 세 번째를 고르면 먼저 담은 매물을 교체한다. */
  const toggle = (id: string): CompareToggleResult => {
    const result: CompareToggleResult = selected.includes(id)
      ? "removed"
      : selected.length < MAX_COMPARE
        ? "added"
        : "replaced";
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-MAX_COMPARE),
    );
    return result;
  };
  return { selected, toggle, max: MAX_COMPARE };
}

export function useMessages(listingId: string) {
  const [all, setAll] = usePersistentStore(messagesStore);
  const send = (body: string) => {
    reactToListing(listingId, "inquire");
    setAll((prev) => ({
      ...prev,
      [listingId]: [...(prev[listingId] ?? []), { id: createId("msg"), body, sentAt: new Date().toISOString() }],
    }));
  };
  return { messages: all[listingId] ?? [], send };
}

export function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}
