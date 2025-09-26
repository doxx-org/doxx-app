import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-skeleton-loading h-4 w-16 rounded-full", className)}
      {...props}
    />
  );
}

export { Skeleton };
