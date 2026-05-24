import { Check, Sparkles, X } from 'lucide-react'
import type { CardConfig } from './types'

interface CardShellProps {
  config: CardConfig
  children: React.ReactNode
  onRemove?: () => void
  onAccept?: () => void
  onDismiss?: () => void
}

export function CardShell({
  config,
  children,
  onRemove,
  onAccept,
  onDismiss,
}: CardShellProps) {
  const wrapperClass = {
    needs_confirmation: 'border-[#F59E0B] bg-[#FFFBEB]',
    ai_suggested: 'border-[#2563EB] bg-[#EFF6FF]',
    completed: 'border-[#10B981] bg-[#F0FDF4]',
  }[config.status]

  return (
    <div className={`rounded-xl border p-4 mb-3 transition-colors ${wrapperClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#0A0A0A]">{config.label}</span>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          {config.status === 'needs_confirmation' && (
            <span className="flex items-center gap-1 text-xs text-[#92400E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
              확인 필요
            </span>
          )}
          {config.status === 'ai_suggested' && (
            <span className="flex items-center gap-1 text-xs text-[#2563EB]">
              <Sparkles size={12} />
              AI 추천
            </span>
          )}
          {config.status === 'completed' && (
            <span className="flex items-center gap-1 text-xs text-[#10B981]">
              <Check size={12} />
              완료
            </span>
          )}
          {/* Remove button */}
          {!config.required && config.status !== 'ai_suggested' && onRemove && (
            <button onClick={onRemove} className="text-[#A3A3A3] hover:text-[#0A0A0A]">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div>{children}</div>

      {/* AI suggested footer */}
      {config.status === 'ai_suggested' && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-[#2563EB]/20">
          <button
            onClick={onAccept}
            className="text-xs px-3 py-1.5 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8]"
          >
            수락
          </button>
          <button
            onClick={onDismiss}
            className="text-xs px-3 py-1.5 text-[#525252] hover:text-[#0A0A0A]"
          >
            건너뛰기
          </button>
        </div>
      )}
    </div>
  )
}
