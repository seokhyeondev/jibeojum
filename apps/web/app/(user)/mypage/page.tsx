import type { Metadata } from "next";
import { MyPage } from "@/components/auth/my-page";

export const metadata: Metadata = { title: "내 정보 | 집어줌" };

export default function MyPageRoute() {
  return <MyPage />;
}
