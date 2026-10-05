"use client";

import { Camera, Loader2, UserRound, X } from "lucide-react";
import { useId, useState } from "react";
import { uploadPhoto } from "@/lib/upload";

/** 프로필 사진 고르기. 320px로 줄여 S3에 올리고 CloudFront 주소를 넘긴다 */
export function PhotoInput({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="photo-input">
      <span className="photo-preview" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- 작은 프로필 미리보기 */}
        {busy ? <Loader2 className="spin" /> : value ? <img src={value} alt="" /> : <UserRound />}
      </span>
      <label htmlFor={id} className="ops-btn ghost" aria-disabled={busy}>
        <Camera aria-hidden /> {busy ? "올리는 중…" : "사진 고르기"}
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            onChange(await uploadPhoto(file, "agent-photo"));
          } catch (err) {
            setError(err instanceof Error ? err.message : "사진을 올리지 못했어요");
          } finally {
            setBusy(false);
          }
        }}
      />
      {value && !busy && (
        <button type="button" className="ops-btn ghost" onClick={() => onChange(null)}>
          <X aria-hidden /> 지우기
        </button>
      )}
      {error && <small className="ops-error">{error}</small>}
    </div>
  );
}
