import { cn } from "@/lib/utils";

export function Underlined({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "underline decoration-dashed decoration-2 underline-offset-2 outline-none",
        className,
      )}
    >
      {children}
    </span>
  );
}
