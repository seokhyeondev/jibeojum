# 집어줌

출근 조건(출근지·통근시간·예산·입주일)을 입력하면 중개사가 확인한 전월세 매물을 제안받는 모바일 우선 웹앱입니다.
상세 기획은 `집어줌_웹앱_상세기획서.docx`를 참고하세요.

## 구조 (pnpm workspace)

```
apps/
  web/       Next.js 16 사용자 웹앱 (Vercel 예정)
  api/       NestJS 12 API 서버 + Prisma 7 (AWS ECS 예정)
packages/
  shared/    웹·API 공용 타입, zod 스키마, 선택지 라벨, 추천 점수, 테스트용 샘플 데이터
```

- 브라우저는 같은 도메인의 `/api/*`를 부르고, Next가 `API_URL`(기본 `http://localhost:4000`)의 Nest로 넘깁니다.
- 입력 검증은 `@zipazum/shared`의 zod 스키마 하나를 웹과 API가 같이 씁니다.

## 기술 스택

- 웹: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, shadcn 계열 컴포넌트, TanStack Query, Pretendard
- API: NestJS 12 (ESM), Prisma 7 + `@prisma/adapter-pg`, zod
- DB: PostgreSQL 16 (AWS RDS `zipazum-db`, db.t4g.micro, `zipazum` DB의 `zipazum` 스키마)
- 사진: S3 `zipazum-assets-893918474407`(비공개) + CloudFront `d1lgf9m8snr8ud.cloudfront.net`
- 외부 API: 국토부 전월세 실거래(공공데이터포털), 브이월드·네이버 지오코딩, TMAP 대중교통, H3 격자
- Node.js 22.13 이상, pnpm 11

## 시작하기

```sh
pnpm install                                   # Prisma 클라이언트도 함께 생성
cp apps/api/.env.example apps/api/.env.local   # DATABASE_URL 채우기
pnpm db:migrate                                # 마이그레이션 적용 (prisma migrate deploy)
pnpm dev                                       # 웹 http://localhost:3000, API http://localhost:4000/api
```

## 스크립트 (루트)

- `pnpm dev`: shared 감시 빌드 + API + 웹을 함께 실행
- `pnpm build` / `pnpm typecheck` / `pnpm lint` / `pnpm test`
- `pnpm db:migrate`

## 배포

웹은 Vercel(`apps/web`, 환경 변수 `API_URL`), API는 AWS ECS Fargate. `pnpm deploy:api`로 배포한다. 자세한 구성과 리소스는 [docs/deploy.md](docs/deploy.md).

## 데이터베이스 (Prisma)

- 전용 RDS의 `zipazum` DB 안 **`zipazum` 스키마**를 씁니다. `DATABASE_URL`에 `schema=zipazum`을 붙입니다. 개발 PC IP만 보안 그룹(`zipazum-rds`)에 열려 있어 IP가 바뀌면 인바운드 규칙을 고쳐야 합니다.
- 테이블: `users`, `broker_offices`, `agents`, `housing_requests`, `listings`, `proposals` (+ `_prisma_migrations`)
- 스키마 변경 절차 (`apps/api`에서)
  1. `prisma/schema.prisma` 수정
  2. `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script -o prisma/migrations/<번호>_<이름>/migration.sql`
  3. SQL을 검토해 `zipazum` 밖을 건드리지 않는지 확인
  4. `pnpm db:migrate`로 적용, `npx prisma generate`
- **`prisma migrate reset`, `prisma db push`, `migrate dev`는 쓰지 않습니다.** (운영 데이터 보호, shadow DB 생성 방지)

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/health` | 서버·DB 상태 |
| GET | `/api/requests` | 내 요청 목록 |
| POST | `/api/requests` | 요청 제출 (`clientKey`로 중복 제출 방지) |
| GET | `/api/requests/:id` | 요청 상세 |
| PATCH | `/api/requests/:id` | 조건 수정 |
| GET | `/api/requests/:id/proposals` | 도착한 매물 제안 |
| GET | `/api/listings/:id` | 매물 상세 (내게 제안된 매물만) |
| GET | `/api/residential-anchors` | 출근지 주변 주거 앵커 목록 (직선거리, 유형·점수 필터) |
| GET | `/api/residential-anchors/:id` | 앵커 상세, 법정동 시세, 지도용 경계 |

- 휴대폰 인증 전까지는 브라우저별 세션 쿠키(`jp_session`, httpOnly)로 사용자를 구분하고 DB에는 토큰 해시만 저장합니다.
- 본인 요청이 아니면 404로 응답합니다. 오류는 `{ error: { code, message } }` 형태입니다.
- 매물 제안은 공인중개사가 공인중개사 웹에서 올린 것만 들어갑니다.
- 알림: `GET /api/notifications`, `POST /api/notifications/read-all`. 공인중개사가 매물을 올리면 사용자 알림함(`/notifications`)에 쌓입니다.

## 내부 운영 웹 · 공인중개사 웹

| 화면 | 경로 | 하는 일 |
| --- | --- | --- |
| 운영 로그인 | `/admin/login` | `ADMIN_PASSWORD`로 로그인 (`jp_admin` 서명 쿠키, 12시간) |
| 요청 목록 | `/admin` | 접수된 요청, 추천 생활권 계산 상태, 배정·제안 수 |
| 요청 상세 | `/admin/requests/:id` | 추천 생활권 목록, 생활권별 **근처 부동산 찾기**(검색어 + 네이버 검색·지도 링크 + 중개사무소 목록), 생활권을 골라 공인중개사에게 배정 |
| 공인중개사 | `/admin/agents` | 목록, 만들기(아이디·이름·전화번호·사무소 주소·사진, 비밀번호 비우면 임시 비밀번호), 비밀번호 초기화, 중지 |
| 공인중개사 가입·로그인 | `/agent/signup`, `/agent/login` | 직접 가입 (`jp_agent` 서명 쿠키, 30일) |
| 배정 요청 | `/agent`, `/agent/assignments/:id` | 배정된 요청 조건·생활권을 보고 매물 등록 → 주소로 가까운 역·출근 시간 계산 → 사용자에게 알림 |

- 근처 부동산 검색어는 생활권 대표 좌표 주변 순서로 만듭니다: `단지·건물명 부동산` → `역 이름 부동산` → `시군구 법정동 부동산` → `시군구 행정동 부동산`. 중개사무소 목록은 네이버 지역 검색 결과 중 업종이 부동산 중개인 곳만 남깁니다.
- 사진(공인중개사 프로필 320px, 매물 사진 긴 변 1600px)은 브라우저에서 줄여 `POST /api/uploads`로 받은 서명 주소로 S3에 직접 올립니다. 매물 주소는 주소 검색에서 골라 좌표와 함께 저장합니다.

## 주거 앵커 (추천 지역용 출발 좌표)

전월세 실거래 건물 좌표를 H3 격자로 묶어 TMAP 출발 좌표를 만듭니다. 키 발급, 실행 순서, 확인 SQL, 남은 작업은 [docs/residential-anchors.md](docs/residential-anchors.md)를 보세요.

```sh
pnpm pipeline:collect && pnpm pipeline:geocode && pnpm pipeline:anchors
```

## 참고

- Nest CLI 12는 Node 22.14에서 실행되지 않아, API는 `tsc`로 빌드하고 `apps/api/scripts/dev.mjs`(tsc --watch + node --watch)로 개발 서버를 띄웁니다.
- 환경변수 예시는 `apps/api/.env.example`, `apps/web/.env.example`. 실제 값은 `.env.local`에만 두고 커밋하지 않습니다.

개발 규칙은 `AGENTS.md`를 참고하세요.
