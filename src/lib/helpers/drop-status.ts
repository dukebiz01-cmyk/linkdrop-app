/**
 * Drop 인증 상태 헬퍼
 *
 * WHY: 수신자 카드에 "공식 매장" / "사용자 공유" 배지를 일관되게 표시
 * - 메모리 #21 UI Copy Standard 준수 (한글만, 영어 X)
 * - 메모리 #20 디자인 시스템 준수 (#0A0A0A 계열)
 */

export type OfficialStatus =
  | 'official'
  | 'user_shared'
  | 'pending'
  | 'rejected';

export function isOfficial(status: OfficialStatus): boolean {
  return status === 'official';
}

export function getBadgeLabel(status: OfficialStatus): string {
  switch (status) {
    case 'official':
      return '공식 매장';
    case 'user_shared':
      return '사용자 공유';
    case 'pending':
      return '인증 대기';
    case 'rejected':
      return '반려';
  }
}

export interface BadgeColor {
  bg: string;
  text: string;
  border?: string;
}

export function getBadgeColor(status: OfficialStatus): BadgeColor {
  switch (status) {
    case 'official':
      return { bg: '#FAFAFA', text: '#171717', border: '#BFDBFE' };
    case 'user_shared':
      return { bg: '#F5F5F5', text: '#525252' };
    case 'pending':
      return { bg: '#FEF3C7', text: '#92400E' };
    case 'rejected':
      return { bg: '#FEE2E2', text: '#991B1B' };
  }
}
