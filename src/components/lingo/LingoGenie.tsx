// UI-5-T7-L6b — 지니 연출 v2 래퍼 (CSS keyframes 전용 · JS 애니메이션 0 · Duke 확정 스펙).
//   심볼 정본 = brand/lingo-mascot(v0(51) LingoMascot/LingoAvatar). 이 파일은 연출만 소유:
//   ① 소환(마운트 1회 — 연기 3가닥·착지 링·스파클 폭죽 3발 동반, one-shot·fill both)
//   ② 대기(상시 — 부유 ±7px·±1.5deg 3.2s = 랜딩 v6 lingo-hover 리듬 + 중앙 스파클 호흡 2.4s)
//   ③ 대화 중(talking — 발광 펄스 1.3s + 궤도 스파클 2개 2.6s 역위상 + 호흡 1.1s 가속)
//   전 애니메이션 prefers-reduced-motion 정지. 연출 스타일 = 컴포넌트 스코프(전역 오염 0).
//   ⚠️ 중앙 스파클 호흡은 정본 SVG 무수정 원칙 때문에 구조 셀렉터(svg path:nth-of-type(3) =
//   주 스파클)로 잡는다 — lingo-mascot.tsx 패스 순서(몸체·광택·주스파클·보조스파클) 변경 시 동반 수정.
import { LingoAvatar, LingoMascot } from "@/components/brand/lingo-mascot";

// 4갈래 스파클(24×24) — lingo-mascot sparkle() 수식의 직선 근사판(폭죽·궤도 전용 장식).
const SPARK_PATH =
  "M12 0C13.4 8.6 15.4 10.6 24 12C15.4 13.4 13.4 15.4 12 24C10.6 15.4 8.6 13.4 0 12C8.6 10.6 10.6 8.6 12 0Z";

function Spark({ size, color }: { size: number; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={SPARK_PATH} fill={color} />
    </svg>
  );
}

