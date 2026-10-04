"use client";

import { formatDateTime } from "@zipazum/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { LoadingBlock } from "@/components/common/hydrated";
import { EmptyState } from "@/components/common/empty-state";
import { SimpleHead } from "@/components/navigation/simple-head";
import { LoginPrompt, useMe } from "@/components/auth/kakao-login";
import { fetchNotifications, readAllNotifications } from "@/lib/api/client";

/** 알림함. 열면 모두 읽음으로 바꾸되, 이번에 새로 온 알림은 표시를 남겨 둔다 */
export function NotificationList() {
  const { data: me, isPending } = useMe();
  if (isPending) return <LoadingBlock />;
  if (!me?.user) {
    return (
      <section className="notifications">
        <SimpleHead title="알림" fallbackHref="/request/complete" />
        <LoginPrompt title="로그인하고 알림을 받아보세요" description="공인중개사가 매물을 제안하면 바로 알려드려요." returnTo="/notifications" />
      </section>
    );
  }
  return <Notifications />;
}

function Notifications() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["notifications", "page"], queryFn: fetchNotifications, staleTime: Infinity });
  const unread = data?.unreadCount ?? 0;

  useEffect(() => {
    if (!unread) return;
    void readAllNotifications().then(() => queryClient.invalidateQueries({ queryKey: ["notifications"], exact: true }));
  }, [unread, queryClient]);

  return (
    <section className="notifications">
      <SimpleHead title="알림" fallbackHref="/request/complete" />
      {isPending && <LoadingBlock />}
      {data && data.items.length === 0 && (
        <EmptyState icon={<Bell />} title="아직 알림이 없어요" description="공인중개사가 매물을 제안하면 여기로 알려드려요." actionLabel="내 요청 보기" actionHref="/requests" />
      )}
      {data && data.items.length > 0 && (
        <ul>
          {data.items.map((n) => {
            const body = (
              <>
                {!n.read && <em aria-label="새 알림" />}
                <b>{n.title}</b>
                <p>{n.body}</p>
                <small>{formatDateTime(n.createdAt)}</small>
              </>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link}>{body}</Link> : <div>{body}</div>}</li>;
          })}
        </ul>
      )}
    </section>
  );
}
