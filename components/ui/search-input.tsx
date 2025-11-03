import { Input } from "./input";
import Magnify from "@/assets/icons/magnify.svg";
import { cn } from "@/lib/utils/style";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
        <Magnify className="h-5 w-5 text-gray-500" />
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-md border-gray-800 bg-black-700 pl-12 text-gray-400"
      />
    </div>
  );
}
