import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";
import { Button } from "../ui/button";

export function SwapButton() {
  return (
    <Button
      className={cn(text.hsb1(), "text-green h-16 w-full rounded-xl p-6")}
    >
      Swap
    </Button>
  );
}
