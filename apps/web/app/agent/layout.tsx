import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "공인중개사 | 집어줌",
  robots: { index: false, follow: false },
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
