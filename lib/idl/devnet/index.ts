// import type { DoxxCpmmDevnet as DoxxCpmmDevnetNewType } from "./cpmmDevnetIdl_new";
import { PublicKey } from "@solana/web3.js";
import type { DoxxClmmDevnet as DoxxClmmDevnetType } from "./clmmDevnetIdl";
// import doxxCpmmIdlNewDevnetJson from "./cpmm_devnet_idl_new.json";
import doxxClmmIdlDevnetJson from "./clmm_devnet_idl.json";
import type { DoxxCpmmDevnet as DoxxCpmmDevnetType } from "./cpmmDevnetIdl";
import doxxCpmmIdlDevnetJson from "./cpmm_devnet_idl.json";

export type DoxxCpmmDevnet = DoxxCpmmDevnetType;
// export type DoxxCpmmDevnet = DoxxCpmmDevnetNewType;
export type DoxxClmmDevnet = DoxxClmmDevnetType;

export const doxxCpmmIdlDevnet = doxxCpmmIdlDevnetJson;
// export const doxxCpmmIdlDevnet = doxxCpmmIdlNewDevnetJson;
export const doxxClmmIdlDevnet = doxxClmmIdlDevnetJson;

export const DOXX_CLMM_PROGRAM_ID_DEVNET = new PublicKey(
  "8pQAnGbHE3y7WoBYPY8tCoNoosTNV1LPUr5YtwSMDiXg",
);
