import { redirect } from "next/navigation";

/** 첫 화면은 공인중개사 소개 */
export default function Home() {
  redirect("/partners");
}
