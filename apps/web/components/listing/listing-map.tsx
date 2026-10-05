"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { NearbyFacility } from "@zipazum/shared";
import { fetchMapConfig } from "@/lib/api/client";
import { FacilityIcon } from "./facility-icon";

/* 네이버 지도 JS v3 중 쓰는 부분만 타입으로 둔다 */
interface NaverLatLng {
  readonly _lat: number;
}
interface NaverBounds {
  extend(point: NaverLatLng): NaverBounds;
}
interface NaverMap {
  fitBounds(bounds: NaverBounds, margin?: { top: number; right: number; bottom: number; left: number }): void;
  destroy(): void;
}
interface NaverMaps {
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  LatLngBounds: new (sw: NaverLatLng, ne: NaverLatLng) => NaverBounds;
  Point: new (x: number, y: number) => unknown;
  Map: new (el: HTMLElement, options: Record<string, unknown>) => NaverMap;
  Marker: new (options: { position: NaverLatLng; map: NaverMap; icon?: { content: string; anchor: unknown }; zIndex?: number }) => unknown;
}
declare global {
  interface Window {
    naver?: { maps?: NaverMaps };
    navermap_authFailure?: () => void;
  }
}

let loading: Promise<NaverMaps> | null = null;

/** 스크립트는 한 번만 넣는다. 인증 실패(등록되지 않은 도메인 등)면 reject */
function loadNaverMaps(clientId: string): Promise<NaverMaps> {
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  loading ??= new Promise<NaverMaps>((resolve, reject) => {
    window.navermap_authFailure = () => reject(new Error("naver map auth failed"));
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.async = true;
    script.onload = () => (window.naver?.maps ? resolve(window.naver.maps) : reject(new Error("naver map not loaded")));
    script.onerror = () => reject(new Error("naver map script failed"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

const HOME_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg>';

/**
 * 매물 위치와 주변 시설. 스크롤을 방해하지 않게 움직이지 않는 지도로 두고, 누르면 네이버 지도에서 연다.
 */
export function ListingMap({
  latitude,
  longitude,
  address,
  facilities,
}: {
  latitude: number;
  longitude: number;
  address: string;
  facilities: NearbyFacility[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const { data: config } = useQuery({ queryKey: ["map-config"], queryFn: fetchMapConfig, staleTime: Infinity, retry: false });
  const clientId = config?.naverMapClientId ?? null;
  // 부모가 다시 그려질 때마다 지도를 새로 만들지 않도록 종류·좌표만 문자열로 비교한다
  const points = facilities
    .filter((f) => f.latitude !== undefined && f.longitude !== undefined)
    .map((f) => `${f.type},${f.latitude},${f.longitude}`)
    .join("|");

  useEffect(() => {
    const el = ref.current;
    if (!el || !clientId) return;
    let map: NaverMap | null = null;
    let cancelled = false;
    loadNaverMaps(clientId)
      .then((maps) => {
        if (cancelled) return;
        const home = new maps.LatLng(latitude, longitude);
        map = new maps.Map(el, {
          center: home,
          zoom: 16,
          draggable: false,
          pinchZoom: false,
          scrollWheel: false,
          keyboardShortcuts: false,
          disableDoubleTapZoom: true,
          disableDoubleClickZoom: true,
          disableTwoFingerTapZoom: true,
          zoomControl: false,
          mapDataControl: false,
          scaleControl: false,
        });
        const bounds = new maps.LatLngBounds(home, home);
        let marked = false;
        points.split("|").forEach((point) => {
          if (!point || !map) return;
          const [type, latText, lngText] = point.split(",");
          const [lat, lng] = [Number(latText), Number(lngText)];
          const position = new maps.LatLng(lat, lng);
          marked = true;
          bounds.extend(position);
          new maps.Marker({ position, map, icon: { content: renderToStaticMarkup(<FacilityIcon type={type as NearbyFacility["type"]} className="map-pin" />), anchor: new maps.Point(12, 12) } });
        });
        new maps.Marker({ position: home, map, zIndex: 100, icon: { content: `<span class="map-home">${HOME_ICON}</span>`, anchor: new maps.Point(17, 17) } });
        if (marked) map.fitBounds(bounds, { top: 28, right: 28, bottom: 28, left: 28 });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      map?.destroy();
    };
  }, [clientId, latitude, longitude, points]);

  // 키가 없거나 지도를 띄우지 못하면 자리를 차지하지 않는다
  if (!clientId || failed) return null;
  return (
    <a className="listing-map" href={`https://map.naver.com/p/search/${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" aria-label="네이버 지도에서 크게 보기">
      <div ref={ref} aria-hidden />
      <small>네이버 지도에서 보기</small>
    </a>
  );
}
