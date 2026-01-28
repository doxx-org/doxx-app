import { BN } from "@coral-xyz/anchor";
import Minus from "@/assets/icons/minus.svg";
import Plus from "@/assets/icons/plus.svg";
import { Input } from "@/components/ui/input";
import { text } from "@/lib/text";
import { cn, parseDecimalsInput } from "@/lib/utils";
import { parseAmountBN } from "@/lib/utils/number";

interface PriceRangeInputProps {
  label: string;
  value: string;
  handlePriceInputChange: (value: string) => void;
}

function formatFixedAmountBN(amount: BN, decimals: number): string {
  if (decimals <= 0) return amount.toString(10);

  const base = new BN(10).pow(new BN(decimals));
  const isNeg = amount.isNeg();
  const abs = amount.abs();

  const integer = abs.div(base).toString(10);
  const fraction = abs.mod(base).toString(10).padStart(decimals, "0");

  const result = `${integer}.${fraction}`;
  return isNeg ? `-${result}` : result;
}

function stepDecimalString(raw: string, direction: -1 | 1): string {
  const trimmed = raw.trim();
  const isNeg = trimmed.startsWith("-");
  const unsignedRaw = isNeg ? trimmed.slice(1) : trimmed;

  // Reuse your input sanitizer, but add support for a leading '-'.
  const sanitizedUnsigned = parseDecimalsInput(unsignedRaw);
  const normalizedUnsigned =
    sanitizedUnsigned === "" || sanitizedUnsigned === "."
      ? "0"
      : sanitizedUnsigned;

  const decimals = normalizedUnsigned.includes(".")
    ? (normalizedUnsigned.split(".")[1]?.length ?? 0)
    : 0;

  const unsignedBN = parseAmountBN(normalizedUnsigned, decimals);
  const current = isNeg ? unsignedBN.neg() : unsignedBN;

  const next = current.add(new BN(direction));
  return formatFixedAmountBN(next, decimals);
}

const PriceRangeInput = ({
  label,
  value,
  handlePriceInputChange,
}: PriceRangeInputProps) => {
  return (
    <div className="flex w-1/2 flex-col gap-2">
      <span className={cn(text.sb3(), "text-white/40 select-none")}>
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900 p-2">
        <div
          className="flex size-6.5 shrink-0 touch-manipulation items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-center select-none hover:cursor-pointer hover:bg-gray-700"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handlePriceInputChange(stepDecimalString(value, -1))}
        >
          <Minus />
        </div>
        <Input
          value={value}
          onChange={(e) => handlePriceInputChange(e.target.value)}
          placeholder="0.00"
          className={cn(
            "h-3.5 min-w-0 flex-1 border-0 !bg-transparent p-0 text-center text-gray-400 ring-0 outline-none focus-visible:ring-0",
            text.sh1(),
          )}
        />
        <div
          className="flex size-6.5 shrink-0 touch-manipulation items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-center select-none hover:cursor-pointer hover:bg-gray-700"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handlePriceInputChange(stepDecimalString(value, 1))}
        >
          <Plus />
        </div>
      </div>
    </div>
  );
};

interface CLMMPriceRangeProps {
  minPrice: string;
  maxPrice: string;
  handleMinPriceChange: (value: string) => void;
  handleMaxPriceChange: (value: string) => void;
}

export const CLMMPriceRange = ({
  minPrice,
  maxPrice,
  handleMinPriceChange,
  handleMaxPriceChange,
}: CLMMPriceRangeProps) => {
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <PriceRangeInput
        label="Min Price"
        value={minPrice}
        handlePriceInputChange={handleMinPriceChange}
      />
      <PriceRangeInput
        label="Max Price"
        value={maxPrice}
        handlePriceInputChange={handleMaxPriceChange}
      />
    </div>
  );
};
