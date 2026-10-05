import { Capacitor } from "@capacitor/core";
import { type LoginProvider, loginHref } from "@/lib/api/client";

/** 집어줌 앱(Capacitor) 안에서 열렸는지. 일반 브라우저면 false */
export const isNativeApp = () => Capacitor.isNativePlatform();

export const nativePlatform = () => Capacitor.getPlatform() as "ios" | "android" | "web";

/**
 * 소셜 로그인 시작.
 * - 웹: 이 창에서 로그인 화면으로 갔다가 returnTo로 돌아온다
 * - 앱: 시스템 브라우저로 로그인하고 zipazum://auth?code=… 로 앱에 돌아온다 (NativeBridge가 받아 세션을 만든다)
 *   카카오·Apple은 앱 안 웹뷰 로그인을 막거나 세션을 공유하지 않아서 이렇게 한다
 */
export async function startLogin(provider: LoginProvider, returnTo: string) {
  if (!isNativeApp()) {
    window.location.href = loginHref(provider, returnTo);
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: `${window.location.origin}${loginHref(provider, returnTo, true)}`, presentationStyle: "popover" });
}
