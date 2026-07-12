# 링고 API 계약서 v2.1 (41창→43창) — 통합판

발행: 2026-07-11 · 41창 · **정본** (v1 2종 및 v2 를 대체) · v2.1 변경 = done 프레임에 actions_sent / intent_sent 추가
반영 배포: lingo-chat Edge (T2~T6b 전부) + /api/lingo/chat 라우트 (voice 개방분은 Workers 배포E 편입 대기)

---

## 0. 엔드포인트

`POST /api/lingo/chat` — 쿠키 세션 인증(별도 토큰 불요). 응답은 SSE 또는 JSON(오류·종료).

## 1. 요청 body

```json
{
  "surface": "studio | home",            // 생략 = studio
  "session_id": "uuid | 생략(새 세션 자동 생성)",
  "message": "string, ≤2000자",
  "input_channel": "text | voice",       // 생략 = text. voice = STT 전사 텍스트
  "context": {
    "drop_id": "uuid | 생략",
    "video_summary": "string | 생략",
    "key_points": ["string"],
    "studio_state": { "자유형식 요약(대화 접지용)" },
    "studio": {                          // ★ 액션 기능 스위치 — 있을 때만 actions 활성
      "mode": "general | reserve | commerce",
      "deck": [ { "id": "product", "label": "상품", "applied": false, "locked": false } ],
      "fields": { "title":"", "subtitle":"", "date":"", "time":"", "coupon":"",
                  "productName":"", "productPrice":"", "clip":"", "dock":"" }
    }
  }
}
```
- surface='home' 이면 context.studio 는 서버가 무시(게이트) — 홈에선 액션 불가, 인텐트만.
- 세션 종료(장기기억 추출 트리거): `{"action":"close","session_id":"uuid"}` 만 보내면
  JSON `{"closed":true,"facts_added":N}` 반환. **UI 는 대화창 닫힘/이탈 시 호출 권장**
  (fire-and-forget 가능, 멱등 — 중복 호출 안전).

## 2. SSE 이벤트 (event: / data:)

| event | data | 발생 |
|---|---|---|
| meta | `{"session_id","stage","surface"[,"stage_changed":"guide→assist"]}` | 시작 1회 |
| delta | `{"text"}` | 토큰 단위 다수 |
| actions | `{"actions":[...],"steps":[...]}` | studio + 유효 액션 시, done 직전 ≤1회 |
| intent | `{"intent":"create"\|"explore"}` | home + 인텐트 확정 시, done 직전 ≤1회 |
| done | `{"message_id","tokens_used","cost_krw","actions_sent","intent_sent"}` | 정상 종료 |
| error | `{"code","friendly"}` | 실패 — friendly 를 일반 말풍선 톤으로 |

JSON(비 SSE) 응답: 400/401/403/429/502 — `{"code","friendly"}` 동일 처리.
알 수 없는 event/필드는 무시(전방 호환) — v1 파서는 그대로 동작.
- **actions_sent / intent_sent (v2.1)**: 해당 이벤트를 이번 응답에서 실제 방출했는지 1비트. 클라이언트는
  `actions_sent=true` 인데 액션 제안이 화면에 없으면(SSE 유실) 텍스트 해석 없이 정직 안내를 띄울 수 있다.
  두 필드는 surface 무관 항상 포함(미방출=false).

## 3. actions 스키마 (studio 전용 — v0 45 applyLingoActions 1:1)

- type 4종만: `switchMode{mode}` `equip{blockId}` `detach{blockId}` `setField{field,value}`
  (발행·전송·결제·삭제류는 스키마 미존재 — 가역 조작만, 42창 조건 이행)
- field 11종: title, subtitle, clip, date, time, coupon, productName, productPrice, dock, phone, map
  (phone/map value = "true"/"false")
- 한도: actions ≤8, steps ≤5(label 필수·note 선택, 통째 조립 시에만)
- **서버 검증 보증**(도달분은 통과됨): 화이트리스트 / deck 실존 blockId / locked equip 제거 /
  productPrice 숫자·콤마만 / 개수 절단 / 진실경계(사용자가 말한 값만 — 가격·날짜·쿠폰 창작 금지,
  모호하면 액션 없이 되물음) / meta 감사 저장
- UI 최종 가드 유지 권장(applied 재확인·잠금 재확인·lingoUndo).
- 실측 검증: "사과 5kg 팔고 싶어"(가격 미언급)→액션 0·되묻기 / locked 쿠폰→장착 0·안내 /
  값 완비→equip+정확 기입+steps.

## 4. intent (home 전용)

- 값 2종만: `create`(만들려는 의도) / `explore`(둘러보려는 의도). 서버 enum 검증.
- 불분명하면 이벤트 없이 한 번만 되묻고, 답변은 1~3문장 배웅 톤.
- UI 권장: create → 만들기 진입, explore → 탐색 진입. 이벤트 없으면 대화 지속.

## 5. voice

- input_channel:"voice" 허용(Edge 반영 완료). STT/TTS 는 클라이언트(브라우저 내장) — 서버는
  전사 텍스트를 받을 뿐. lingo_sessions.input_channel 에 기록됨.
- /api 라우트의 voice 허용은 Workers **배포E 편입** — 그 전까지 42창 text 폴백 유지(무단절 확인됨).

## 6. stage (개입곡선 — T6)

- 값: guide(풀개입) / assist(동행) / standby(대기). **surface 별 독립**(홈과 스튜디오 곡선 분리).
- 자동 전이(새 세션 생성 시에만 평가, 세션 중 불변):
  guide→assist 4세션 ≥ / assist→standby 10세션 ≥ / 30일 이상 미접속 복귀 시 한 단계 강하.
  상수는 측정 기반 튜닝 대상(파일럿 후 조정).
- UI 활용(선택): meta.stage 로 패널 첫 제안의 적극성 조절, stage_changed 로
  "이제 익숙해지셨네요" 마이크로 카피 1회 노출 가능.
- 실측: 검수계정 guide→assist 자동 승급 확인(2026-07-11).

## 7. 비용·측정 참고

- 대화 1회 3~7원(스튜디오 액션 시 상단). 전 호출 ai_generations(generation_type='lingo_chat')
  + lingo_messages(토큰·비용·meta 감사)에 적재 — 대시보드 집계 가능.
- 회귀 검증: `bun run scripts/t4-lingo-smoke.mjs [single|multi|close|actions|home]`

문의는 Duke 형님 경유 41창. — 링고 백엔드 100%, UI 배선만 남음.
