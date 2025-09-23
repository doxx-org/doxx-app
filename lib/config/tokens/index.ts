import { solayer } from "./tokenProfile";
import { solayerUSD } from "./tokenProfile";
import { usdc } from "./tokenProfile";
import { ssol } from "./tokenProfile";
import { TokenProfile } from "./type";

export * from "./tokenProfile";
export * from "./type";

export const tokenProfiles: TokenProfile[] = [solayer, solayerUSD, usdc, ssol];
