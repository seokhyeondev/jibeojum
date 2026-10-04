import type { Metadata } from "next";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "알림 | 집어줌" };

export default function NotificationsPage() {
  return <NotificationList />;
}
