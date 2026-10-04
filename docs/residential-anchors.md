# 주거 앵커 (전월세 실거래 기반)

출근지까지의 대중교통 시간을 계산할 **출발 좌표**를 만드는 파이프라인입니다.
행정동 중심점이나 역 좌표 대신, 실제로 전월세 거래가 일어난 건물 좌표를 H3 격자(해상도 8, 한 변 약 460m)로 묶고
격자마다 실제 거래 건물 하나를 대표 좌표로 고릅니다.

## 1. 데이터와 키

| 데이터 | 받는 곳 | 환경변수 (`apps/api/.env.local`) |
| --- | --- | --- |
| 국토부 전월세 실거래 4종 (아파트·연립다세대·단독다가구·오피스텔) | [공공데이터포털](https://www.data.go.kr)에서 "국토교통부_○○ 전월세 실거래가 자료" 4개 활용신청 | `DATA_GO_KR_SERVICE_KEY` |
| 지번 → 좌표 (기본) | [브이월드](https://www.vworld.kr) 오픈API 인증키 (지오코더) | `VWORLD_API_KEY` |
| 지번 → 좌표 (보조, 선택) | 네이버 클라우드 콘솔 > Maps > Application 등록 후 Geocoding 체크 | `NAVER_MAP_CLIENT_ID`, `NAVER_MAP_CLIENT_SECRET` |
| 출근지 회사·빌딩명 검색 (선택) | 네이버 클라우드 콘솔 > NAVER API HUB > 검색 구독 (Maps와 다른 키) | `NAVER_API_HUB_CLIENT_ID`, `NAVER_API_HUB_CLIENT_SECRET` |
| 대중교통 경로 | [SK open API](https://openapi.sk.com) TMAP 대중교통 (요약 API `/transit/routes/sub`) | `TMAP_APP_KEY`, `TMAP_TRANSIT_API_URL` |

- 파일을 내려받을 필요는 없습니다. 모두 API로 받습니다.
- **단독다가구 실거래는 지번이 공개되지 않습니다.** 위치를 알 수 없어 앵커 좌표에는 쓰지 못하고, 법정동 단위 거래 수(`dong_detached_count`)와 시세(`legal_dong_rent_stats`)로만 반영합니다.
- 네이버 지오코딩은 약관상 결과 저장 범위를 확인한 뒤 쓰세요. 브이월드가 실패한 주소만 보조로 보냅니다.
- `TMAP_APP_KEY`가 없으면 외부 호출 없이 mock 제공자(직선거리 추정)를 씁니다. 실제 통근시간이 아닙니다.

## 2. 실행 순서

루트에서 실행합니다. 모두 다시 실행해도 중복이 생기지 않습니다.

```sh
pnpm db:migrate                         # 테이블 생성 (최초 1회, 이후 스키마 변경 시)

# 1) 실거래 수집: 기본은 지난달까지 12개월, 수도권 전체(82개 시군구), 4개 유형
pnpm pipeline:collect
pnpm pipeline:collect -- --from 202607 --to 202609 --regions 11620,11680 --sources rh,offi   # 일부만

# 2) 지번 → 좌표 (아직 없는 주소만, 거래 많은 주소부터)
pnpm pipeline:geocode -- --limit 20000 --concurrency 1 --interval 200

# 3) 앵커 생성 (H3 셀 묶기, 대표 좌표, 점수, 법정동 시세)
pnpm pipeline:anchors

# 4) 역 목록 (최초 1회, 노선 개통 시 다시)
pnpm pipeline:stations

# 5) 추천 생활권 (역세권 도보 15분 / 행정동 버스권). 앵커를 다시 만든 뒤 매번
pnpm pipeline:zones

# 6) 경로 확인: 점수 상위 앵커 → 출근지 TMAP 경로 (캐시 사용)
pnpm pipeline:transit-sample -- --dest 37.4979,127.0276 --limit 5
```

- 브이월드는 요청을 몰아서 보내면 잠시 연결을 끊습니다. `--concurrency 1 --interval 200` 정도로 천천히 돌리고, 실패한 주소는 다음 실행에서 다시 시도합니다.
- TMAP도 연달아 부르면 429를 돌려줍니다. 제공자가 1초 간격과 재시도를 자동으로 적용합니다.
- 수도권 전체 1년치는 거래 수십만 건, 고유 주소 약 10만 개 규모로 예상됩니다. 지오코딩은 일일 한도에 맞춰 여러 번 나눠 실행하세요.

## 3. 처리 방식

1. **수집**: 시군구 × 월 × 유형별로 받아 `rent_transactions`에 넣습니다. 같은 행은 내용 해시 + 같은 묶음 안 순번(`dedupe_key`)으로 중복을 막습니다.
2. **좌표**: `시도 시군구 법정동 지번`으로 지오코딩해 `geocoded_addresses`에 저장합니다. 성공·없음은 다시 호출하지 않습니다.
3. **격자**: 좌표가 있는 거래를 건물 단위로 모은 뒤 H3 해상도 8 셀로 묶습니다.
4. **대표 좌표**: 셀 안 건물들의 거래 수 가중 medoid(가중 거리 합이 가장 작은 건물). 건물이 300개를 넘으면 가중 중심에 가장 가까운 건물로 근사합니다. **항상 실제 거래 건물 좌표 중 하나**라 산·하천·도로 위에 찍히지 않습니다.
5. **점수**: `apps/api/src/residential/scoring.config.ts`
   - 거래 1건당: 오피스텔 3, 연립다세대 2, 아파트 1
   - 전용 40㎡ 이하 거래 1건당 +1
   - 같은 법정동 단독다가구 거래 수: `2 × ln(1 + n)`
   - 건물 2개 미만 또는 거래 5건 미만 셀은 제외
6. **저장**: `residential_anchors`는 셀 ID(`grid_id`)로 upsert하고, 이번에 만들어지지 않은 셀은 지웁니다.

## 4. 테이블

| 테이블 | 내용 |
| --- | --- |
| `rent_transactions` | 정규화한 실거래 (원본 필드 중 필요한 것만) |
| `geocoded_addresses` | 지번 주소 → 좌표 캐시, 제공자 기록 |
| `residential_anchors` | H3 셀별 대표 좌표, 행정구역, 유형별 거래 수, 시세 중위값, 점수 |
| `legal_dong_rent_stats` | 법정동 × 유형별 거래 수와 시세 중위값 |
| `transit_route_cache` | 경로 응답 캐시. 키 = 제공자 + 출발 셀 + 도착 좌표(소수 셋째 자리) + 출근 시간대 + 앵커 기준일, 30일 유지 |

## 5. 확인용 SQL

```sql
SET search_path = zipazum;

-- 유형별 수집 건수와 좌표 변환 대상
SELECT source, COUNT(*) AS n, COUNT(DISTINCT address_key) AS addresses FROM rent_transactions GROUP BY source;

-- 좌표 변환 결과
SELECT provider, status, COUNT(*) FROM geocoded_addresses GROUP BY 1, 2;

-- 점수 상위 앵커
SELECT sigungu, legal_dong, residential_score, transaction_count, building_count,
       officetel_count, multifamily_count, apartment_count, latitude, longitude
FROM residential_anchors ORDER BY residential_score DESC LIMIT 20;

-- 강남역 반경 5km 앵커 (직선거리)
SELECT sigungu, legal_dong, residential_score,
       6371 * 2 * asin(sqrt(power(sin(radians(latitude - 37.4979) / 2), 2)
         + cos(radians(37.4979)) * cos(radians(latitude)) * power(sin(radians(longitude - 127.0276) / 2), 2))) AS km
FROM residential_anchors ORDER BY km LIMIT 20;

-- 경로 캐시
SELECT origin_grid_id, best_minutes, best_transfer_count, no_transfer_minutes, fetched_at FROM transit_route_cache ORDER BY fetched_at DESC LIMIT 20;
```

## 6. API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/residential-anchors` | `latitude`, `longitude`, `radiusKm`(기본 15), `limit`(기본 50), `minScore`, `housingTypes`(officetel,multifamily,apartment,detached). 좌표가 없으면 점수순 |
| GET | `/api/residential-anchors/:id` | 상세, 유형별 거래 수, 법정동 시세, 지도용 경계(GeoJSON Polygon) |

통근시간은 이 API에 넣지 않았습니다. 경로 계산은 `TransitRouteCacheService`(`apps/api/src/transit/`)가 맡습니다.

## 7. 현재 범위와 남은 작업

> 추천 단위를 법정동에서 역세권·버스권 생활권으로 바꾸는 기획은 [commute-zones-plan.md](commute-zones-plan.md)를 보세요.


**됨**
- 실거래 수집·정규화·중복 방지, 브이월드+네이버 지오코딩과 캐시
- H3 앵커 생성, 대표 좌표, 점수, 법정동 시세
- 앵커 목록·상세 API
- `TransitRouteProvider` 인터페이스, TMAP 제공자(호출 간격·재시도), mock 제공자, 경로 캐시

**남음**
- 수도권 전체·12개월 수집과 지오코딩 (일일 한도에 맞춰 나눠 실행)
- 요청 접수 시 출근지 기준 후보 앵커 → TMAP 계산 → 추천 지역 결과 저장 (백그라운드 작업)
- 단독다가구 위치 보강: 국토부 GIS건물통합정보에서 다가구·다중주택 위치를 뽑아 동 단위 거래를 배분 (A 방식)
- 점수 보정: 공공임대 아파트 단지처럼 소형 아파트가 많은 곳이 높게 나오는 문제, 최근 거래 가중
- 출근지 검색(주소·회사명 → 좌표)
