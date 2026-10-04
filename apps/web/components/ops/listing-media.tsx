"use client";

import type { PlaceCandidate } from "@zipazum/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, ImagePlus, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { fetchPlaces } from "@/lib/api/client";
import { uploadPhoto } from "@/lib/upload";

export interface PickedAddress {
  address: string;
  latitude: number;
  longitude: number;
}

/**
 * 매물 주소 검색. 건물 이름이나 도로명 주소로 찾아 목록에서 골라야 등록할 수 있다.
 * 고른 주소와 좌표가 그대로 저장돼 가까운 역·출근 시간을 정확히 계산한다.
 */
export function AddressSearch({ value, onChange }: { value: PickedAddress | null; onChange: (value: PickedAddress | null) => void }) {
  const listId = useId();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);

  const { data: places = [], isFetching, isError } = useQuery({
    queryKey: ["places", debounced],
    queryFn: () => fetchPlaces(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 10 * 60_000,
    retry: false,
  });
  // 건물 검색 결과는 주소가 따로 오고, 주소 검색 결과는 이름이 곧 주소다
  const choices = places.map((p) => ({ place: p, address: p.address ?? p.label }));
  const showList = open && text.trim().length >= 2;

  const choose = (place: PlaceCandidate) => {
    onChange({ address: place.address ?? place.label, latitude: place.latitude, longitude: place.longitude });
    setText("");
    setOpen(false);
  };

  if (value) {
    return (
      <p className="ops-picked">
        <Check aria-hidden /> <b>{value.address}</b>
        <button type="button" className="ops-btn ghost" onClick={() => onChange(null)}>
          다시 찾기
        </button>
      </p>
    );
  }

  return (
    <div className="ops-address">
      <div className="ops-address-input">
        <MapPin aria-hidden />
        <input
          id="l-address"
          className="ops-input"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && choices[active] ? `${listId}-${active}` : undefined}
          value={text}
          placeholder="건물 이름 또는 도로명 주소 (예: 테헤란로 123)"
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (!showList || choices.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % choices.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + choices.length) % choices.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const choice = choices.at(active);
              if (choice) choose(choice.place);
            }
          }}
        />
        {isFetching ? <Loader2 className="spin" aria-hidden /> : <Search aria-hidden />}
      </div>
      {showList && (
        <ul className="place-list" id={listId} role="listbox" aria-label="주소 후보">
          {choices.map(({ place, address }, index) => (
            <li
              key={`${place.source}-${place.label}-${place.latitude}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? "on" : ""}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(place);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <b>{place.label}</b>
              {address !== place.label && <small>{address}</small>}
            </li>
          ))}
          {!isFetching && choices.length === 0 && debounced === text.trim() && (
            <li className="place-empty">{isError ? "검색이 잠시 안 돼요. 잠시 후 다시 찾아주세요." : "찾는 주소가 없어요. 도로명 주소로 검색해보세요."}</li>
          )}
        </ul>
      )}
    </div>
  );
}

/** 매물 사진 여러 장 올리기. 1600px로 줄여 S3에 올린다. 첫 장이 대표 사진 */
export function ListingPhotos({ value, onChange, max = 10 }: { value: string[]; onChange: (urls: string[]) => void; max?: number }) {
  const id = useId();
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const room = max - value.length - uploading;

  return (
    <div className="ops-photos">
      <ul>
        {value.map((url, i) => (
          <li key={url}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 올린 사진 미리보기 */}
            <img src={url} alt={`매물 사진 ${i + 1}`} />
            {i === 0 && <em>대표</em>}
            <button type="button" aria-label={`사진 ${i + 1} 지우기`} onClick={() => onChange(value.filter((u) => u !== url))}>
              <X aria-hidden />
            </button>
          </li>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <li key={`uploading-${i}`} className="loading" aria-label="올리는 중">
            <Loader2 className="spin" aria-hidden />
          </li>
        ))}
        {room > 0 && (
          <li>
            <label htmlFor={id} className="ops-photo-add">
              <ImagePlus aria-hidden />
              <small>사진 추가</small>
            </label>
          </li>
        )}
      </ul>
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])].slice(0, Math.max(0, room));
          e.target.value = "";
          if (!files.length) return;
          setError(null);
          setUploading((n) => n + files.length);
          const urls: string[] = [];
          for (const file of files) {
            try {
              urls.push(await uploadPhoto(file, "listing-photo"));
            } catch (err) {
              setError(err instanceof Error ? err.message : "사진을 올리지 못했어요");
            } finally {
              setUploading((n) => n - 1);
            }
          }
          if (urls.length) onChange([...value, ...urls]);
        }}
      />
      <small className="ops-muted">최대 {max}장 · 첫 사진이 대표 사진이에요</small>
      {error && <small className="ops-error">{error}</small>}
    </div>
  );
}
