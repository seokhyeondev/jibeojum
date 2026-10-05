"use client";

import type { PlaceCandidate, Place } from "@zipazum/shared";
import { SERVICE_AREA_MESSAGE, isInServiceArea } from "@zipazum/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { fetchPlaces } from "@/lib/api/client";

interface Props {
  value: Place;
  onChange: (place: Place) => void;
  /** 입력칸 id (label htmlFor와 맞춘다) */
  id?: string;
  placeholder?: string;
}

const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

/**
 * 출근지 검색 입력. 2글자부터 회사·빌딩·역·주소 후보를 보여주고, 고르면 좌표까지 저장한다.
 * 목록에서 골라야 다음 단계로 갈 수 있다 (출근 경로를 좌표로 계산한다).
 */
export function DestinationSearch({ value, onChange, id = "destination", placeholder = "회사·빌딩 이름, 역, 도로명 주소" }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [debounced, setDebounced] = useState(value.label.trim());
  const selected = value.latitude != null && value.longitude != null;
  const text = value.label;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const { data: places = [], isFetching, isError } = useQuery({
    queryKey: ["places", debounced],
    queryFn: () => fetchPlaces(debounced),
    enabled: open && !selected && debounced.length >= MIN_QUERY,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const showList = open && !selected && text.trim().length >= MIN_QUERY;
  const choose = (place: PlaceCandidate) => {
    onChange({ label: place.label, address: place.address, latitude: place.latitude, longitude: place.longitude });
    setOpen(false);
  };

  return (
    <div className="place-search">
      <div className="inputbox">
        <MapPin aria-hidden />
        <Input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && places[active] ? `${listId}-${active}` : undefined}
          value={text}
          onChange={(e) => {
            // 글자를 바꾸면 이전에 고른 좌표는 버린다
            onChange({ label: e.target.value });
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (!showList || places.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % places.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + places.length) % places.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const place = places.at(active);
              if (place) choose(place);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
        />
        {isFetching ? <Loader2 className="spin" aria-hidden /> : selected && isInServiceArea(value) ? <Check aria-hidden /> : <Search aria-hidden />}
      </div>

      {showList && (
        <ul className="place-list" id={listId} role="listbox" aria-label="출근지 후보">
          {places.map((place, index) => (
            <li
              key={`${place.source}-${place.label}-${place.latitude}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? "on" : ""}
              // 입력창 blur보다 먼저 고르기
              onMouseDown={(e) => {
                e.preventDefault();
                choose(place);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <b>{place.label}</b>
              {place.address && <small>{place.address}</small>}
            </li>
          ))}
          {!isFetching && places.length === 0 && debounced === text.trim() && (
            <li className="place-empty">{isError ? "검색이 잠시 안 돼요. 잠시 후 다시 검색해주세요." : "찾는 곳이 없어요. 도로명 주소로 검색해보세요."}</li>
          )}
        </ul>
      )}

      {selected ? (
        isInServiceArea(value) ? (
          <p className="place-picked">
            <Check aria-hidden /> {value.address ?? value.label}
          </p>
        ) : (
          <p className="place-outside" role="alert">
            {SERVICE_AREA_MESSAGE} 다른 출근지를 검색해주세요.
          </p>
        )
      ) : (
        text.trim().length >= MIN_QUERY && !showList && <p className="place-hint">검색 목록에서 출근지를 골라주세요.</p>
      )}
    </div>
  );
}