export function LingoGenie({
  size,
  variant = "symbol",
  tone = "blue",
  talking = false,
  className,
}: {
  size: number;
  /** symbol = LingoMascot 심볼(흰/밝은 배경) · avatar = LingoAvatar(파란 그라데이션 원 — FAB). */
  variant?: "symbol" | "avatar";
  tone?: "blue" | "white" | "ink";
  /** ③ 대화 중 — 호출부가 상태(응답 사이클)로 배선. */
  talking?: boolean;
  className?: string;
}) {
  const orbitD = Math.round(size * 1.64); // 궤도 지름 — 반지름 ≈ size×0.82 (56px → ~46px 스펙).
  return (
    <span
      className={`lingo-genie relative inline-flex items-center justify-center ${className ?? ""}`}
      style={{ width: size, height: size }}
      data-talking={talking || undefined}
      aria-hidden="true"
    >
      <style>{`
        @keyframes lg-summon{0%{transform:translateY(34px) scaleY(.08) scaleX(.4);opacity:0}38%{transform:translateY(4px) scaleY(1.22) scaleX(.85);opacity:1}58%{transform:translateY(-7px) scaleY(.92) scaleX(1.1)}76%{transform:translateY(2px) scaleY(1.05)}100%{transform:translateY(0)}}
        .lg-summon{transform-origin:50% 92%;animation:lg-summon 1.15s cubic-bezier(0.3,1.55,0.45,1) both;display:inline-flex}
        @keyframes lg-idle{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-7px) rotate(1.5deg)}}
        .lg-idle{animation:lg-idle 3.2s ease-in-out 1.15s infinite;display:inline-flex}
        @keyframes lg-breathe{0%,100%{transform:scale(.75)}50%{transform:scale(1.28)}}
        .lingo-genie .lg-idle svg path:nth-of-type(3){transform-box:fill-box;transform-origin:center;animation:lg-breathe 2.4s ease-in-out infinite}
        .lingo-genie[data-talking] .lg-idle svg path:nth-of-type(3){animation-duration:1.1s}
        @keyframes lg-smoke-l{0%{transform:translate(0,6px) scale(.5);opacity:.55}100%{transform:translate(-14px,-26px) scale(1.15);opacity:0}}
        @keyframes lg-smoke-r{0%{transform:translate(0,6px) scale(.5);opacity:.55}100%{transform:translate(14px,-24px) scale(1.1);opacity:0}}
        @keyframes lg-smoke-c{0%{transform:translate(0,8px) scale(.55);opacity:.6}100%{transform:translate(0,-32px) scale(1.2);opacity:0}}
        .lg-smoke{position:absolute;bottom:4%;left:50%;width:10px;height:14px;margin-left:-5px;border-radius:9999px;background:#DBEAFE;opacity:0;pointer-events:none;animation-duration:1.1s;animation-timing-function:ease-out;animation-fill-mode:both}
        .lg-smoke-l{animation-name:lg-smoke-l}
        .lg-smoke-r{animation-name:lg-smoke-r;animation-delay:.08s;background:#CFE0FB}
        .lg-smoke-c{animation-name:lg-smoke-c;animation-delay:.16s}
        @keyframes lg-ring{0%{transform:scale(.3);opacity:.9}100%{transform:scale(1.9);opacity:0}}
        .lg-ring{position:absolute;inset:0;border-radius:9999px;border:2px solid #93C5FD;opacity:0;pointer-events:none;animation:lg-ring .9s ease-out .55s both}
        @keyframes lg-pop-1{0%{transform:translate(0,0) scale(0) rotate(0deg);opacity:1}55%{transform:translate(-16px,-18px) scale(1.5) rotate(120deg);opacity:1}100%{transform:translate(-24px,-26px) scale(.4) rotate(200deg);opacity:0}}
        @keyframes lg-pop-2{0%{transform:translate(0,0) scale(0) rotate(0deg);opacity:1}55%{transform:translate(17px,-15px) scale(1.5) rotate(-110deg);opacity:1}100%{transform:translate(26px,-22px) scale(.4) rotate(-190deg);opacity:0}}
        @keyframes lg-pop-3{0%{transform:translate(0,0) scale(0) rotate(0deg);opacity:1}55%{transform:translate(4px,-24px) scale(1.4) rotate(90deg);opacity:1}100%{transform:translate(7px,-34px) scale(.4) rotate(160deg);opacity:0}}
        .lg-pop{position:absolute;left:50%;top:38%;width:10px;height:10px;margin-left:-5px;opacity:0;pointer-events:none;animation-duration:.85s;animation-timing-function:ease-out;animation-fill-mode:both}
        .lg-pop-1{animation-name:lg-pop-1;animation-delay:.5s}
        .lg-pop-2{animation-name:lg-pop-2;animation-delay:.62s}
        .lg-pop-3{animation-name:lg-pop-3;animation-delay:.74s}
        @keyframes lg-glow{0%,100%{transform:scale(.95);opacity:.3}50%{transform:scale(1.35);opacity:1}}
        .lg-talk-glow{position:absolute;inset:-18%;border-radius:9999px;background:radial-gradient(circle,rgba(96,165,250,.5) 0%,rgba(96,165,250,0) 70%);pointer-events:none;animation:lg-glow 1.3s ease-in-out infinite}
        @keyframes lg-orbit{to{transform:rotate(360deg)}}
        .lg-orbit{position:absolute;left:50%;top:50%;margin:0;transform:translate(-50%,-50%);pointer-events:none;animation:lg-orbit 2.6s linear infinite}
        .lg-orbit .lg-osp{position:absolute;left:50%;width:10px;height:10px;margin-left:-5px}
        @media (prefers-reduced-motion: reduce){
          .lingo-genie .lg-summon,.lingo-genie .lg-idle,.lingo-genie .lg-smoke,.lingo-genie .lg-ring,
          .lingo-genie .lg-pop,.lingo-genie .lg-talk-glow,.lingo-genie .lg-orbit,
          .lingo-genie .lg-idle svg path:nth-of-type(3){animation:none !important}
        }
      `}</style>

      {/* ① 소환 동반 — 연기 버스트 3가닥 · 착지 링 웨이브 · 스파클 폭죽 3발 (전부 one-shot, 종료 후 opacity 0) */}
      <span className="lg-smoke lg-smoke-l" />
      <span className="lg-smoke lg-smoke-r" />
      <span className="lg-smoke lg-smoke-c" />
      <span className="lg-ring" />
      <span className="lg-pop lg-pop-1"><Spark size={10} color="#93C5FD" /></span>
      <span className="lg-pop lg-pop-2"><Spark size={9} color="#BFDBFE" /></span>
      <span className="lg-pop lg-pop-3"><Spark size={8} color="#3B82F6" /></span>

      {/* ③ 대화 중 — 발광 펄스 + 궤도 스파클 2개(역위상 = 궤도 양끝) */}
      {talking && (
        <>
          <span className="lg-talk-glow" />
          <span className="lg-orbit" style={{ width: orbitD, height: orbitD }}>
            <span className="lg-osp" style={{ top: -5 }}>
              <Spark size={10} color="#60A5FA" />
            </span>
            <span className="lg-osp" style={{ bottom: -5 }}>
              <Spark size={8} color="#BFDBFE" />
            </span>
          </span>
        </>
      )}

      {/* 본체 — ① 소환 → ② 대기 부유(1.15s 지연 후 무한) · 중앙 스파클 호흡은 셀렉터가 담당 */}
      <span className="lg-summon">
        <span className="lg-idle">
          {variant === "avatar" ? (
            <LingoAvatar size={size} background="solid" />
          ) : (
            <LingoMascot size={size} tone={tone} />
          )}
        </span>
      </span>
    </span>
  );
}
