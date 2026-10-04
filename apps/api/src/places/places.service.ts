import { Injectable } from "@nestjs/common";
import type { PlaceCandidate } from "@zipazum/shared";
import { PlaceSearch } from "./place-search.js";

const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 500;

/** 출근지 검색. 같은 검색어는 10분 동안 외부 API를 다시 부르지 않는다. */
@Injectable()
export class PlacesService {
  private readonly search = new PlaceSearch(process.env);
  private readonly cache = new Map<string, { at: number; places: PlaceCandidate[] }>();

  async find(query: string, limit = 6): Promise<PlaceCandidate[]> {
    const key = `${query.trim().replace(/\s+/g, " ")}|${limit}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.places;
    const places = await this.search.search(query, limit);
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(key, { at: Date.now(), places });
    return places;
  }
}
