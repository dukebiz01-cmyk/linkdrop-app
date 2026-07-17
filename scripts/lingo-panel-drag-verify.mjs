// lingo-panel-drag-verify — 링고 패널 드래그 히트영역 회귀 하네스(3차 수술 게이트).
//   실손 재현 케이스: "⠿ 아닌 헤더 임의 지점에서 드래그 시작". 합성 이벤트가 ⠿를 정밀
//   타격해 PASS 하던 1·2차와 달리, 실제 손가락은 헤더 행 아무 데나 잡는다 → 그 좌표가
//   드래그 핸들러에 닿는지(히트영역)와, 닿은 뒤 클램프/원점 정합으로 fabPos 가 실제로
//   1:1 이동하는지를 함께 검증한다. 홈·스튜디오 미러 동일 로직.
//   실행: node scripts/lingo-panel-drag-verify.mjs
//   DOM 라이브러리 없이 React 합성 pointerdown 위임(버블 + stopPropagation) 의미를 모델링.

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) failures++; };

// ── React pointerdown 위임 모델 ─────────────────────────────────────────────
// React 는 루트에서 위임하며 자식 onPointerDown 의 stopPropagation 은 부모 onPointerDown
// 도달 전에 버블을 끊는다 → 네이티브 버블 + stopPropagation 과 동치. 그 최소 모델.
function node(name, { onPointerDown, stops } = {}, children = []) {
  return { name, onPointerDown, stops: !!stops, children, parent: null };
}
function mount(root) { for (const c of root.children) { c.parent = root; mount(c); } return root; }
// target 노드에서 pointerdown 발생 → 조상으로 버블. stops=true 노드에서 전파 중단.
function dispatchPointerDown(target, evt) {
  let cur = target;
  while (cur) {
    if (cur.onPointerDown) cur.onPointerDown(evt);
    if (cur.stops) return;              // stopPropagation — 부모로 안 감
    cur = cur.parent;
  }
}

// ── 수술 후 헤더 DOM(홈·스튜디오 공통 구조) ──────────────────────────────────
// 헤더 행 전체 = 드래그 존(onPanelDown). ⠿/아바타/타이틀 = 핸들러 없음(버블만).
// 스피커 래퍼·접기 버튼 = stopPropagation(드래그 제외).
let dragStarted = false, dragStartTargetName = null;
const onPanelDown = () => { dragStarted = true; };

function buildHeader() {
  dragStarted = false; dragStartTargetName = null;
  const grip = node("gripVisual(⠿)");            // 시각 안내, 핸들러 0
  const avatar = node("avatarBadge");             // 핸들러 0
  const title = node("titleText(링고AI)");        // 핸들러 0 — 실손이 잘 잡는 넓은 면
  const speaker = node("speakerToggle", { stops: true, onPointerDown: () => {} });
  const collapse = node("collapseBtn", { stops: true, onPointerDown: () => {} });
  const header = node("headerRow", { onPointerDown: onPanelDown }, [grip, avatar, title, speaker, collapse]);
  mount(header);
  return { header, grip, avatar, title, speaker, collapse };
}
const press = (n) => { dragStarted = false; dragStartTargetName = n.name; dispatchPointerDown(n, { clientX: 0, clientY: 0, pointerId: 1 }); };

console.log("[1] 히트영역 — 헤더 임의 지점에서 드래그 시작(실손 재현 케이스)");
{
  const h = buildHeader();
  press(h.title);   ok(dragStarted, "타이틀 텍스트(⠿ 아닌 임의 지점) 누름 → 드래그 시작 O  ← 이번 실손 재현 케이스");
  press(h.avatar);  ok(dragStarted, "아바타 배지(임의 지점) 누름 → 드래그 시작 O");
  press(h.grip);    ok(dragStarted, "⠿ 시각 손잡이 누름 → 드래그 시작 O(존치)");
  press(h.header);  ok(dragStarted, "헤더 행 빈 여백 누름 → 드래그 시작 O");
  press(h.speaker); ok(!dragStarted, "스피커 토글 누름 → 드래그 시작 X(stopPropagation, 토글만)");
  press(h.collapse);ok(!dragStarted, "접기 버튼 누름 → 드래그 시작 X(stopPropagation, 접기만)");
}

// ── 실제 소스 원점/클램프 수학 포팅(홈 LingoHomeBox / 스튜디오 CardStudioPage45 동일) ──
const FAB_MARGIN = 12, FAB_SIZE = 56, FAB_BOTTOM_RESERVE = 96, PANEL_MAXW = 332;
const panelWidth = (vw) => Math.min(PANEL_MAXW, Math.round(vw * 0.85));
// onPanelDown 원점 계산(재판정 수술): x 원점 = 렌더된 패널 left 와 일치하도록 클램프.
function panelDownOrigin(fabPos, vw, vh) {
  const pw = panelWidth(vw);
  const maxX = Math.max(FAB_MARGIN, vw - pw - FAB_MARGIN);
  const ox = Math.min(Math.max(FAB_MARGIN, fabPos?.x ?? Math.round((vw - pw) / 2)), maxX);
  const oy = fabPos?.y ?? vh - 200;
  return { ox, oy };
}
// onPanelMove: 자유 2축, 패널 폭 기준 클램프.
function panelMove(origin, sx, sy, ex, ey, vw, vh) {
  const nx = origin.ox + (ex - sx);
  const ny = origin.oy + (ey - sy);
  const maxX = Math.max(FAB_MARGIN, vw - panelWidth(vw) - FAB_MARGIN);
  const maxY = vh - FAB_SIZE - FAB_BOTTOM_RESERVE;
  return { x: Math.min(Math.max(FAB_MARGIN, nx), maxX), y: Math.min(Math.max(FAB_MARGIN, ny), maxY) };
}

