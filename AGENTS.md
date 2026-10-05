# 집어줌 개발 규칙

- 웹은 Next.js App Router, TypeScript, Tailwind CSS를 유지한다. API는 NestJS, DB는 Prisma.
- 사용자 화면은 모바일 360px을 우선으로 설계한다.
- 웹·API가 함께 쓰는 타입, zod 스키마, 라벨, 계산 로직은 `packages/shared`에 둔다. 한쪽에만 복사하지 않는다.
- 웹은 `apps/web/lib/api/client.ts`를 통해서만 서버 데이터를 읽고 쓴다. DB 접근은 `apps/api`에서만 한다.
- DB는 전용 RDS `zipazum-db`(AWS 893918474407)의 `zipazum` 스키마다. 같은 계정에 다른 서비스 운영 리소스가 있으니 `zipazum-*` 밖의 AWS 리소스는 건드리지 않는다. `prisma migrate reset`, `db push`, `migrate dev` 금지. 마이그레이션 SQL은 검토 후 `migrate deploy`로 적용한다.
- 사진은 S3(`zipazum-assets-…`, 비공개)에 서명 주소로 직접 올리고 CloudFront 주소만 저장한다. 서버는 저장 전에 주소가 우리 CloudFront의 정해진 경로인지 확인한다.
- 새로운 `any` 타입을 만들지 않는다.
- UI 변경 후 입력, 요청, 결과, 상세, 비교, 문의 흐름을 확인한다.
- TMAP·인증 등 비밀키는 API 서버 환경변수에만 둔다. 웹 번들에 넣지 않는다.
- 사용자 입력과 개인정보를 콘솔·로그에 출력하지 않는다.
- 기존 동작을 유지하며 작은 단위로 수정하고 검증한다.
- 완료 시 변경 파일, 검증 명령, 남은 제한사항을 보고한다.

## 구조

- `apps/web/app/(user)/` 라우트: `request`(입력 5단계, `?step=`), `request/complete`, `listings`, `listings/[id]`, `compare`, `requests`, `messages?listing=`
- `apps/web/components/` 화면 컴포넌트, `apps/web/lib/store/` localStorage 상태(초안, 요청 사본, 찜, 비교, 문의)
- `apps/ops/` 운영·중개사 웹 (사용자 웹과 따로 배포): `/partners` 공인중개사 소개, `/agent` 공인중개사, `/admin` 내부 운영
- `apps/mobile/` Capacitor 앱 (사용자 웹만 감싼다)
- `apps/api/src/` Nest 모듈: `requests`, `listings`(제안), `session`, `prisma`, `common`(오류 형식, zod 파이프)
- `apps/api/prisma/` 스키마, 마이그레이션, 시드
- `packages/shared/src/` 타입, `request-schema`(검증), `recommend`(추천 점수), `format`, `options`, `mock-listings`

## 검증 명령

```sh
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
