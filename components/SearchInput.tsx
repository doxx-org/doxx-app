import { Search } from "lucide-react";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  innerClassName?: string;
}

export const SearchInput = ({
  value,
  onChange,
  placeholder = "Search",
  className,
  innerClassName,
}: SearchInputProps) => {
  return (
    <div className={cn("px-4 pt-4", className)}>
      <div
        className={cn(
          "bg-black-700 flex items-center gap-2 rounded-2xl p-4",
          innerClassName,
        )}
      >
        <Search className="h-4 w-4 text-gray-500" />
        <input
          id="search-token-selector"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            text.sb2(),
            "w-full text-left text-gray-700 outline-none placeholder:text-gray-700",
          )}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
};
