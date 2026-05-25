export type CardStatus =
  | 'ai_suggested'        // AI가 채움, 확인 전
  | 'completed'           // 사용 가능 상태 (accepted | user_edited 통합)
  | 'needs_confirmation'  // 연결/확인 필요
  | 'hidden';             // 수신자에게 숨김

export type CardUserAction =
  | null
  | 'accepted'    // AI 제안 그대로 수락
  | 'edited'      // 사용자가 수정
  | 'removed';    // 카드 빼기 (한마디 빼기 등)

export type CardType =
  | 'purpose'
  | 'calendar'
  | 'people_count'
  | 'action_button'
  | 'price'
  | 'message'
  | 'photos'
  | 'map'
  | 'hours'
  | 'coupon_info'
  | 'urgency'

export type BusinessType =
  | 'camping' | 'lodging' | 'hair_salon' | 'nail'
  | 'restaurant' | 'clinic' | 'spa' | 'studio'
  | 'class' | 'rental' | 'other'

export interface CardConfig {
  id: string
  type: CardType
  required: boolean
  enabled: boolean
  position: number
  status: CardStatus
  data: Record<string, unknown>
  ai_suggested?: boolean
  label: string
  userAction?: CardUserAction      // analytics — accepted/edited/removed
  receiverVisible?: boolean         // default true (false = exclude from receiver page)
}
