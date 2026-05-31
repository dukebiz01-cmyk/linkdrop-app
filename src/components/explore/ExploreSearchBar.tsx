import { Search, X } from "lucide-react";

export function ExploreSearchBar({
  value,
  onChange,
  placeholder = "제목/설명에서 검색",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex h-12 items-center gap-3 overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 transition-colors focus-within:border-[#0A0A0A]">
      <Search
        className="h-[18px] w-[18px] shrink-0 text-[#A3A3A3]"
        strokeWidth={2}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#0A0A0A] placeholder:text-[#A3A3A3] focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="shrink-0 text-[#A3A3A3] hover:text-[#525252]"
          aria-label="지우기"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
