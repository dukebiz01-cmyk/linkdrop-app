/**
 * CardActionButton — 카드 안 '예쁜 버튼'(닫힌 블럭) 1개의 표시 컴포넌트.
 *
 * CouponPreview 와 동일한 presentational 패턴. studio-build 의 카드 칩
 * (bg-white/12 + 아이콘 + 라벨)을 추출. 스튜디오·손님 둘 다 재사용.
 *
 * ★ 표시/동작 분리: onClick 없으면 시각 전용(<span>, 미리보기처럼 비기능),
 *    있으면 클릭 가능(<button>). 동작(탭→인라인 펼침 등) 결정은 부모 몫.
 *
 * flex-1 은 칩이 가로 flex 행(전화/길찾기/예약 3개 나열)에서 균등 분할되도록
 * 기존 비주얼 그대로 유지 — 호출부가 flex 컨테이너로 감싼다.
 */
export function CardActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  const className =
    "flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/12 py-2 text-center text-[12px] font-semibold backdrop-blur";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {icon}
        {label}
      </button>
    );
  }
  return (
    <span className={className}>
      {icon}
      {label}
    </span>
  );
}
