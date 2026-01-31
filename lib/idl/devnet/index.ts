import doxxCpmmIdlDevnetJson from "./cpmm_devnet_idl.json";
import doxxCpmmIdlNewDevnetJson from "./cpmm_devnet_idl_new.json";
import doxxClmmIdlDevnetJson from "./clmm_devnet_idl.json";

import type { DoxxCpmmDevnet as DoxxCpmmDevnetType } from "./cpmmDevnetIdl";
import type { DoxxCpmmDevnet as DoxxCpmmDevnetNewType } from "./cpmmDevnetIdl_new";
import type { DoxxClmmDevnet as DoxxClmmDevnetType } from "./clmmDevnetIdl";

export type DoxxCpmmDevnet = DoxxCpmmDevnetType;
// export type DoxxCpmmDevnet = DoxxCpmmDevnetNewType;
export type DoxxClmmDevnet = DoxxClmmDevnetType;

export const doxxCpmmIdlDevnet = doxxCpmmIdlDevnetJson;
// export const doxxCpmmIdlDevnet = doxxCpmmIdlNewDevnetJson;
export const doxxClmmIdlDevnet = doxxClmmIdlDevnetJson;