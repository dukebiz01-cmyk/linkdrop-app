export type CardStatus =
  | 'completed'
  | 'needs_confirmation'
  | 'ai_suggested'

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
}
