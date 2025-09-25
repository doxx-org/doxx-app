import { getAccount } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const ONE_M = new BN(1_000_000); // ppm
const TEN_K = new BN(10_000); // bps for UI slippage

enum CreatorFeeOn {
  BOTH_TOKEN = 0,
  ONLY_TOKEN_0 = 1,
  ONLY_TOKEN_1 = 2,
}

type AmmCfg = { tradeFeeRate: BN; creatorFeeRate: BN };
type PoolStateLite = {
  poolAddress: PublicKey;
  ammConfig: PublicKey;
  token0Mint: PublicKey;
  token1Mint: PublicKey;
  token0Program: PublicKey;
  token1Program: PublicKey;
  mint0Decimals: number;
  mint1Decimals: number;
  token0Vault: PublicKey;
  token1Vault: PublicKey;
  protocolFeesToken0: BN;
  protocolFeesToken1: BN;
  fundFeesToken0: BN;
  fundFeesToken1: BN;
  creatorFeesToken0: BN;
  creatorFeesToken1: BN;
  enableCreatorFee: boolean;
  creatorFeeOn: CreatorFeeOn;
  // creatorFeeOn: 0 | 1 | 2; // 0 both, 1 only0, 2 only1
  status: number; // bit2==1 → swap disabled
};

export type CpPool = {
  programId: PublicKey;
  poolAddress: PublicKey;
  token0Mint: PublicKey;
  token1Mint: PublicKey;
  token0Program: PublicKey;
  token1Program: PublicKey;
  mint0Decimals: number;
  mint1Decimals: number;
  enableCreatorFee: boolean;
  creatorFeeOn: CreatorFeeOn;
  amm: AmmCfg;
  reserve0: BN; // smallest units, adjusted (see buildCpPool)
  reserve1: BN;
};

const inIs0 = (p: CpPool, inMint: PublicKey) => {
  if (inMint.equals(p.token0Mint)) return true;
  if (inMint.equals(p.token1Mint)) return false;
  throw new Error("inMint not in pool");
};

const creatorFeeApplies = (p: CpPool, inMint: PublicKey) => {
  if (!p.enableCreatorFee) return false;
  const is0 = inIs0(p, inMint);
  return (
    p.creatorFeeOn === CreatorFeeOn.BOTH_TOKEN ||
    (p.creatorFeeOn === CreatorFeeOn.ONLY_TOKEN_0 && is0) ||
    (p.creatorFeeOn === CreatorFeeOn.ONLY_TOKEN_1 && !is0)
  );
};

const effFeePpm = (p: CpPool, inMint: PublicKey) => {
  let f = p.amm.tradeFeeRate;
  if (creatorFeeApplies(p, inMint)) f = f.add(p.amm.creatorFeeRate);
  return f.gt(ONE_M) ? ONE_M : f;
};

const applyPpmFeeOnInput = (amt: BN, ppm: BN) =>
  amt.mul(ONE_M.sub(ppm)).div(ONE_M);

/** build one pool ready for quoting */
export async function buildCpPool(
  conn: Connection,
  programId: PublicKey,
  st: PoolStateLite,
  cfg: AmmCfg,
): Promise<CpPool | null> {
  // skip if swap disabled (status bit2 = 1)
  const swapDisabled = (st.status & 0b100) !== 0;
  if (swapDisabled) return null;

  const v0 = await getAccount(conn, st.token0Vault);
  const v1 = await getAccount(conn, st.token1Vault);
  const vault0 = new BN(v0.amount.toString());
  const vault1 = new BN(v1.amount.toString());

  const reserve0 = vault0
    .sub(st.protocolFeesToken0)
    .sub(st.fundFeesToken0)
    .sub(st.enableCreatorFee ? st.creatorFeesToken0 : new BN(0));
  const reserve1 = vault1
    .sub(st.protocolFeesToken1)
    .sub(st.fundFeesToken1)
    .sub(st.enableCreatorFee ? st.creatorFeesToken1 : new BN(0));

  if (reserve0.lte(new BN(0)) || reserve1.lte(new BN(0))) return null;

  return {
    programId,
    poolAddress: st.poolAddress ?? st.token0Vault, // whichever you carry along
    token0Mint: st.token0Mint,
    token1Mint: st.token1Mint,
    token0Program: st.token0Program,
    token1Program: st.token1Program,
    mint0Decimals: st.mint0Decimals,
    mint1Decimals: st.mint1Decimals,
    enableCreatorFee: st.enableCreatorFee,
    creatorFeeOn: st.creatorFeeOn,
    // creatorFeeOn: asCreatorFeeOn(st.creatorFeeOn),
    amm: { tradeFeeRate: cfg.tradeFeeRate, creatorFeeRate: cfg.creatorFeeRate },
    reserve0,
    reserve1,
  };
}

