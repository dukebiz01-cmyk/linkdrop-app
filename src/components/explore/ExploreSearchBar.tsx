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
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#A3A3A3] transition-colors hover:bg-[#525252]"
          aria-label="검색어 지우기"
        >
          <X className="h-[13px] w-[13px] text-white" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
