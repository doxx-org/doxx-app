import { PoolType } from "@/components/earn/v2/types";

interface FeeTier {
  index: number;
  fee: number;
  label: string;
  description: string;
  default?: boolean;
  enabled?: boolean;
}

// Fee tier configuration matching the AMM program's config indexes
const CLMM_FEE_TIERS: FeeTier[] = [
  // {
  //   index: 0,
  //   fee: 0.25,
  //   label: (
  // <div className="flex flex-row items-center gap-1">
  //   <span>0.25% fee</span>
  //   <span className={cn(text.sb3(), "text-green")}>(default)</span>
  // </div>
  //   ),
  //   description: "For testing purposes",
  // },
  {
    index: 1,
    fee: 0.3,
    label: "0.3% fee",
    description: "Best for very stable pairs",
    enabled: true,
    default: true,
  },
  // {
  //   index: 2,
  //   fee: 0.35,
  //   label: "0.35% fee",
  //   description: "Best for stable pairs",
  //   enabled: false,
  // },
  // { index: 3, fee: 0.3, label: "0.3% fee", description: "Best for most pairs" },
  // {
  //   index: 4,
  //   fee: 1.0,
  //   label: "1.0% fee",
  //   description: "Best for exotic pairs",
  // },
];

const CPMM_FEE_TIERS: FeeTier[] = [
  {
    index: 0,
    fee: 0.25,
    label: "0.25% fee",
    // label: (
    // <div className="flex flex-row items-center gap-1">
    //   <span>0.25% fee</span>
    //   <span className={cn(text.sb3(), "text-green")}>(default)</span>
    // </div>
    // ),
    description: "Best for most trading pairs",
    enabled: true,
  },
  {
    index: 1,
    fee: 1,
    label: "1% fee",
    description: "Best for very stable pairs",
    enabled: true,
    default: true,
  },
  // {
  //   index: 2,
  //   fee: 0.35,
  //   label: "0.35% fee",
  //   description: "Best for stable pairs",
  //   enabled: false,
  // },
  // { index: 3, fee: 0.3, label: "0.3% fee", description: "Best for most pairs" },
  // {
  //   index: 4,
  //   fee: 1.0,
  //   label: "1.0% fee",
  //   description: "Best for exotic pairs",
  // },
];

export const getFeeTiers = (feeType: PoolType) => {
  if (feeType === PoolType.CLMM) {
    return CLMM_FEE_TIERS;
  }

  return CPMM_FEE_TIERS;
};

export const getDefaultFeeIndex = (poolType: PoolType) => {
  if (poolType === PoolType.CLMM) {
    return CLMM_FEE_TIERS.find((tier) => tier.default)?.index;
  }

  return CPMM_FEE_TIERS.find((tier) => tier.default)?.index;
};
