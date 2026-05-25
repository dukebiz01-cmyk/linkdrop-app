import { X } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { CardConfig } from './types'

interface CardShellProps {
  config: CardConfig
  children: React.ReactNode
  selected?: boolean
  onRemove?: () => void
  onAccept?: () => void
  onDismiss?: () => void
}

export function CardShell({
  config,
  children,
  selected,
  onRemove,
  onAccept,
  onDismiss,
}: CardShellProps) {
  const baseClass = 'rounded-2xl border bg-white p-4 mb-3 shadow-sm transition'
  const borderClass = selected
    ? 'border-blue-500 ring-1 ring-blue-100'
    : 'border-slate-200'
  const opacityClass = config.status === 'hidden' ? 'opacity-70' : ''

  return (
    <div className={`${baseClass} ${borderClass} ${opacityClass}`.trim()}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold tracking-ko text-text-strong">
          {config.label}
        </h3>
        <div className="flex items-center gap-2">
          <StatusBadge status={config.status} />
          {!config.required && config.status !== 'ai_suggested' && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="카드 제거"
              className="text-text-muted hover:text-text-strong"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div>{children}</div>

      {config.status === 'ai_suggested' && (onAccept || onDismiss) && (
        <div className="mt-3 flex gap-2">
          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
            >
              그대로 사용
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-text-muted"
            >
              건너뛰기
            </button>
          )}
        </div>
      )}
    </div>
  )
}
