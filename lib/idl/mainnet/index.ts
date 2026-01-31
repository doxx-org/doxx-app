// TODO: change to DoxxCpmmMainnetJson
import doxxCpmmIdlMainnetJson from "../devnet/cpmm_devnet_idl.json";
import doxxCpmmIdlNewMainnetJson from "../devnet/cpmm_devnet_idl_new.json";
import doxxClmmIdlMainnetJson from "../mainnet/clmm_mainnet_idl.json";

// TODO: change to DoxxCpmmMainnetType
import type { DoxxCpmmDevnet as DoxxCpmmMainnetType } from "../devnet/cpmmDevnetIdl";
// TODO: change to DoxxCpmmMainnetNewType
import type { DoxxCpmmDevnet as DoxxCpmmMainnetNewType } from "../devnet/cpmmDevnetIdl_new";
import type { DoxxClmmMainnet as DoxxClmmMainnetType } from "../mainnet/clmmMainnetIdl";

export type DoxxCpmmMainnet = DoxxCpmmMainnetType;
// export type DoxxCpmmMainnet = DoxxCpmmMainnetNewType;
export type DoxxClmmMainnet = DoxxClmmMainnetType;

export const doxxCpmmIdlMainnet = doxxCpmmIdlMainnetJson;
// export const doxxCpmmIdlMainnet = doxxCpmmIdlNewMainnetJson;
export const doxxClmmIdlMainnet = doxxClmmIdlMainnetJson;