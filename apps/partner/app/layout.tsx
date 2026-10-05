import type { Metadata, Viewport } from "next";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "./landing.css";
import "./ops-extra.css";

export const metadata: Metadata = {
  title: "집어줌 파트너",
  description: "집어줌 공인중개사 웹",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

const PRETENDARD_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

/** 공인중개사 웹(/agent)·공인중개사 소개(/partners). 사용자 웹·운영 웹과 따로 배포한다 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD_CSS} crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-center" theme="light" />
      </body>
    </html>
  );
}
