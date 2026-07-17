# 거울 수렴 경계 판정 v1 (2026-07-17)

READ 판정 정본. 대상: `/d` 소비자 화면 ↔ 스튜디오 미리보기 ↔ 피드 카드의 렌더 경로 수렴.
수술 순서·경계의 단일 기준선. 정산 코드(`distribute_rewards_safe`·`reward_rule_items`)는 범위 밖.

## ① 표면 트리 3개

### A. 스튜디오 미리보기 (신 경로 · 정본)
```
/studio-build → StudioBuildSwitch (studio-build.tsx:2849)
  └─ 기본: CardStudioPage45
       state ──► fromStudioState(state, preview)   [card-model-adapters.ts:262]
              ──► CardModel ──► <CardModelBody variant="studio">   [CardStudioPage45.tsx:3029]
       거울 시트(수신 미리보기) = 같은 CardModel ──► <CardModelBody variant="share">   [:4713]
  └─ ?legacy=1: CardStudioPage → <CardBody mode="preview"> + JSX 슬롯 (DropCardShell:1452, CardBody:1479)
```
신 스튜디오는 **거울 5파일을 우회**하고 `card-model/`(CardModelBody + card-model-adapters) 별세트 사용.

### B. 소비자 /d (구 경로 · 매출 표면)
```
route d.$shareUuid → get_drop_detail RPC
  └─ infoDropAdapter(detail)  [src/lib/adapters.ts:424] → InfoDropPageProps
       └─ <InfoDropPage> (info-drop-page.tsx:1289) — variant 4분기:
            ├ info·coupon·reservation → toCardBodyProps → <CardBody> (DropCardShell 래핑) [:1401/1437/1529]
            ├ purchase+commerce       → buildProductWidget → <ProductWidget> (독립 section) [:1687]
            ├ purchase+무commerce      → <PurchaseCardBody> (AiPriceComparisonCard) [:1698]
            └ lead                    → <ConsultationLeadForm> [:1887]
       └─ 페이지 레벨(본체 밖): StockMeta[:1719]·SaleDdayBadge·RestockAlertButton·GroupBuySection·
            NoticeRowsSection·promoCards[:1753]·attachedProducts[:1817]·attachedVideos[:1950]·
            스티키 쿠폰받기[:2040]·상단 크롬(maker/공식배지/구독 [:1306~1367])
```
/d는 **거울 5파일 전부 실사용**. `card-model/` 미사용. `fromDropDetail`(소비자→CardModel)은 작성됐으나 **import 0 = 미마운트**.

### C. 피드/탐색 카드
```
DropFeedItem → <ShareCardTile> (ShareCardTile.tsx:146) [home·explore]
   grid(:311)/row(:201) 자체 마크업 — CardBody/CardModelBody 재사용 0
   조각: 썸네일·maker·title·purpose칩(3종)·StockMeta·ShareChainMeta·DropyBadge·TimerBadge (가격 없음)
```
피드는 **전용 미니 렌더러**. 거울 5파일·card-model 둘 다 우회.

### 거울 5파일 실사용 여부
| 파일 | 신 스튜디오 | /d 소비자 | 레거시 스튜디오 | 피드 |
|---|---|---|---|---|
| CardBody.tsx | ✗ | ✅(info/coupon/reserv) | ✅ | ✗ |
| CardBody.types.ts | ✗ | ✅ | ✅ | ✗ |
| src/lib/adapters.ts | ✗ | ✅(infoDropAdapter/toCardBodyProps/buildProductWidget) | ✅ | ✗ |
| studio-build.tsx | ✅(래퍼) | ✗ | ✅ | ✗ |
| info-drop-page.tsx | ✗ | ✅ | ✗ | ✗ |
| **card-model-adapters + CardModelBody** | ✅ | ✗(미마운트) | ✗ | ✗ |

## ② 세 표면 렌더 차이 (3분류)

| 분류 | 항목 | 스튜디오(CardModelBody) | /d(CardBody/Widget) | 피드(ShareCardTile) |
|---|---|---|---|---|
| 컴포넌트 자체 다름 | 본체 렌더러 | 선언형 CardModel 단일 | 4-variant 분기 | 전용 미니 |
| | 외부스크랩 구매 | 없음 | PurchaseCardBody/AI가격비교 | — |
| | lead 상담 | 없음 | ConsultationLeadForm | — |
| 필드 누락 | 45폼 신규필드 | 미리보기 렌더 | 저장만·미렌더(ST2b 락) | — |
| | 여정/확산수 | 주입 거부(수신 전 무의미) | journey/shareCount 주입 시 | ShareChainMeta |
| | 가격 | priceText | ProductWidget priceKrw | 미표시 |
| | 드로피 | 필드 자체 없음 | "적립(준비중)" 숫자락 | "적립(준비중)" 숫자락 |
| 스타일 상이 | 카드 프레임 | 흰 카드(rounded 14) | navy+holo(DropCardShell) | 정사각 타일 |
| | 재고 배지 | productQty+Unit inline | StockMeta(페이지 레벨) | StockMeta(타일) |
| | pop/burst/점선슬롯 | studio 게이트 | 없음 | 없음 |

