// lingo-text — 링고 발화 텍스트 정제 공용 (LINGO-FIX-4b — LingoHomeBox 로컬 구현 승격).
//
// stripMarkdown — 마크다운 기호 정제(표시·낭독 시점만 — 원본 메시지 데이터 무변경 원칙).
//   별표 강조·백틱·헤더·목록 기호(행머리)·링크 문법 → 순수 문장. persona 순수문장 규칙
//   (BLOCK_G)과 이중 봉합 — 모델이 어겨도 표면에서 걸러진다. 소비처: 홈 LingoHomeBox ·
//   스튜디오 CardStudioPage45 (표시 + voice.speak 직전).
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, "") // 코드펜스
    .replace(/`([^`]*)`/g, "$1") // 인라인 백틱
    .replace(/\*\*([^*]+)\*\*/g, "$1") // 굵게
    .replace(/\*([^*\n]+)\*/g, "$1") // 기울임
    .replace(/^#{1,6}\s+/gm, "") // 헤더
    .replace(/^\s*(?:[-*•]|\d+\.)\s+/gm, "") // 목록 기호(행머리)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // 링크 [텍스트](url)
    .replace(/\*/g, "") // 잔여 별표
    .trim();
}