export function quoteOutSingle(
  pool: CpPool,
  inMint: PublicKey,
  amountIn: BN,
): BN {
  if (amountIn.isZero()) return new BN(0);
  const is0 = inIs0(pool, inMint);
  const x = is0 ? pool.reserve0 : pool.reserve1;
  const y = is0 ? pool.reserve1 : pool.reserve0;
  const dx2 = applyPpmFeeOnInput(amountIn, effFeePpm(pool, inMint));
  return x.isZero() || y.isZero() ? new BN(0) : dx2.mul(y).div(x.add(dx2));
}

export function quoteInSingle(
  pool: CpPool,
  outMint: PublicKey,
  amountOut: BN,
): BN {
  if (amountOut.isZero()) return new BN(0);
  const outIs1 = outMint.equals(pool.token1Mint);
  const x = outIs1 ? pool.reserve0 : pool.reserve1;
  const y = outIs1 ? pool.reserve1 : pool.reserve0;
  if (amountOut.gte(y) || x.isZero() || y.isZero())
    return new BN("340282366920938463463374607431768211455");
  const afterFee = amountOut.mul(x).div(y.sub(amountOut)); // amountIn*(1-fee)
  const fee = effFeePpm(pool, outIs1 ? pool.token0Mint : pool.token1Mint);
  const denom = ONE_M.sub(fee);
  return denom.isZero()
    ? new BN("340282366920938463463374607431768211455")
    : afterFee.mul(ONE_M).div(denom);
}

type Graph = Map<string, CpPool[]>;
const pk = (x: PublicKey) => x.toBase58();

function buildGraph(pools: CpPool[]): Graph {
  const g: Graph = new Map();
  for (const p of pools) {
    const a = pk(p.token0Mint),
      b = pk(p.token1Mint);
    if (!g.has(a)) g.set(a, []);
    if (!g.has(b)) g.set(b, []);
    g.get(a)!.push(p);
    g.get(b)!.push(p);
  }
  return g;
}

function enumeratePaths(
  g: Graph,
  start: PublicKey,
  end: PublicKey,
  maxHops = 3,
): CpPool[][] {
  const S = pk(start),
    T = pk(end),
    res: CpPool[][] = [];
  const seen = new Set<string>([S]);
  function dfs(cur: string, path: CpPool[], hops: number) {
    if (hops > maxHops) return;
    if (cur === T && path.length > 0) {
      res.push([...path]);
      return;
    }
    for (const pool of g.get(cur) || []) {
      const nxt =
        cur === pk(pool.token0Mint)
          ? pk(pool.token1Mint)
          : cur === pk(pool.token1Mint)
            ? pk(pool.token0Mint)
            : null;
      if (!nxt || seen.has(nxt)) continue;
      seen.add(nxt);
      path.push(pool);
      dfs(nxt, path, hops + 1);
      path.pop();
      seen.delete(nxt);
    }
  }
  dfs(S, [], 0);
  return res;
}

export type RouteHop = {
  pool: CpPool;
  inMint: PublicKey;
  outMint: PublicKey;
  amountIn: BN;
  amountOut: BN;
  minOut?: BN;
  maxIn?: BN;
};
export type RouteQuote = {
  hops: RouteHop[];
  totalAmountIn: BN;
  totalAmountOut: BN;
};

