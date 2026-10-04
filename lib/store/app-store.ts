"use client";

import { z } from "zod";
import { housingRequestSchema, requestDraftSchema } from "@/lib/schema/request";
import type { HousingRequest, RequestDraft } from "@/types/request";
import { createPersistentStore, usePersistentStore } from "./persistent-store";

export const DEFAULT_DRAFT: RequestDraft = {
  commuteDestination: { label: "강남역" },
  maxCommuteMinutes: 40,
  noTransferExtraMinutes: 10,
  depositMax: 5000,
  monthlyRentMax: 130,
  budgetFlexibility: "fixed",
  housingTypes: ["studio", "officetel", "two_room"],
  moveInDate: "2026-10-25",
  moveInFlexibility: "within_7_days",
  requiredOptions: ["station", "elevator"],
  floorPreference: "any",
  floorExclusions: [],
  buildingAge: "any",
  safetyOptions: [],
  infrastructure: [],
  verificationStatus: "pending",
  privacyAgreed: false,
};

export interface SentMessage {
  id: string;
  body: string;
  sentAt: string;
}

const MAX_COMPARE = 2;

const draftStore = createPersistentStore<RequestDraft>("jiponda:draft:v1", DEFAULT_DRAFT, (raw) => {
  const parsed = requestDraftSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
});

const requestStore = createPersistentStore<HousingRequest | null>("jiponda:request:v1", null, (raw) => {
  const parsed = housingRequestSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
});

const stringList = z.array(z.string());
const parseStringList = (raw: unknown) => {
  const parsed = stringList.safeParse(raw);
  return parsed.success ? parsed.data : null;
};
const favoritesStore = createPersistentStore<string[]>("jiponda:favorites:v1", [], parseStringList);
const compareStore = createPersistentStore<string[]>("jiponda:compare:v1", [], (raw) => {
  const list = parseStringList(raw);
  return list ? list.slice(-MAX_COMPARE) : null;
});

const messagesSchema = z.record(
  z.array(z.object({ id: z.string(), body: z.string(), sentAt: z.string() })),
);
const messagesStore = createPersistentStore<Record<string, SentMessage[]>>(
  "jiponda:messages:v1",
  {},
  (raw) => {
    const parsed = messagesSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
);

export function useDraft() {
  const [draft, setDraft] = usePersistentStore(draftStore);
  const update = (patch: Partial<RequestDraft>) => setDraft((prev) => ({ ...prev, ...patch }));
  return { draft, update };
}

export function useSubmittedRequest() {
  return usePersistentStore(requestStore);
}

export function useFavorites() {
  const [favorites, setFavorites] = usePersistentStore(favoritesStore);
  const toggle = (id: string) =>
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
  const send = (body: string) =>
    setAll((prev) => ({
      ...prev,
      [listingId]: [...(prev[listingId] ?? []), { id: createId("msg"), body, sentAt: new Date().toISOString() }],
    }));
  return { messages: all[listingId] ?? [], send };
}

export function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}
