"use client";

import { text } from "@/lib/text";
import { cn } from "@/lib/utils/style";

interface PositionSummaryCardsProps {
  positionCount: number;
  totalBalance: number;
  totalPendingYield: number;
  onClaimYield: () => void;
  isClaimingYield: boolean;
  hasClmmPositions: boolean;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black-800 flex min-w-[240px] flex-col gap-2 rounded-xl border border-gray-800 p-4">
      <p className={cn(text.sb3(), "text-gray-500")}>{label}</p>
      <p className={cn(text.h3(), "text-gray-200")}>{value}</p>
    </div>
  );
}

export function PositionSummaryCards({
  positionCount,
  totalBalance,
  totalPendingYield,
  onClaimYield,
  isClaimingYield,
  hasClmmPositions,
}: PositionSummaryCardsProps) {
  const canClaim =
    totalPendingYield > 0 && hasClmmPositions && !isClaimingYield;

  return (
    <div className="flex flex-row items-center gap-4">
      <div className="grid flex-1 grid-cols-3 gap-4">
        <StatCard label="Positions" value={positionCount.toString()} />
        <StatCard
          label="Total Balance"
          value={`$${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <StatCard
          label="Pending Yield"
          value={`$${totalPendingYield.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
      </div>
      <button
        className={cn(
          text.b3(),
          "rounded-2xl py-5 px-10 transition-colors",
          canClaim
            ? "bg-green text-black-900 hover:bg-green/80 cursor-pointer"
            : "cursor-not-allowed bg-gray-800 text-gray-600",
        )}
        onClick={onClaimYield}
        disabled={!canClaim}
      >
        {isClaimingYield ? "Claiming..." : "Claim Yield"}
      </button>
    </div>
  );
}
