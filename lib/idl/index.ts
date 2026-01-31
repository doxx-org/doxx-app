import { doxxCpmmIdlDevnet, doxxClmmIdlDevnet, DoxxCpmmDevnet, DoxxClmmDevnet } from "./devnet";
// import { doxxCpmmIdlMainnet } from "./mainnet";
import { doxxClmmIdlMainnet, DoxxClmmMainnet } from "./mainnet";

const isDevnet = process.env.NEXT_PUBLIC_ENV === "devnet";

// === CPMM ===
// IDL
export const doxxCpmmIdl =
  isDevnet ?
    doxxCpmmIdlDevnet :
    // TODO: change to doxxCpmmIdlMainnet
    doxxCpmmIdlDevnet;
// TYPE
export type DoxxCpmmIdl = DoxxCpmmDevnet;

// === CLMM ===
export const doxxClmmIdl = isDevnet ? doxxClmmIdlDevnet : doxxClmmIdlMainnet;
// TODO: CHANGE TO DoxxClmmMainnet
export type DoxxClmmIdl = DoxxClmmMainnet;