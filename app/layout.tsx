import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "집이온다 | 출근 조건으로 찾는 집",
  description: "출근지와 예산을 알려주시면 조건에 맞는 실제 매물을 제안해드립니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