function quotePathExactIn(
  path: CpPool[],
  inMint: PublicKey,
  outMint: PublicKey,
  amountIn: BN,
): RouteQuote | null {
  let x = amountIn,
    cur = inMint;
  const hops: RouteHop[] = [];
  for (const p of path) {
    const nxt = cur.equals(p.token0Mint)
      ? p.token1Mint
      : cur.equals(p.token1Mint)
        ? p.token0Mint
        : null;
    if (!nxt) return null;
    const y = quoteOutSingle(p, cur, x);
    if (y.lte(new BN(0))) return null;
    hops.push({
      pool: p,
      inMint: cur,
      outMint: nxt,
      amountIn: x,
      amountOut: y,
    });
    x = y;
    cur = nxt;
  }
  if (!cur.equals(outMint)) return null;
  return { hops, totalAmountIn: amountIn, totalAmountOut: x };
}

function quotePathExactOut(
  path: CpPool[],
  inMint: PublicKey,
  outMint: PublicKey,
  amountOut: BN,
): RouteQuote | null {
  let need = amountOut,
    cur = outMint;
  const rev: RouteHop[] = [];
  for (let i = path.length - 1; i >= 0; --i) {
    const p = path[i];
    const prev = cur.equals(p.token0Mint)
      ? p.token1Mint
      : cur.equals(p.token1Mint)
        ? p.token0Mint
        : null;
    if (!prev) return null;
    const req = quoteInSingle(p, cur, need);
    if (req.lte(new BN(0))) return null;
    rev.push({
      pool: p,
      inMint: prev,
      outMint: cur,
      amountIn: req,
      amountOut: need,
    });
    cur = prev;
    need = req;
  }
  if (!cur.equals(inMint)) return null;
  const hops = rev.reverse();
  return {
    hops,
    totalAmountIn: hops[0].amountIn,
    totalAmountOut: hops[hops.length - 1].amountOut,
  };
}

export function findBestRoute(
  pools: CpPool[],
  inputMint: PublicKey,
  outputMint: PublicKey,
  mode: "ExactIn" | "ExactOut",
  amountUi: BN, // parsed to smallest units already
): RouteQuote | null {
  if (inputMint.equals(outputMint)) return null;
  const g = buildGraph(pools);
  const paths = enumeratePaths(g, inputMint, outputMint, 3);
  if (paths.length === 0) return null;

  if (mode === "ExactIn") {
    let best: RouteQuote | null = null;
    for (const p of paths) {
      const q = quotePathExactIn(p, inputMint, outputMint, amountUi);
      if (!q) continue;
      if (!best || q.totalAmountOut.gt(best.totalAmountOut)) best = q;
    }
    return best;
  } else {
    let best: RouteQuote | null = null;
    for (const p of paths) {
      const q = quotePathExactOut(p, inputMint, outputMint, amountUi);
      if (!q) continue;
      if (!best || q.totalAmountIn.lt(best.totalAmountIn)) best = q;
    }
    return best;
  }
}

export function applySlippage(
  q: RouteQuote,
  slippageBps: number,
  mode: "ExactIn" | "ExactOut",
): RouteQuote {
  const b = new BN(slippageBps);
  if (mode === "ExactIn") {
    const adj = (x: BN) => x.mul(TEN_K.sub(b)).div(TEN_K);
    return {
      ...q,
      hops: q.hops.map((h) => ({ ...h, minOut: adj(h.amountOut) })),
      totalAmountOut: adj(q.totalAmountOut),
    };
  } else {
    const adj = (x: BN) => x.mul(TEN_K.add(b)).div(TEN_K);
    return {
      ...q,
      hops: q.hops.map((h) => ({ ...h, maxIn: adj(h.amountIn) })),
      totalAmountIn: adj(q.totalAmountIn),
    };
  }
}

/** Map a hop → accounts needed by your swap hook */
export function toHookParamsExactIn(h: RouteHop) {
  return {
    inputMint: h.inMint,
    outputMint: h.outMint,
    amountIn: h.amountIn.toString(), // your hook will parse BN again
    minOut: (h.minOut ?? h.amountOut).toString(),
    // plus vaults/programs from h.pool if you modify the hook to accept them explicitly
  };
}
