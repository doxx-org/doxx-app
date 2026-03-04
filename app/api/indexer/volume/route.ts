import { NextRequest, NextResponse } from "next/server";

const DEX_INDEXER_BASE =
  process.env.DEX_INDEXER_URL ??
  "https://dex-indexer-devnet-doxx-101797961016.us-west1.run.app";

const CACHE_TTL_MS = 60 * 1000; // 1 minutes

type HistoryResponse =
  | { s: "ok"; t: number[]; v?: number[]; vq?: number[] }
  | { s: "no_data"; nextTime?: number }
  | { s: "error"; errmsg?: string };

type VolumeEntry = {
  volumeBase: number;
  volumeQuote: number;
  fetchedAt: number;
};

const volumeCache = new Map<string, VolumeEntry>();

function cacheKey(mint0: string, mint1: string): string {
  return `${mint0}/${mint1}`;
}

function getCached(key: string): VolumeEntry | undefined {
  const entry = volumeCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    volumeCache.delete(key);
    return undefined;
  }
  return entry;
}

async function fetchHistoryVolume(
  symbol: string,
): Promise<{ volumeBase: number; volumeQuote: number }> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 86400; // last 24h
  const url = new URL(`${DEX_INDEXER_BASE}/history`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("resolution", "1d");
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));
  url.searchParams.set("countback", "1");

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return { volumeBase: 0, volumeQuote: 0 };
  const data = (await res.json()) as HistoryResponse;

  if (data.s !== "ok" || !data.t?.length)
    return { volumeBase: 0, volumeQuote: 0 };
  const volumeBase = (data.v ?? []).reduce((a, b) => a + b, 0);
  const volumeQuote = (data.vq ?? []).reduce((a, b) => a + b, 0);
  return { volumeBase, volumeQuote };
}

export type VolumePoolPayload = {
  poolId: string;
  mint0: string;
  mint1: string;
};

export type VolumeResponse = {
  volumes: Record<string, { volumeBase: number; volumeQuote: number }>;
};

export async function POST(
  req: NextRequest,
): Promise<NextResponse<VolumeResponse | { error: string }>> {
  let body: { pools?: VolumePoolPayload[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const pools = body?.pools;
  if (!Array.isArray(pools) || pools.length === 0) {
    return NextResponse.json(
      { volumes: {} },
      {
        headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
      },
    );
  }

  const volumes: Record<string, { volumeBase: number; volumeQuote: number }> =
    {};
  const toFetch: { poolId: string; symbol: string; key: string }[] = [];

  for (const p of pools) {
    if (!p?.poolId || !p?.mint0 || !p?.mint1) continue;
    const key = cacheKey(p.mint0, p.mint1);
    const cached = getCached(key);
    if (cached) {
      volumes[p.poolId] = {
        volumeBase: cached.volumeBase,
        volumeQuote: cached.volumeQuote,
      };
    } else {
      const symbol = `${p.mint0}/${p.mint1}`;
      toFetch.push({ poolId: p.poolId, symbol, key });
    }
  }

  await Promise.all(
    toFetch.map(async ({ poolId, symbol, key }) => {
      const { volumeBase, volumeQuote } = await fetchHistoryVolume(symbol);

      volumeCache.set(key, {
        volumeBase,
        volumeQuote,
        fetchedAt: Date.now(),
      });
      volumes[poolId] = { volumeBase, volumeQuote };
    }),
  );

  return NextResponse.json(
    { volumes },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
