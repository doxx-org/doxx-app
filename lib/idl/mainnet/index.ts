// TODO: change to DoxxCpmmMainnetJson
// TODO: change to DoxxCpmmMainnetType
import type { DoxxCpmmDevnet as DoxxCpmmMainnetType } from "../devnet/cpmmDevnetIdl";
import doxxCpmmIdlMainnetJson from "../devnet/cpmm_devnet_idl.json";
// TODO: change to DoxxCpmmMainnetNewType
// import type { DoxxCpmmDevnet as DoxxCpmmMainnetNewType } from "../devnet/cpmmDevnetIdl_new";
import type { DoxxClmmMainnet as DoxxClmmMainnetType } from "../mainnet/clmmMainnetIdl";
// import doxxCpmmIdlNewMainnetJson from "../devnet/cpmm_devnet_idl_new.json";
import doxxClmmIdlMainnetJson from "../mainnet/clmm_mainnet_idl.json";

export type DoxxCpmmMainnet = DoxxCpmmMainnetType;
// export type DoxxCpmmMainnet = DoxxCpmmMainnetNewType;
export type DoxxClmmMainnet = DoxxClmmMainnetType;

export const doxxCpmmIdlMainnet = doxxCpmmIdlMainnetJson;
// export const doxxCpmmIdlMainnet = doxxCpmmIdlNewMainnetJson;
export const doxxClmmIdlMainnet = doxxClmmIdlMainnetJson;
