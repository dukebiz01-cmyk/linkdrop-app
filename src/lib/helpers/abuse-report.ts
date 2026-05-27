/**
 * 신고 시스템 헬퍼
 *
 * WHY: 수신자 카드 하단 "문제 신고" 버튼 → 시트 노출 → DB 저장
 * 메모리 #21 UI Copy Standard: 한글만, 약어 X
 */

export type AbuseReportReason =
  | 'fake_store'
  | 'inappropriate'
  | 'spam'
  | 'fraud'
  | 'copyright'
  | 'other';

export interface AbuseReasonOption {
  value: AbuseReportReason;
  label: string;
  description: string;
}

export const ABUSE_REASONS: AbuseReasonOption[] = [
  {
    value: 'fake_store',
    label: '가짜 매장 사칭',
    description: '실제 매장이 아니거나 정보가 거짓이에요',
  },
  {
    value: 'inappropriate',
    label: '부적절한 내용',
    description: '폭력·성적·혐오 표현이 있어요',
  },
  {
    value: 'spam',
    label: '스팸 또는 도배',
    description: '반복적인 광고나 의미 없는 내용이에요',
  },
  {
    value: 'fraud',
    label: '사기 또는 허위',
    description: '실제와 다른 혜택이나 거짓 정보예요',
  },
  {
    value: 'copyright',
    label: '저작권 침해',
    description: '허락 없이 사용한 영상이나 사진이에요',
  },
  {
    value: 'other',
    label: '기타',
    description: '위에 없는 다른 문제예요',
  },
];

export function getReasonLabel(reason: AbuseReportReason): string {
  return ABUSE_REASONS.find((r) => r.value === reason)?.label ?? '기타';
}
