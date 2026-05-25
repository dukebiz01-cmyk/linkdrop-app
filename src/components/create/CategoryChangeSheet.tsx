import { Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface CategoryChangeOption {
  id: string;
  label: string;
  description?: string;
}

export interface CategoryChangeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryChangeOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  title?: string;
}

export function CategoryChangeSheet({
  open,
  onOpenChange,
  categories,
  selectedId,
  onSelect,
  title = "유형을 바꿀까요?",
}: CategoryChangeSheetProps) {
  const handleSelect = (id: string) => {
    onSelect(id);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl border-t-0 px-6 pb-8 pt-6">
        <SheetHeader className="text-left">
          <SheetTitle className="text-lg font-bold tracking-ko text-text-strong">
            {title}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {categories.map((cat) => {
            const isSelected = selectedId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelect(cat.id)}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? "border-[#2563EB] bg-[#EFF6FF] ring-1 ring-[#2563EB]/25"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium tracking-ko ${
                      isSelected ? "text-[#2563EB]" : "text-text-strong"
                    }`}
                  >
                    {cat.label}
                  </p>
                  {cat.description && (
                    <p className="mt-1 text-xs tracking-ko text-text-muted">{cat.description}</p>
                  )}
                </div>
                {isSelected && <Check className="size-5 text-[#2563EB]" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
