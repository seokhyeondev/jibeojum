# 집이온다

출근 조건(출근지·통근시간·예산·입주일)을 입력하면 중개사가 확인한 전월세 매물을 제안받는 모바일 우선 웹앱입니다.
상세 기획은 `집이온다_웹앱_상세기획서.docx`를 참고하세요.

## 기술 스택

- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Tailwind CSS 4, shadcn 계열 컴포넌트(`components/ui/`), Lucide 아이콘
- pnpm

## 시작하기

Node.js 22.13 이상과 pnpm이 필요합니다.

```sh
pnpm install
pnpm dev        # http://localhost:3000
```

## 스크립트

- `pnpm dev`: 개발 서버
- `pnpm build`: 프로덕션 빌드
- `pnpm start`: 빌드 결과 실행
- `pnpm lint`: ESLint
- `pnpm typecheck`: TypeScript 검사
- `pnpm test`: 유틸·폼 검증·추천 로직 테스트 (Vitest)

## 현재 상태

- 사용자 흐름: 조건 입력 6단계(`/request?step=1~6`) → 요청 완료 → 매물 목록 → 상세 → 비교 → 문의
- 입력 초안, 제출한 요청, 찜, 비교함, 문의 내역은 브라우저 localStorage에 저장됩니다.
- 매물 4건과 중개사 1명은 고정 샘플 데이터입니다(`data/mock-listings.ts`).
- 추천 순서는 통근·예산·세부 조건·신선도 점수로 정합니다(`lib/recommend.ts`).
- 데이터베이스, 휴대폰 인증, ODsay 연동은 아직 없습니다.

개발 규칙과 폴더 구조는 `AGENTS.md`를 참고하세요.

## 환경변수

실제 키는 `.env.local`에만 두고 커밋하지 않습니다. 브라우저에서 직접 써야 하는 공개 키가 아니면 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.
"# jibeojum" 
