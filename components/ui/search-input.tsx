import Magnify from "@/assets/icons/magnify.svg";
import { cn } from "@/lib/utils/style";
import { Input } from "./input";

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
      <div className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2">
        <Magnify className="h-5 w-5 text-gray-500" />
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-black-700 h-12 w-full rounded-md border-gray-800 pl-12 text-gray-400"
      />
    </div>
  );
}
