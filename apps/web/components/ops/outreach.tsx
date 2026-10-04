"use client";

import type { AgentInviteLink, BrokerContactStatus, BrokerContactView, BrokerOfficeView } from "@zipazum/shared";
import { BROKER_CONTACT_LABEL, MANUAL_CONTACT_STATUSES } from "@zipazum/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Link2, Phone, Trash2, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { adminApi, naverMapUrl, naverSearchUrl } from "@/lib/api/ops";
import { errorText } from "./use-ops-query";

const distanceText = (m: number | null) => (m === null ? null : m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);

const GOOD: BrokerContactStatus[] = ["interested", "joined", "has_listing"];
const BAD: BrokerContactStatus[] = ["no_listing", "declined"];
const statusTone = (s: BrokerContactStatus) => (GOOD.includes(s) ? "on" : BAD.includes(s) ? "warn" : "");

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} 복사했어요`);
  } catch {
    toast.error("복사하지 못했어요. 직접 선택해서 복사해주세요.");
  }
}

/** 생활권 근처 부동산: 검색어 링크 + 부동산 목록(우리 목록·지난 연락 결과 먼저). 연락하면 바로 기록한다 */
export function BrokerPanel({ requestId, zoneKey, onChanged }: { requestId: string; zoneKey: string; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const queryKey = ["admin", "brokers", zoneKey, requestId];
  const { data, isPending, error } = useQuery({ queryKey, queryFn: () => adminApi.brokers(zoneKey, requestId), staleTime: 60_000 });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "brokers"] });
    onChanged();
  };
  if (isPending) return <p className="ops-muted">검색 중…</p>;
  if (error) return <p className="ops-error">{errorText(error)}</p>;
  return (
    <div className="ops-brokers">
      <div className="ops-keywords">
        {data.keywords.map((k) => (
          <span key={k.query} title={k.reason}>
            <b>{k.query}</b>
            <a href={naverSearchUrl(k.query)} target="_blank" rel="noreferrer">
              검색 <ExternalLink aria-hidden />
            </a>
            <a href={naverMapUrl(k.query)} target="_blank" rel="noreferrer">
              지도 <ExternalLink aria-hidden />
            </a>
          </span>
        ))}
      </div>
      {data.offices.length > 0 ? (
        <ul className="ops-offices">
          {data.offices.map((o) => (
            <OfficeRow key={`${o.officeId ?? ""}-${o.name}-${o.address}`} office={o} requestId={requestId} zoneKey={zoneKey} onChanged={refresh} />
          ))}
        </ul>
      ) : (
        <p className="ops-muted">1.5km 안에서 찾은 중개사무소가 없어요. 위 검색어 링크로 찾아보세요.</p>
      )}
    </div>
  );
}

function OfficeRow({ office, requestId, zoneKey, onChanged }: { office: BrokerOfficeView; requestId: string; zoneKey: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const { history } = office;
  const record = async () => {
    setBusy(true);
    try {
      await adminApi.recordContact(
        requestId,
        office.officeId
          ? { zoneKey, officeId: office.officeId }
          : {
              zoneKey,
              office: {
                name: office.name,
                address: office.address ?? "주소 미상",
                phone: office.phone,
                link: office.link,
                latitude: office.latitude,
                longitude: office.longitude,
              },
            },
      );
      toast(`${office.name} 연락 기록을 남겼어요`);
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className={office.contactStatus ? "done" : ""}>
      <div>
        <b>
          <a href={naverMapUrl(office.name)} target="_blank" rel="noreferrer">
            {office.name}
          </a>
          {office.link && (
            <a href={office.link} target="_blank" rel="noreferrer" className="ops-sub-link">
              홈페이지
            </a>
          )}
        </b>
        <span className="ops-tags">
          {office.agent && (
            <span className="ops-badge on">
              <UserCheck aria-hidden /> 가입 · {office.agent.name}
            </span>
          )}
          {history.listings > 0 && <span className="ops-badge on">매물 {history.listings}번 줌</span>}
          {history.contacts > 0 && history.lastStatus && (
            <span className={`ops-badge ${statusTone(history.lastStatus)}`}>
              연락 {history.contacts}회 · 최근 {BROKER_CONTACT_LABEL[history.lastStatus]}
            </span>
          )}
          {office.keyword === null && <span className="ops-badge">우리 목록</span>}
        </span>
        <small>
          {[distanceText(office.distanceM), office.address].filter(Boolean).join(" · ")}
          {office.phone && (
            <>
              {" · "}
              <a href={`tel:${office.phone}`}>{office.phone}</a>
            </>
          )}
        </small>
      </div>
      {office.contactStatus ? (
        <span className={`ops-badge ${statusTone(office.contactStatus)}`}>{BROKER_CONTACT_LABEL[office.contactStatus]}</span>
      ) : (
        <button type="button" className="ops-btn ghost" disabled={busy} onClick={() => void record()}>
          <Phone aria-hidden /> 연락했어요
        </button>
      )}
    </li>
  );
}

/** 이 요청으로 연락한 부동산 목록: 상태·메모·전화번호를 고치고 초대 링크를 만든다 */
export function OutreachCard({ contacts, onChanged }: { contacts: BrokerContactView[]; onChanged: () => void }) {
  const counts = contacts.reduce<Partial<Record<BrokerContactStatus, number>>>((acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }), {});
  const summary = (["has_listing", "joined", "interested", "contacted", "no_answer", "no_listing", "declined"] as BrokerContactStatus[])
    .filter((s) => counts[s])
    .map((s) => `${BROKER_CONTACT_LABEL[s]} ${counts[s]}`)
    .join(" · ");
  return (
    <div className="ops-card">
      <h2>
        부동산 연락 {contacts.length > 0 && <small>{contacts.length}곳</small>}
      </h2>
      {summary && <p className="ops-muted">{summary}</p>}
      {contacts.length === 0 && <p className="ops-muted">생활권의 &ldquo;근처 부동산&rdquo;에서 연락한 곳을 기록하면 여기 모여요.</p>}
      <ul className="ops-contacts">
        {contacts.map((c) => (
          <ContactRow key={c.id} contact={c} onChanged={onChanged} />
        ))}
      </ul>
    </div>
  );
}

function ContactRow({ contact, onChanged }: { contact: BrokerContactView; onChanged: () => void }) {
  const [note, setNote] = useState(contact.note ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [invite, setInvite] = useState<AgentInviteLink | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (body: Parameters<typeof adminApi.updateContact>[1]) => {
    try {
      await adminApi.updateContact(contact.id, body);
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const auto = !(MANUAL_CONTACT_STATUSES as readonly string[]).includes(contact.status);
  return (
    <li>
      <div className="ops-contact-head">
        <b>{contact.officeName}</b>
        <select
          className="ops-input"
          aria-label={`${contact.officeName} 연락 상태`}
          value={contact.status}
          onChange={(e) => void save({ status: e.target.value as (typeof MANUAL_CONTACT_STATUSES)[number] })}
        >
          {auto && <option value={contact.status}>{BROKER_CONTACT_LABEL[contact.status]}</option>}
          {MANUAL_CONTACT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BROKER_CONTACT_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ops-icon"
          aria-label={`${contact.officeName} 연락 기록 지우기`}
          onClick={async () => {
            if (!window.confirm(`${contact.officeName} 연락 기록을 지울까요?`)) return;
            await adminApi.removeContact(contact.id).catch((err: unknown) => toast.error(errorText(err)));
            onChanged();
          }}
        >
          <Trash2 aria-hidden />
        </button>
      </div>
      {contact.officeAddress && <small>{contact.officeAddress}</small>}
      <div className="ops-contact-fields">
        <input
          className="ops-input"
          aria-label="전화번호"
          inputMode="tel"
          placeholder="전화번호"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => phone !== (contact.phone ?? "") && void save({ phone: phone.trim() || null })}
        />
        <input
          className="ops-input"
          aria-label="메모"
          placeholder="메모 (예: 내일 매물 확인 후 연락 준대요)"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (contact.note ?? "") && void save({ note: note.trim() || null })}
        />
      </div>
      {contact.invite?.acceptedAt ? (
        <small className="ops-ok">
          <UserCheck aria-hidden /> {contact.invite.agentName ?? "공인중개사"}님이 초대 링크로 가입했어요
        </small>
      ) : invite ? (
        <div className="ops-invite">
          <textarea className="ops-input" readOnly rows={7} value={invite.message} onFocus={(e) => e.currentTarget.select()} />
          <div>
            <button type="button" className="ops-btn primary" onClick={() => void copy(invite.message, "문구를")}>
              <Copy aria-hidden /> 문구 복사
            </button>
            <button type="button" className="ops-btn ghost" onClick={() => void copy(invite.url, "링크를")}>
              <Link2 aria-hidden /> 링크만 복사
            </button>
          </div>
          <small className="ops-muted">링크는 {new Date(invite.expiresAt).toLocaleDateString("ko-KR")}까지 쓸 수 있어요. 가입하면 이 요청이 바로 배정돼요.</small>
        </div>
      ) : (
        <button
          type="button"
          className="ops-btn ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setInvite(await adminApi.invite(contact.id));
            } catch (err) {
              toast.error(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Link2 aria-hidden /> {contact.invite ? "초대 링크 다시 만들기" : "초대 링크·문구 만들기"}
        </button>
      )}
    </li>
  );
}
