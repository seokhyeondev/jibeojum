import { mockAgents, mockListings } from "@/data/mock-listings";
import type { Agent } from "@/types/agent";
import type { Listing } from "@/types/listing";

// 매물 데이터 공급자. 지금은 샘플을 돌려주고, 서버 API가 생기면
// 같은 함수 시그니처로 /api/requests/:id/proposals 등을 호출하도록 교체한다.

export function getProposedListings(): Listing[] {
  return mockListings;
}

export function getListing(id: string): Listing | undefined {
  return mockListings.find((listing) => listing.id === id);
}

export function getAgent(id: string): Agent | undefined {
  return mockAgents.find((agent) => agent.id === id);
}

export function getListingIds(): string[] {
  return mockListings.map((listing) => listing.id);
}
