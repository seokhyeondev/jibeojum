"use client";

import type { PluginListenerHandle } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useMe } from "@/components/auth/kakao-login";
import { exchangeLoginCode, registerPushDevice } from "@/lib/api/client";
import { isNativeApp, nativePlatform } from "@/lib/native";

const LOGIN_ERROR: Record<string, string> = {
  cancelled: "로그인을 취소했어요.",
  unavailable: "로그인을 준비 중이에요. 잠시 후 다시 시도해주세요.",
  failed: "로그인에 실패했어요. 다시 시도해주세요.",
};

/** 사이트 안 경로만 따라간다 */
const safePath = (path: string | null) => (path && path.startsWith("/") && !path.startsWith("//") ? path : "/");

/**
 * 리스너는 비동기로 붙으므로, 붙기 전에 화면이 사라지면(cleanup) 붙자마자 떼어야 중복으로 남지 않는다.
 */
function listeners() {
  const handles: PluginListenerHandle[] = [];
  let disposed = false;
  return {
    add(handle: PluginListenerHandle) {
      if (disposed) void handle.remove();
      else handles.push(handle);
    },
    get disposed() {
      return disposed;
    },
    dispose() {
      disposed = true;
      handles.splice(0).forEach((h) => void h.remove());
    },
  };
}

/**
 * 앱(Capacitor)에서만 동작하는 연결부. 웹 브라우저에서는 아무것도 하지 않는다.
 * - zipazum://auth?code=… : 시스템 브라우저 로그인에서 돌아오면 1회용 코드로 세션을 만든다
 * - zipazum://open?path=… : 그 화면으로 간다
 * - 로그인하면 푸시 알림 권한을 묻고 기기를 등록한다. 알림을 누르면 그 화면으로 간다
 * - 안드로이드 뒤로 가기 버튼
 */
export function NativeBridge() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const loggedIn = Boolean(me?.user);
  const pushRegistered = useRef(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    const subs = listeners();
    void (async () => {
      const { App } = await import("@capacitor/app");
      const { Browser } = await import("@capacitor/browser");
      subs.add(
        await App.addListener("appUrlOpen", async ({ url }) => {
          const parsed = new URL(url);
          if (parsed.host !== "auth") {
            router.push(safePath(parsed.searchParams.get("path")));
            return;
          }
          await Browser.close().catch(() => undefined);
          const returnTo = safePath(parsed.searchParams.get("returnTo"));
          const error = parsed.searchParams.get("error");
          const code = parsed.searchParams.get("code");
          if (error || !code) {
            toast(LOGIN_ERROR[error ?? "failed"] ?? LOGIN_ERROR.failed);
            return;
          }
          try {
            await exchangeLoginCode(code);
            await queryClient.invalidateQueries();
            router.replace(returnTo);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : LOGIN_ERROR.failed);
          }
        }),
      );
      subs.add(
        await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else void App.exitApp();
        }),
      );
    })();
    return () => subs.dispose();
  }, [router, queryClient]);

  // 로그인한 뒤에 푸시 권한을 묻는다 (처음 열자마자 묻지 않는다)
  useEffect(() => {
    if (!isNativeApp() || !loggedIn || pushRegistered.current) return;
    pushRegistered.current = true;
    const subs = listeners();
    void (async () => {
      // iOS·안드로이드 모두 FCM 토큰을 받는다 (서버는 FCM으로만 보낸다)
      const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
      const send = (token: string) => {
        const platform = nativePlatform();
        if (platform !== "web") void registerPushDevice(token, platform).catch(() => undefined);
      };
      subs.add(await FirebaseMessaging.addListener("tokenReceived", ({ token }) => send(token)));
      subs.add(
        await FirebaseMessaging.addListener("notificationActionPerformed", ({ notification }) => {
          const link = (notification.data as { link?: string } | undefined)?.link ?? null;
          router.push(safePath(link));
        }),
      );
      if (subs.disposed) return;
      // 서버가 보내는 알림 채널 (안드로이드 8+)
      if (nativePlatform() === "android") {
        await FirebaseMessaging.createChannel({ id: "default", name: "알림", description: "새 매물·답장 알림", importance: 4 }).catch(() => undefined);
      }
      let permission = await FirebaseMessaging.checkPermissions();
      if (permission.receive === "prompt") permission = await FirebaseMessaging.requestPermissions();
      if (permission.receive !== "granted") return;
      const { token } = await FirebaseMessaging.getToken();
      send(token);
    })().catch(() => {
      // Firebase 설정(google-services.json·GoogleService-Info.plist)이 없으면 푸시 없이 동작한다
      pushRegistered.current = false;
    });
    return () => subs.dispose();
  }, [loggedIn, router]);

  return null;
}
