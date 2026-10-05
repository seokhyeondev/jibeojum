# 앱 (Capacitor)

`apps/mobile`은 배포된 웹(`https://zipazum.com`)을 앱 안에 띄우고, 웹으로 할 수 없는 기능만 붙인다.
화면은 웹 그대로라 웹을 배포하면 앱에도 바로 반영된다 (스토어 재심사 없이).

| 기능 | 구현 |
| --- | --- |
| 로그인 | 카카오·Apple 로그인을 **시스템 브라우저**로 열고, 끝나면 `zipazum://auth?code=…`로 앱에 돌아와 1회용 코드로 앱 화면에 세션을 만든다 (`/api/auth/exchange`) |
| 푸시 알림 | 새 매물·중개사 답장. 앱이 FCM 토큰을 서버에 등록(`/api/push/devices`)하고, 서버가 알림을 만들 때 FCM으로 보낸다. 누르면 그 화면으로 간다 |
| 딥링크 | `zipazum://open?path=/listings/…` |
| 회원탈퇴·약관 | 웹의 내 정보 화면 (`/mypage`, `/terms`, `/privacy`) |
| 안드로이드 뒤로 가기 | 웹 뒤로 가기, 첫 화면이면 앱 종료 |

앱 쪽 코드는 웹의 `components/native/native-bridge.tsx`(앱에서만 동작)와 `lib/native.ts`에 있다.

## 명령

```sh
pnpm mobile:sync       # capacitor.config.ts·플러그인 변경을 android/ios 프로젝트에 반영
pnpm mobile:android    # Android Studio로 열기
pnpm mobile:ios        # Xcode로 열기 (맥에서)
```

개발 서버로 시험할 때: `ZIPAZUM_APP_URL=http://10.0.2.2:3000 pnpm mobile:sync` (안드로이드 에뮬레이터에서 PC의 localhost). 끝나면 그냥 `pnpm mobile:sync`로 되돌린다.

## 출시 전에 해야 할 일

### 1. Firebase (푸시)
1. Firebase 콘솔에서 프로젝트를 만들고 Android 앱(`com.zipazum.app`)과 iOS 앱(`com.zipazum.app`)을 추가한다.
2. `google-services.json` → `apps/mobile/android/app/`, `GoogleService-Info.plist` → `apps/mobile/ios/App/App/` (Xcode 프로젝트에는 이미 등록돼 있다). 두 파일은 키가 있어 git에 넣지 않으므로 빌드하는 PC마다 Firebase 콘솔(프로젝트 `zip-a-zum`)에서 받아 넣는다.
3. iOS: Apple Developer에서 APNs 키(.p8)를 만들어 Firebase 프로젝트 설정 → Cloud Messaging에 올린다.
4. 서비스 계정 키 JSON을 API 환경변수 `FIREBASE_SERVICE_ACCOUNT`(SSM `/zipazum/prod/FIREBASE_SERVICE_ACCOUNT`)로 넣는다.

### 2. Apple 로그인 (iOS 심사 필수)
1. Apple Developer → Identifiers: App ID `com.zipazum.app`에 Sign in with Apple, Push Notifications 켜기.
2. Services ID(예: `com.zipazum.web`)를 만들고 도메인 `zipazum.com`, Return URL `https://zipazum.com/api/auth/apple/callback` 등록.
3. Keys에서 Sign in with Apple 키(.p8)를 만든다.
4. API 환경변수 `APPLE_CLIENT_ID`(Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_REDIRECT_URI`. 넣으면 로그인 화면에 Apple 버튼이 나타난다.

### 3. 카카오
- 카카오 개발자 콘솔의 Redirect URI는 웹과 같다 (`https://zipazum.com/api/auth/kakao/callback`). 앱도 시스템 브라우저로 같은 주소를 쓴다.
- 회원탈퇴 때 카카오 연결을 끊으려면 Admin 키를 `KAKAO_ADMIN_KEY`로 넣는다.

### 4. 안드로이드 출시
1. 업로드 키 만들기: `keytool -genkey -v -keystore zipazum-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000` (저장소에 넣지 않는다).
2. Android Studio → Build → Generate Signed App Bundle (.aab) → Play Console에 올린다.
3. 버전: `android/app/build.gradle`의 `versionCode`(올릴 때마다 +1), `versionName`.

### 5. iOS 출시 (맥 필요)
1. `pnpm mobile:ios`로 Xcode를 열고 Signing & Capabilities에서 팀 선택, **Push Notifications**·**Background Modes(Remote notifications)** 추가.
2. Product → Archive → App Store Connect에 올린다.
3. 맥이 없으면 Codemagic·EAS 같은 클라우드 빌드를 쓴다.

### 6. 심사 제출 메모
- 심사용 계정: Apple 로그인으로 들어가면 되므로 따로 만들 필요는 없다. 매물 제안까지 보여주려면 운영 웹에서 심사 계정 요청에 테스트 매물을 하나 붙여 둔다.
- 개인정보처리방침 URL: `https://zipazum.com/privacy`
- 앱 기능 설명: 푸시 알림(새 매물·답장), 중개사와 채팅, 출근 조건 기반 매물 요청
- 약관·개인정보처리방침은 초안이다. 출시 전에 법률 검토를 받는다.