console.log("[2] 이동 정합 — 임의 지점에서 잡아 끌기(우측끝 캡슐, 클램프 흡수 0)");
{
  // (a) 모바일 390px — 85% 패널(332) 은 가로 자유폭이 34px([12,46]) 뿐. 첫 픽셀부터 1:1 인지
  //     (원점=렌더 left) + 작은 드래그가 즉시 반영되는지(안 움직임 아님)를 본다.
  const vw = 390, vh = 844, pw = panelWidth(vw);
  const fabPos = { x: vw - FAB_SIZE - FAB_MARGIN, y: 600 };   // 우측 끝 스냅
  const origin = panelDownOrigin(fabPos, vw, vh);
  const renderLeftBefore = Math.min(Math.max(FAB_MARGIN, fabPos.x), Math.max(FAB_MARGIN, vw - pw - FAB_MARGIN));
  ok(origin.ox === renderLeftBefore, `모바일: 원점 ox(${origin.ox}) == 렌더 left(${renderLeftBefore}) — 첫 픽셀 1:1(클램프 흡수 0)`);
  const sx = 250, sy = 120;                                   // 임의 헤더 지점(⠿ 아님) 시작 — 델타만 사용
  const small = panelMove(origin, sx, sy, sx - 10, sy, vw, vh);
  ok(small.x === renderLeftBefore - 10, `모바일: 좌 10px 즉시 반영 ${renderLeftBefore}→${small.x} — 데드존 0(1차 실손 '안 움직임' 해소)`);
  const far = panelMove(origin, sx, sy, sx - 120, sy, vw, vh);
  ok(far.x === FAB_MARGIN, `모바일: 좌 120px → 좌측 클램프 ${far.x}(가로 자유폭 34px 소진, 뷰포트 완전 수납)`);

  // (b) 태블릿 800px — 패널(332) 가로 여유 충분 → 120px 드래그가 그대로 120px 이동.
  const tw = 800, th = 1000, tpw = panelWidth(tw);
  const tfab = { x: tw - FAB_SIZE - FAB_MARGIN, y: 500 };
  const torigin = panelDownOrigin(tfab, tw, th);
  const tLeft = Math.min(Math.max(FAB_MARGIN, tfab.x), Math.max(FAB_MARGIN, tw - tpw - FAB_MARGIN));
  const tmoved = panelMove(torigin, 400, 200, 400 - 120, 200, tw, th);
  ok(tmoved.x === tLeft - 120, `태블릿: 좌 120px → left ${tLeft}→${tmoved.x}(정확히 -120, 자유 이동)`);
}

// ── 열림 위치 보정(3차): 클램프 후 좌/우 여백 <12px 이면 중앙 수납. 정상 경로 미개입. ──
function openLeft(fabPos, vw) {
  const pw = panelWidth(vw);
  const fx = fabPos?.x ?? Math.round((vw - pw) / 2);
  let left = Math.min(Math.max(FAB_MARGIN, fx), Math.max(FAB_MARGIN, vw - pw - FAB_MARGIN));
  if (left < FAB_MARGIN || vw - (left + pw) < FAB_MARGIN) left = Math.max(FAB_MARGIN, Math.round((vw - pw) / 2));
  return { left, pw };
}
console.log("[3] 열림 보정 — fabPos 공유 계약 유지 + 초협폭 가드");
{
  const vw = 390;
  // 정상: 우측끝 캡슐 → 클램프된 fabPos-앵커 left 유지(중앙으로 튀지 않음 = 과보정 금지).
  const r1 = openLeft({ x: vw - FAB_SIZE - FAB_MARGIN, y: 600 }, vw);
  const clamped = vw - r1.pw - FAB_MARGIN;
  ok(r1.left === clamped, `정상 뷰포트: left(${r1.left}) == 클램프 앵커(${clamped}) — fabPos 공유 계약 유지(미개입)`);
  ok(r1.left >= FAB_MARGIN && vw - (r1.left + r1.pw) >= FAB_MARGIN, `정상 뷰포트: 좌우 여백 모두 ≥ ${FAB_MARGIN}`);
  // 초협폭(pw 상한 미적용 가정 위해 축소 뷰포트) — 여백 <12 이면 중앙 수납.
  const narrow = 150; // pw = round(0.85*150)=128 → maxX=150-128-12=10 <12 → 가드 발동
  const r2 = openLeft({ x: 999, y: 300 }, narrow);
  const center = Math.max(FAB_MARGIN, Math.round((narrow - r2.pw) / 2));
  ok(r2.left === center, `초협폭(${narrow}): 여백<12 감지 → 중앙 수납 left(${r2.left}) == ${center}`);
}

console.log(failures === 0 ? "\nALL PASS — 히트영역·이동정합·열림보정 그린" : `\nFAIL — ${failures} 건`);
process.exit(failures === 0 ? 0 : 1);
