// existing:
import { Metaplex } from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import pLimit from "p-limit";
import QuickLRU from "quick-lru";
import {
  PriceSource,
  TokenProfile,
  knownTokenProfilesMap,
} from "@/lib/config/tokens";
import { apiEnvConfig } from "../configs/apiEnvConfig";
import {
  GetAllTokenInfosPayload,
  MetaplexTokenMetadata,
  ResolveTokenFromUri,
  TokenDisplay,
} from "./type";

// ---------- Config ----------
const connection = new Connection(apiEnvConfig.RPC_URL, "finalized");

// Cache per server instance
const lru = new QuickLRU<string, TokenDisplay>({ maxSize: 5000 });

async function fetchJson(
  uri: string,
): Promise<{ name?: string; symbol?: string; image?: string } | null> {
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(uri, { signal: controller.signal });
    clearTimeout(to);
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

async function batchGetTokenMetadataMetaplex(
  connection: Connection,
  mints: GetAllTokenInfosPayload[],
) {
  const metaplex = Metaplex.make(connection);
  const mintAddresses = mints.map((m) => new PublicKey(m.address));

  const tokensList = await metaplex
    .nfts()
    .findAllByMintList({ mints: mintAddresses });

  // Token metadata from Metaplex
  const tokenMetadata: MetaplexTokenMetadata[] = [];

  // Token metadata that needs to be resolved from URI
  const toResolveFromUri: ResolveTokenFromUri[] = [];

  for (const token of tokensList) {
    if (!token || token.model !== "metadata") continue;

    const tokenProfile = mints.find(
      (m) =>
        m.address.toLowerCase() === token.mintAddress.toString().toLowerCase(),
    );
    if (!tokenProfile) {
      continue;
    }

    // If token.json is not available, we need to resolve it from the URI
    if (!token.json) {
      toResolveFromUri.push({
        name: token.name,
        symbol: token.symbol,
        address: token.address.toString(),
        uri: token.uri,
        decimals: tokenProfile.decimals,
      });
      continue;
    }

    // If token.json is available, we can add it to the token metadata
    tokenMetadata.push({
      address: token.address.toString(),
      name: token.name,
      symbol: token.symbol,
      image: token.json?.image ?? token.uri,
      decimals: tokenProfile.decimals,
    });
  }

  // Resolve images from URIs
  const imageMapFromUri = await hydrateImagesFromUris(toResolveFromUri, 6);

  // Map token metadata from URIs to token metadata
  const resolvedTokenMetaDataFromUri = toResolveFromUri.map((t) => {
    const image = imageMapFromUri.get(t.address.toLowerCase());
    return {
      address: t.address,
      name: t.name,
      symbol: t.symbol,
      image,
      decimals: t.decimals,
    };
  });

  // Merge token metadata from Metaplex and token metadata from URIs
  const mergedTokenMetadata = [
    ...tokenMetadata,
    ...resolvedTokenMetaDataFromUri,
  ];

  return mergedTokenMetadata;
}

// // ---------- Core resolver (batched) ----------
// async function resolveFromMetaplexBatched(
//   params: GetAllTokenInfosPayload[],
//   rpcBatchSize = 100,
// ) {
//   const rows: TokenProfile[] = [];
//   if (params.length === 0) return rows;
//   console.log("🚀 ~ params:", params);

//   // 1) Derive PDAs
//   const pdas = params.map((p) => findMetadataPda(new PublicKey(p.address)));

//   // 2) Batch fetch full account infos (not just data)
//   const chunks = chunk(pdas, rpcBatchSize);
//   const infos: (import("@solana/web3.js").AccountInfo<Buffer> | null)[] = [];
//   for (const c of chunks) {
//     console.log("🚀 ~ c:", c);
//     const part = await connection.getMultipleAccountsInfo(c, {
//       commitment: "confirmed",
//     });
//     console.log("🚀 ~ part:", part);
//     infos.push(...part);
//   }

//   // 3) Convert to UMI RpcAccount and deserialize
//   for (let i = 0; i < params.length; i++) {
//     const info = infos[i];
//     console.log("🚀 ~ info:", info);
//     if (!info) {
//       rows.push({ address: params[i].address, decimals: params[i].decimals });
//       continue;
//     }
//     try {
//       // Build RpcAccount expected by deserializeMetadata (UMI types)
//       const rpcAcc: RpcAccount = {
//         publicKey: umiPublicKey(pdas[i].toBase58()),
//         owner: umiPublicKey(info.owner.toBase58()),
//         // lamports: BigInt(info.lamports),
//         lamports: {
//           basisPoints: BigInt(info.lamports),
//           identifier: "SOL",
//           decimals: 9,
//         },
//         executable: info.executable,
//         data: new Uint8Array(info.data), // Buffer -> Uint8Array
//         // rentEpoch is optional; include if you want:
//         // rentEpoch: info.rentEpoch !== undefined ? BigInt(info.rentEpoch) : undefined,
//       };
//       console.log("🚀 ~ rpcAcc:", rpcAcc);

//       const md = deserializeMetadata(rpcAcc);
//       console.log("🚀 ~ md:", md);
//       rows.push({
//         address: params[i].address,
//         decimals: params[i].decimals,
//         name: md.name.trim() || undefined,
//         symbol: md.symbol.trim() as TokenSymbol | undefined,
//         image: md.uri.trim() || undefined,
//       });
//     } catch {
//       rows.push({ address: params[i].address, decimals: params[i].decimals });
//     }
//   }

//   return rows;
// }

async function hydrateImagesFromUris(
  toResolveFromUri: ResolveTokenFromUri[],
  uriConcurrency = 6,
) {
  const limit = pLimit(uriConcurrency);
  const tasks = toResolveFromUri.map((r) =>
    limit(async () => {
      if (!r.uri)
        return {
          address: r.address,
          name: r.name,
          symbol: r.symbol,
          image: undefined,
          decimals: r.decimals,
        };
      const json = await fetchJson(r.uri);
      return {
        address: r.address,
        name: r.name,
        symbol: r.symbol,
        image: json?.image,
        decimals: r.decimals,
      };
    }),
  );
  const results = await Promise.all(tasks);

  return new Map(results.map((x) => [x.address.toLowerCase(), x.image]));
}

// Token-2022 fallback (throttled; one RPC per mint via spl-token helper)
// async function resolveFromToken2022Throttled(
//   params: GetAllTokenInfosPayload[],
//   concurrency = 6,
// ) {
//   const limit = pLimit(concurrency);
//   const tasks = params.map((p) =>
//     limit(async () => {
//       try {
//         const meta = await getTokenMetadata(
//           connection,
//           new PublicKey(p.address),
//           "confirmed",
//           TOKEN_2022_PROGRAM_ID,
//         );
//         // may have name/symbol/uri; uri->JSON->image (optional)
//         let image: string | undefined;
//         if (meta?.uri) {
//           const json = await fetchJson(meta.uri);
//           image = json?.image;
//         }
//         return {
//           address: p.address,
//           name: meta?.name?.trim() || undefined,
//           symbol: meta?.symbol?.trim() || undefined,
//           image,
//           decimals: p.decimals,
//         };
//       } catch {
//         return { address: p.address, decimals: p.decimals };
//       }
//     }),
//   );
//   return Promise.all(tasks);
// }

// ---------- Route ----------
export async function POST(
  req: NextRequest,
): Promise<NextResponse<{ data: TokenProfile[] }>> {
  const body = await req.json().catch(() => null);
  if (!body || !body.params) {
    return NextResponse.json({ data: [] }, { status: 400 });
  }

  // 0) Deduplicate
  const params = body.params as GetAllTokenInfosPayload[];
  if (params.length === 0) {
    return NextResponse.json({ data: [] }, { status: 400 });
  }

  // 1) cache
  const results: Partial<Record<string, TokenDisplay>> = {};
  const toFetch: { address: string; decimals: number }[] = [];
  for (const p of params) {
    const cached = lru.get(p.address);
    if (cached) {
      results[p.address] = cached;
    } else {
      toFetch.push(p);
    }
  }

  // 2) token list fast path
  const stillMissing: GetAllTokenInfosPayload[] = [];
  if (toFetch.length) {
    for (const p of toFetch) {
      const t = knownTokenProfilesMap[p.address];

      if (t) {
        const td: TokenDisplay = {
          mint: p.address,
          name: t.name,
          symbol: t.symbol,
          image: t.image,
          decimals: t.decimals,
          priceSource: t.priceSource,
        };
        lru.set(p.address, td);
        results[p.address] = td;
      } else {
        stillMissing.push(p);
      }
    }
  }

  // 3) Metaplex on-chain (batched)
  // let unresolved: GetAllTokenInfosPayload[] = [];
  if (stillMissing.length) {
    const tokenMetadata = await batchGetTokenMetadataMetaplex(
      connection,
      stillMissing,
    );

    for (const r of tokenMetadata) {
      const td: TokenDisplay = {
        mint: r.address,
        name: r.name,
        symbol: r.symbol,
        image: r.image,
        decimals: r.decimals,
        // source:
        //   r.name || r.symbol || imageMap.get(r.address)
        //     ? "metaplex"
        //     : "fallback",
      };
      lru.set(r.address, td);
      results[r.address] = td;
      // if (td.source === "fallback")
      //   unresolved.push({ address: r.address, decimals: r.decimals });
    }
  }

  // 4) Token-2022 on-chain (throttled, only for those still unknown after Metaplex)
  // if (unresolved.length) {
  //   const t22 = await resolveFromToken2022Throttled(unresolved, 6);
  //   for (const r of t22) {
  //     if (r.name || r.symbol || r.image) {
  //       const td: TokenDisplay = {
  //         mint: r.address,
  //         name: r.name,
  //         symbol: r.symbol,
  //         image: r.image,
  //         decimals: r.decimals,
  //         source: "token2022",
  //       };
  //       lru.set(r.address, td);
  //       results[r.address] = td;
  //     }
  //   }
  // }

  // 5) Final fallback (make it an unknown token) for anything still empty
  const allTokenProfiles: TokenProfile[] = [];
  for (const p of params) {
    const td = results[p.address];
    if (td && td.name && td.symbol) {
      allTokenProfiles.push({
        address: td.mint,
        name: td.name,
        symbol: td.symbol,
        decimals: td.decimals,
        displayDecimals: 4,
        image: td.image,
        priceSource: td.priceSource,
      });
    } else {
      // Token not found, make it an unknown token
      allTokenProfiles.push({
        address: p.address,
        name: "UNKNOWN",
        symbol: "UNK",
        decimals: p.decimals,
        displayDecimals: 4,
        image: undefined,
        priceSource: PriceSource.POOL,
      });
    }
  }

  return NextResponse.json(
    { data: allTokenProfiles },
    {
      headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" },
    },
  );
}