### BUG-2 증상 봉합 위치 (중복 표시)
**드로피 "적립(준비중)" 숫자 락 — 2곳 중복 구현:**
- `ShareCardTile.tsx:124-130` `DropyBadge` — reward 무시, "적립 (준비중)" (피드)
- `ProductWidget.tsx:188` — 락 §드로피, 숫자 미표시 (/d 구매)
- CardModel엔 드로피 필드 부재 → 신 스튜디오는 미렌더(제3 처리). **동일 락을 두 컴포넌트가 각자 구현 = 중복.**

**재고 단위(박스/망/kg) '개' 폴백 — 4곳 분산:**
- `src/lib/adapters.ts:245,265,579-580` — 구경로 stockUnitLabel 산출·관통
- `card-model-adapters.ts:83,186` — 신경로 `productQtyUnit` 관통
- `ProductWidget.tsx:34` — '개' 폴백(/d)
- `ShareCardTile.tsx:94,114` — '개' 폴백(피드)
- `info-drop-page.tsx:1718-1719` — 페이지 레벨 StockMeta unitLabel
- **단일 소스 아님 = 각 표면 독립 폴백**. 우연히 문자 동등이라 현재 안 깨짐. 한 곳만 실단위 주입 시 표면 불일치 재발. **BUG-2 = 이 분열의 증상.**

## ③ A/B 비교

| 축 | A안: /d → CardModelBody 통일 | B안: 공용 CardCore 신설 |
|---|---|---|
| 영향 파일 수 | 中(~3–5): info-drop-page 분기 교체·fromDropDetail 마운트(존재)·구어댑터 정리·CardModel 소폭 additive | 高(~8–12): CardCore 신설 + 전 표면 재배선 |
| variant 파급 | fromDropDetail이 info/coupon/reservation/purchase 이미 매핑. lead·외부스크랩=비거울 존치 | 전 표면·전 variant 동시 |
| 단계 분할 | 가능 — info-drop-page variant 분기 → 한 분기씩 교체 | 어려움 — 코어 교체 원자적 |
| 롤백 | 쉬움 — 한 분기만 CardBody 복귀 | 어려움 — all-or-nothing |
| 회귀 위험 | purchase(ProductWidget) 페이지 조각 매핑이 최대. info/coupon/reservation 저위험 | live 3표면 동시 = 최대 |
| B 실시간 연출 | 깨끗 — pop/burst/슬롯 studio 게이트 → receiver 유출 0 | 코어에 studio 게이트 재구현 필요 |

**판정: A안(강한 우세).** CardModel = "거울 2.0" 정본, fromDropDetail 선작성·대기, 스튜디오 이주 완료, B연출 variant 게이트 안전화. B는 CardModel이 곧 공용 코어인데 세 번째 렌더러 중복. BUG-2 단위/드로피 중복도 A로 단일 소스화 시 원천 소멸.

## ④ 슬라이스 초안 (각 = 독립 커밋·독립 검증)

- **S0 (준비·additive)**: CardModel 갭 additive — 드로피 "준비중" 라인(receiver 게이트·숫자 락)·groupBuy(존재)·여정/확산(존재)·CardModelActions 콜백 정비. 렌더러 확장, 마운트 0. 회귀 0.
- **S1 (info)**: info 분기만 CardBody→CardModelBody(fromDropDetail, receiver). 최단순. fromDropDetail 첫 실마운트 검증. **← 별도 승인 필요**
- **S2 (coupon)**: couponLabel/couponExpiresAt/TimerBadge(존재).
- **S3 (reservation)**: 본체만 교체, 캘린더(ReservationCalendarClient)는 페이지 크롬 존치.
- **S4 (purchase·최고위험 마지막)**: ProductWidget→CardModelBody. 페이지 조각(StockMeta/GroupBuy/RestockAlert/NoticeRows) 본체 밖 존치. 외부스크랩·lead 범위 밖.
- **S5 (정리)**: 구어댑터(toCardBodyProps/buildProductWidget) 폐기 + BUG-2 단위 이중배선 삭제(단일 productQtyUnit).
- **범위 밖(존치)**: 피드 ShareCardTile·lead·외부스크랩·정산 코드.

**권고 순서**: S0 → S1(info) → S2 → S3 → S4(purchase) → S5. 본체 vs 페이지 크롬 경계를 S0에서 확정하는 게 전체 회귀 위험 최대 감소.
