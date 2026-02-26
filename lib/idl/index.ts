import {
  DOXX_CLMM_PROGRAM_ID_DEVNET,
  DoxxCpmmDevnet,
  doxxClmmIdlDevnet,
  doxxCpmmIdlDevnet,
} from "./devnet";
// import { doxxCpmmIdlMainnet } from "./mainnet";
import {
  DOXX_CLMM_PROGRAM_ID_MAINNET,
  DoxxClmmMainnet,
  doxxClmmIdlMainnet,
} from "./mainnet";

const isDevnet = process.env.NEXT_PUBLIC_ENV === "devnet";

// === CPMM ===
// IDL
export const doxxCpmmIdl = isDevnet
  ? doxxCpmmIdlDevnet
  : // TODO: change to doxxCpmmIdlMainnet
    doxxCpmmIdlDevnet;
// TYPE
export type DoxxCpmmIdl = DoxxCpmmDevnet;

// === CLMM ===
export const doxxClmmIdl = isDevnet ? doxxClmmIdlDevnet : doxxClmmIdlMainnet;
// TODO: CHANGE TO DoxxClmmMainnet
export type DoxxClmmIdl = DoxxClmmMainnet;

export const DOXX_CLMM_PROGRAM_ID = isDevnet
  ? DOXX_CLMM_PROGRAM_ID_DEVNET
  : DOXX_CLMM_PROGRAM_ID_MAINNET;
