"use client";

import { useCallback, useSyncExternalStore } from "react";

type Updater<T> = T | ((prev: T) => T);

export interface PersistentStore<T> {
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
  set: (next: Updater<T>) => void;
}

/**
 * localStorage에 저장되는 작은 외부 스토어.
 * 서버 렌더와 첫 하이드레이션에는 초기값을 쓰고, 이후 저장값으로 교체된다.
 * 저장소가 막혀 있거나 값이 깨져 있으면 초기값으로 동작한다.
 */
export function createPersistentStore<T>(
  key: string,
  initial: T,
  parse: (raw: unknown) => T | null,
): PersistentStore<T> {
  let state = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) state = parse(JSON.parse(raw)) ?? initial;
    } catch {
      state = initial;
    }
  };

  const emit = () => listeners.forEach((listener) => listener());

  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return;
    loaded = false;
    load();
    emit();
  };

  return {
    getSnapshot: () => {
      load();
      return state;
    },
    getServerSnapshot: () => initial,
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    set: (next) => {
      load();
      state = typeof next === "function" ? (next as (prev: T) => T)(state) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // 저장 실패 시에도 현재 탭의 상태는 유지한다.
      }
      emit();
    },
  };
}

export function usePersistentStore<T>(store: PersistentStore<T>): [T, (next: Updater<T>) => void] {
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const set = useCallback((next: Updater<T>) => store.set(next), [store]);
  return [value, set];
}

const noopSubscribe = () => () => {};

/** 하이드레이션이 끝나 저장값을 읽을 수 있는지 여부 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
