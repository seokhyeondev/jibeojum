import type { CapacitorConfig } from "@capacitor/cli";

// 집어줌 앱: 배포된 웹을 그대로 띄우고(server.url), 푸시·로그인·딥링크 같은 앱 기능만 붙인다.
// 웹을 배포하면 앱에도 바로 반영된다 (스토어 재심사 없이). 개발 중에는 ZIPAZUM_APP_URL로 바꿔 띄울 수 있다.
const appUrl = process.env.ZIPAZUM_APP_URL ?? "https://jibeojum.vercel.app";

const config: CapacitorConfig = {
  appId: "com.zipazum.app",
  appName: "집어줌",
  // 서버에 못 붙을 때 보여줄 화면 (www/index.html)
  webDir: "www",
  server: {
    url: appUrl,
    cleartext: appUrl.startsWith("http://"),
    errorPath: "index.html",
  },
  android: {
    // 카카오·Apple 로그인은 시스템 브라우저(Custom Tabs)로 연다
    allowMixedContent: false,
  },
  ios: {
    contentInset: "automatic",
    scheme: "zipazum",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
    FirebaseMessaging: {
      // 앱이 켜져 있을 때도 알림을 띄운다
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
