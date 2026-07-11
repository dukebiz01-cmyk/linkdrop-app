// lingo-chat/extract.ts — T2.5 세션 종료 시 장기기억 추출 시스템프롬프트.
//   출력 계약: {"facts":[{"kind":"fact|preference","text":"..."}]} 순수 JSON.
//   파싱·검증·적재는 index.ts(handleClose)가 담당 — 이 파일은 상수만.

export const EXTRACT_SYSTEM_PROMPT = `대화에서 이 사용자에 대해 다음에 도움이 될 사실만 추출한다.
- 사실(fact): 사용자가 명시한 것만 (예: 카페를 운영한다, 캠핑장 카드를 만들고 있다)
- 선호(preference): 반복되거나 명시된 방식 취향 (예: 사진을 먼저 고르는 것을 선호)
- 금지: 추측, 민감정보(전화번호·주민번호·계좌·비밀번호·건강·정치·종교), 일회성 잡담
- 출력: {"facts":[{"kind":"fact|preference","text":"..."}]} 순수 JSON만. 없으면 빈 배열. 최대 3개.`;
