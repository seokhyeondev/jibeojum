import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "운영 | 집어줌",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
