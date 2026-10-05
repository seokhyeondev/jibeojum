# 배포

웹은 Vercel, API는 AWS(893918474407, 서울)에 있다.

```
브라우저 ──https──▶ Vercel (Next.js)
                     │  /api/* 를 그대로 넘김 (next.config.ts rewrites, API_URL)
                     ▼
              CloudFront d2ax97ny1avlxk.cloudfront.net  (HTTPS, 캐시 안 함)
                     │  X-Origin-Verify 헤더를 붙여 HTTP로 전달
                     ▼
              ALB zipazum-api  (CloudFront IP만 허용, 헤더가 맞을 때만 전달)
                     ▼
              ECS Fargate  zipazum / zipazum-api  (ARM64, 0.25 vCPU · 0.5 GB, 1개)
                     ├─▶ RDS zipazum-db (PostgreSQL 16)
                     └─▶ S3 zipazum-assets-…  ──▶ CloudFront d1lgf9m8snr8ud.cloudfront.net (사진)
```

- 브라우저는 Vercel 도메인의 `/api`만 부른다. 쿠키(로그인)도 Vercel 도메인에 붙고 CORS가 필요 없다.
- 도메인이 생기면 ACM 인증서를 ALB(또는 CloudFront)에 붙이고 `API_URL`만 바꾼다.

## Vercel (웹)

웹은 세 프로젝트로 따로 배포한다(사용자·공인중개사·운영). 사용자 앱(Capacitor)은 사용자 웹만 감싸므로 운영·중개사 화면이 앱에 들어가지 않는다.

**사용자 웹** (`zipazum.com`, `www.zipazum.com`)

| 설정 | 값 |
| --- | --- |
| Root Directory | `apps/web` |
| Install / Build | `apps/web/vercel.json` |
| 환경 변수 `API_URL` | `https://d2ax97ny1avlxk.cloudfront.net` |
| 환경 변수 `NEXT_PUBLIC_PARTNERS_URL` | `https://partner.zipazum.com` (랜딩의 공인중개사 링크, 예전 주소 리다이렉트) |
| 환경 변수 `ADMIN_URL` | `https://admin.zipazum.com` (예전 `/admin` 주소 리다이렉트) |

**공인중개사 웹** (`partner.zipazum.com`, `apps/partner`: `/partners` 소개, `/agent` 공인중개사)

| 설정 | 값 |
| --- | --- |
| Root Directory | `apps/partner` |
| Install / Build | `apps/partner/vercel.json` |
| 환경 변수 `API_URL` | `https://d2ax97ny1avlxk.cloudfront.net` |
| 환경 변수 `NEXT_PUBLIC_WEB_URL` | `https://zipazum.com` (약관·개인정보처리방침·고객용 서비스 링크) |

**운영 웹** (`admin.zipazum.com`, `apps/admin`: `/admin`)

| 설정 | 값 |
| --- | --- |
| Root Directory | `apps/admin` |
| Install / Build | `apps/admin/vercel.json` |
| 환경 변수 `API_URL` | `https://d2ax97ny1avlxk.cloudfront.net` |

사용자 웹에는 `NEXT_PUBLIC_PARTNERS_URL`(공인중개사 웹), `ADMIN_URL`(운영 웹)을 넣는다. 예전 `/agent`·`/partners`·`/admin` 주소를 그쪽으로 보낸다.

DNS는 Route 53 `zipazum.com` 호스팅 영역에 있다: `zipazum.com` A 76.76.21.21, `www`·`partner`·`admin` CNAME `cname.vercel-dns.com` (Vercel).

API의 `PARTNER_ORIGIN`(ECS 태스크 정의)에 공인중개사 웹 주소를 넣는다. 초대 링크가 그쪽으로 나간다.

## API 배포

**자동:** `main`에 `apps/api/**`, `packages/shared/**`, `pnpm-lock.yaml`이 바뀐 커밋이 올라오면 GitHub Actions(`.github/workflows/deploy-api.yml`)가
타입체크·테스트 후 배포한다. Actions 탭에서 "Deploy API → Run workflow"로 손으로 돌릴 수도 있다.
AWS 키는 GitHub에 없다. OIDC로 `zipazum-github-deploy` 역할(빌드 시작·ECS 갱신만 가능)을 잠깐 빌린다.
신뢰 조건은 `repo:seokhyeondev@64835957/zip-a-zum@1404607378:ref:refs/heads/main` (이 저장소 ID의 main 브랜치만). 저장소 이름을 바꾸면 이 조건도 바꿔야 한다.

**수동 (로컬):**

```sh
pnpm db:migrate     # 스키마가 바뀌었으면 먼저 (SQL 검토 후). 자동 배포도 마이그레이션은 하지 않는다
pnpm deploy:api     # 소스 → S3 → CodeBuild(이미지) → ECR → ECS 롤링 배포
```

- 로컬에 Docker가 없어도 된다. `aws` CLI와 `default` 프로필(893918474407)만 있으면 된다.
- 새 태스크가 헬스체크(`/api/health`)를 통과하지 못하면 ECS가 이전 버전으로 되돌린다.
- 로그: CloudWatch `/ecs/zipazum-api` (빌드 로그는 `/aws/codebuild/zipazum-api-build`)

## 환경 변수

- 비밀값: SSM Parameter Store `/zipazum/prod/*` (SecureString). 태스크가 시작할 때 읽는다.
  `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`, `TMAP_APP_KEY`, `VWORLD_API_KEY`, `NAVER_MAP_*`, `NAVER_API_HUB_*`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`
- 일반 값: 태스크 정의 `zipazum-api`의 environment (`KAKAO_REDIRECT_URI`, `ASSET_BASE_URL`, `TRUST_PROXY_HOPS=3` 등)
- 값을 바꾼 뒤에는 `aws ecs update-service --cluster zipazum --service zipazum-api --force-new-deployment`로 다시 띄운다
  (태스크 정의를 고쳤으면 새 리비전을 등록하고 `--task-definition zipazum-api`).

## AWS 리소스 (모두 `Service=zipazum` 태그)

| 종류 | 이름 |
| --- | --- |
| RDS | `zipazum-db` (보안 그룹 `zipazum-rds`: 개발 PC IP, `zipazum-api`) |
| ECR | `zipazum-api` (최근 10개 이미지 유지) |
| CodeBuild | `zipazum-api-build` (buildspec: `infra/api-buildspec.yml`), 소스 버킷 `zipazum-build-893918474407` (14일 후 삭제) |
| ECS | 클러스터 `zipazum`, 서비스·태스크 정의 `zipazum-api` |
| ALB | `zipazum-api` (보안 그룹 `zipazum-alb`), 대상 그룹 `zipazum-api` |
| CloudFront | API `E1UTYCUKXNE92U`, 사진 `E6661YDMC3G0F` |
| S3 | `zipazum-assets-893918474407` (사진) |
| IAM | `zipazum-codebuild`, `zipazum-ecs-execution`, `zipazum-api-task`(사진 업로드만), `zipazum-github-deploy`(GitHub Actions, OIDC) |
| SSM | `/zipazum/prod/*` |

같은 계정에 다른 서비스 운영 리소스가 있다. `zipazum-*` 밖은 건드리지 않는다.
