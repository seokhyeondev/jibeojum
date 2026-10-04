import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/navigation/app-shell";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";
import "./landing.css";
import "./ops-extra.css";

export const metadata: Metadata = {
  title: "집어줌 | 출근 조건으로 찾는 집",
  description: "출근지와 예산을 알려주시면 조건에 맞는 실제 매물을 제안해드립니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

const PRETENDARD_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD_CSS} crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
