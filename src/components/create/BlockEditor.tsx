import { GripVertical, Lock, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  KIND_LABEL,
  type BlockDraft,
  type BlockKind,
} from "@/lib/create-flow/types";
import type { OEmbedResult } from "@/lib/oembed";

interface Props {
  block: BlockDraft;
  oembed: OEmbedResult | null;
  onChange: (data: Record<string, unknown>) => void;
  onDelete: () => void;
}

export function SortableBlock({ block, oembed, onChange, onDelete }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, disabled: block.isLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border bg-bg",
        isDragging && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          aria-label="블록 이동"
          {...attributes}
          {...listeners}
          disabled={block.isLocked}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-subtle",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            block.isLocked
              ? "cursor-not-allowed opacity-40"
              : "hover:text-text-strong cursor-grab active:cursor-grabbing",
          )}
        >
          <GripVertical className="size-4" strokeWidth={2} />
        </button>
        <p className="flex-1 text-xs font-semibold tracking-tight text-text-muted">
          {KIND_LABEL[block.kind]}
        </p>
        {block.isLocked ? (
          <span className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-text-muted">
            <Lock className="size-3" strokeWidth={2} />
            잠김
          </span>
        ) : (
          <button
            type="button"
            onClick={onDelete}
            aria-label="블록 삭제"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-subtle transition-colors hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <Trash2 className="size-4" strokeWidth={2} />
          </button>
        )}
      </div>
      <div className="p-4">
        <BlockBody block={block} oembed={oembed} onChange={onChange} />
      </div>
    </div>
  );
}

function BlockBody({
  block,
  oembed,
  onChange,
}: {
  block: BlockDraft;
  oembed: OEmbedResult | null;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...block.data, ...patch });

  switch (block.kind as BlockKind) {
    case "video":
      return <VideoView oembed={oembed} />;
    case "text":
      return (
        <Textarea
          value={(block.data.body as string) ?? ""}
          onChange={(v) => set({ body: v })}
          placeholder="이 영상에 대한 한 줄 메모"
        />
      );
    case "coupon":
      return (
        <div className="space-y-3">
          <TextInput
            label="쿠폰 이름"
            value={(block.data.title as string) ?? ""}
            onChange={(v) => set({ title: v })}
            placeholder="아메리카노 1잔 무료"
          />
          <TextInput
            label="할인 표시"
            value={(block.data.discount as string) ?? ""}
            onChange={(v) => set({ discount: v })}
            placeholder="-30% 또는 1+1"
          />
        </div>
      );
    case "map":
      return (
        <div className="space-y-3">
          <TextInput
            label="장소 이름"
            value={(block.data.name as string) ?? ""}
            onChange={(v) => set({ name: v })}
            placeholder="성수 카페"
          />
          <TextInput
            label="주소"
            value={(block.data.address as string) ?? ""}
            onChange={(v) => set({ address: v })}
            placeholder="서울 성동구 ..."
          />
        </div>
      );
    case "link":
      return (
        <div className="space-y-3">
          <TextInput
            label="링크 텍스트"
            value={(block.data.label as string) ?? ""}
            onChange={(v) => set({ label: v })}
            placeholder="구매하러 가기"
          />
          <TextInput
            label="URL"
            value={(block.data.url as string) ?? ""}
            onChange={(v) => set({ url: v })}
            placeholder="https://..."
          />
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <TextInput
            label="이미지 URL"
            value={(block.data.url as string) ?? ""}
            onChange={(v) => set({ url: v })}
            placeholder="https://..."
          />
          <TextInput
            label="설명 (선택)"
            value={(block.data.caption as string) ?? ""}
            onChange={(v) => set({ caption: v })}
            placeholder=""
          />
        </div>
      );
    case "cta":
      return (
        <div className="space-y-3">
          <TextInput
            label="버튼 라벨"
            value={(block.data.label as string) ?? ""}
            onChange={(v) => set({ label: v })}
            placeholder="예약하기"
          />
          <TextInput
            label="이동 URL"
            value={(block.data.url as string) ?? ""}
            onChange={(v) => set({ url: v })}
            placeholder="https://..."
          />
        </div>
      );
    case "poll": {
      const options = (block.data.options as string[]) ?? ["", ""];
      return (
        <div className="space-y-3">
          <TextInput
            label="질문"
            value={(block.data.question as string) ?? ""}
            onChange={(v) => set({ question: v })}
            placeholder="너희 둘이라면 어디 갈래?"
          />
          {options.map((opt, i) => (
            <TextInput
              key={i}
              label={`보기 ${i + 1}`}
              value={opt}
              onChange={(v) => {
                const next = [...options];
                next[i] = v;
                set({ options: next });
              }}
              placeholder=""
            />
          ))}
          {options.length < 4 && (
            <button
              type="button"
              onClick={() => set({ options: [...options, ""] })}
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-text-muted transition-colors hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              보기 추가
            </button>
          )}
        </div>
      );
    }
    case "similar":
      return (
        <p className="text-xs font-medium text-text-muted">
          비슷한 카드 추천은 다음 단계에서 자동으로 채워집니다.
        </p>
      );
    default:
      return null;
  }
}

function VideoView({ oembed }: { oembed: OEmbedResult | null }) {
  if (!oembed) {
    return (
      <p className="text-xs font-medium text-text-muted">영상 정보 없음</p>
    );
  }
  return (
    <div className="space-y-3">
      {oembed.thumbnailUrl && (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-surface">
          <img
            src={oembed.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <p className="text-sm font-bold tracking-tight text-text-strong">
        {oembed.title}
      </p>
      <p className="text-xs font-medium text-text-muted">
        {oembed.authorName ? `${oembed.authorName} · ` : ""}
        {oembed.provider === "youtube" ? "YouTube" : oembed.provider}
      </p>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-text-strong">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 block h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm font-medium text-text-strong placeholder:text-text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      />
    </label>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="block w-full resize-none rounded-lg border border-border bg-bg px-3 py-3 text-sm font-medium text-text-strong placeholder:text-text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    />
  );
}