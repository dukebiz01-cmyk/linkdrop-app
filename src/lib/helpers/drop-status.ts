export type OfficialStatus = 'official' | 'user_shared' | 'pending' | 'rejected';

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

export function getBadgeColor(
  status: OfficialStatus,
): { bg: string; text: string; border?: string } {
  switch (status) {
    case 'official':
      return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
    case 'user_shared':
      return { bg: '#F5F5F5', text: '#525252' };
    case 'pending':
      return { bg: '#FEF3C7', text: '#92400E' };
    case 'rejected':
      return { bg: '#FEE2E2', text: '#991B1B' };
  }
}
