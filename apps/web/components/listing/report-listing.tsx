"use client";

import type { ListingReportReason } from "@zipazum/shared";
import { LISTING_REPORT_LABEL } from "@zipazum/shared";
import { Flag, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { reportListing } from "@/lib/api/client";

const REASONS = Object.keys(LISTING_REPORT_LABEL) as ListingReportReason[];

/** 매물 상세 아래 "매물 정보가 다른가요?" → 이유를 골라 신고 */
export function ReportListing({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ListingReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button type="button" className="report-link" onClick={() => setOpen(true)}>
        <Flag aria-hidden /> 매물 정보가 다르거나 이미 나간 매물인가요?
      </button>
      {open &&
        createPortal(
          <div className="login-sheet" role="presentation" onClick={close}>
            <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="report-sheet" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="close" aria-label="닫기" onClick={close}>
                <X />
              </button>
              <h2 id="report-title">매물 신고</h2>
              <p>운영팀이 확인하고, 사실이면 이 매물을 내리고 공인중개사에게 조치해요.</p>
              <div className="report-reasons" role="radiogroup" aria-label="신고 이유">
                {REASONS.map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={reason === r} className={reason === r ? "on" : ""} onClick={() => setReason(r)}>
                    {LISTING_REPORT_LABEL[r]}
                  </button>
                ))}
              </div>
              <textarea placeholder="자세한 내용 (선택)" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
              <button
                type="button"
                className="report-submit"
                disabled={!reason || busy}
                onClick={async () => {
                  if (!reason) return;
                  setBusy(true);
                  try {
                    await reportListing(listingId, { reason, note: note.trim() || null });
                    toast("신고했어요. 확인 후 조치할게요.");
                    close();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "보내는 중…" : "신고하기"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
