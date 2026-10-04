"use client";

import { Check, FileImage, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { uploadLicense } from "@/lib/upload";

/**
 * 중개사무소 등록증(또는 사업자등록증) 사진. 비공개로 올라가고 운영자만 확인한다.
 * 올린 사진은 이 화면에서만 미리 보여준다 (서버에서 다시 받지 않는다).
 */
export function LicenseInput({ value, onChange }: { value: string | null; onChange: (key: string | null) => void }) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="license-input">
      <label htmlFor={id} className={`license-drop${value ? " done" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 내 기기에서 고른 사진 미리보기 */}
        {preview && value ? <img src={preview} alt="올린 등록증 미리보기" /> : busy ? <Loader2 className="spin" aria-hidden /> : <FileImage aria-hidden />}
        <span>
          {busy ? "올리는 중…" : value ? (
            <>
              <Check aria-hidden /> 올렸어요 · 다시 고르려면 누르세요
            </>
          ) : (
            "중개사무소 등록증 사진 올리기"
          )}
        </span>
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
            const key = await uploadLicense(file);
            setPreview((old) => {
              if (old) URL.revokeObjectURL(old);
              return URL.createObjectURL(file);
            });
            onChange(key);
          } catch (err) {
            setError(err instanceof Error ? err.message : "사진을 올리지 못했어요");
          } finally {
            setBusy(false);
          }
        }}
      />
      <small className="ops-muted">사업자등록증도 괜찮아요. 운영팀만 확인하고 다른 사람에게는 보이지 않아요.</small>
      {error && <small className="ops-error">{error}</small>}
    </div>
  );
}
