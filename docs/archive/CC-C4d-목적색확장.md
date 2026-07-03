C4d — v0 스펙대로 목적색(MODE_ACCENT)을 버튼 외 뱃지·게이지·별·placeholder 틴트까지 확장 적용한다. studio-build.tsx 1파일만. 커밋 금지·git add 금지·stash 금지. READ-before-claim.

[v0 배색 문법(스펙)]
솔리드 accent = 주 액션·모드 뱃지 / 틴트 = style backgroundColor `${accent}14`(뱃지) `${accent}12`(칩) `${accent}08`+borderColor `${accent}30`(placeholder) / color: accent = 점수 숫자·아이콘. 동적 hex라 전부 style 속성(Tailwind 클래스 불가).

[STEP 1 — READ]
studio-build.tsx에서 다음 요소의 현재 위치·색 확인(파일:라인):
a) 헤더 모드 뱃지(카드 스튜디오 옆 "예약·쿠폰" pill)
b) 완성도 별(우상단 ★)·게이지 바·점수 숫자·게이지 아이콘칩
c) 카드 상단 카테고리/모드 표시(있다면)
d) 영상 placeholder(현 isLightCard시 bg-[#FAFAFA] ring-[#E5E5E5])
e) 행동 placeholder(dashed)
f) 덱 카드 isMain 표시·덱 인디케이터
g) MODE_ACCENT 상수(250-254)와 buildMode.

[STEP 2 — 적용 (v0 문법 그대로)]
const accent = MODE_ACCENT[buildMode]; 파생 후:
- 헤더 모드 뱃지: style={{ backgroundColor: accent }} + text-white.
- 별: 채워진 별 fill/color=accent, 빈 별 #D4D4D4.
- 게이지 바 채움·점수 숫자 color·아이콘칩 `${accent}14`+color accent.
- 영상 placeholder(라이트 상태): bg `${accent}08` + border/ring `${accent}30` + 아이콘칩 `${accent}16` color accent (v0 545·549 방식). 다크 셸(dormant) 경로는 기존 유지.
- 행동 placeholder(라이트): borderColor `${accent}30`, 텍스트는 가독 위해 text-text-muted 유지(과한 틴트 금지 — 한 화면 한 액센트, 필요 최소만).
- 덱 isMain 링/아이콘·인디케이터 활성색: accent.
- 이미 적용된 것(탭 pill·Wand2·쿠폰받기 pill) 0터치.
- 모드 전환 시 전부 즉시 색 변경(accent가 buildMode 파생) 확인.

[가드]
- studio-build.tsx 1파일만. 공유 3파일·ProductWidget·CardBody·DropCardShell 0터치(공유 색 전파는 별도 결정 유지).
- C4b/C4c 기존분 보존. 저장 로직 0터치.
- 과공학 금지: v0에 있는 요소만, 우리에 없는 요소는 만들지 말고 "해당 없음" 보고.

[확인 — 커밋 금지] tsc EXIT 0. git status -s → studio-build.tsx만. 형님 육안 검수 대기.

[보고 — 한국어] STEP 1 각 요소 위치(라인)·해당 없음 목록. STEP 2 적용 내역(요소별 방식). tsc·status. 커밋 안 함 명시. 예상 밖 별도.
