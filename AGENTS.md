# 집이온다 개발 규칙

- Next.js App Router, TypeScript, Tailwind CSS를 유지한다.
- 사용자 화면은 모바일 360px을 우선으로 설계한다.
- 샘플 매물과 실제 API 데이터 공급자를 분리한다. 화면은 `lib/api/`를 통해서만 매물·중개사 데이터를 읽는다.
- 새로운 `any` 타입을 만들지 않는다.
- UI 변경 후 입력, 요청, 결과, 상세, 비교, 문의 흐름을 확인한다.
- ODsay 및 인증 비밀키를 클라이언트 코드에 넣지 않는다.
- 사용자 입력과 개인정보를 콘솔에 출력하지 않는다.
- 기존 동작을 유지하며 작은 단위로 수정하고 검증한다.
- 완료 시 변경 파일, 검증 명령, 남은 제한사항을 보고한다.

## 구조

- `app/(user)/` 라우트: `request`(입력 6단계, `?step=`), `request/complete`, `listings`, `listings/[id]`, `compare`, `requests`, `messages?listing=`
- `components/` 화면 컴포넌트 (`request`, `listing`, `messages`, `navigation`, `common`)
- `types/` 데이터 계약, `data/` 샘플 데이터와 선택지 라벨
- `lib/schema/request.ts` 단계별 검증과 요청 스키마(zod), `lib/recommend.ts` 추천 점수와 근거
- `lib/store/` localStorage 기반 상태(초안, 제출 요청, 찜, 비교, 문의)

## 검증 명령

```sh
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
