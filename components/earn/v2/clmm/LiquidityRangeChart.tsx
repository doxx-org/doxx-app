"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseNumberSafe(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function formatPriceInput(n: number, fractionDigits = 6) {
  const fixed = n.toFixed(fractionDigits);
  // trim trailing zeros while keeping at least one decimal digit if needed
  if (!fixed.includes(".")) return fixed;
  return fixed.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

function formatPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp(p, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo] ?? 0;
  const t = idx - lo;
  return (sorted[lo] ?? 0) * (1 - t) + (sorted[hi] ?? 0) * t;
}

export type LiquidityTick = {
  tickIndex: number;
  liquidityNet: number; // mock: number (real: bigint/string)
};

// Key Aspects of Uniswap Tick Spacing Definition:
//     - Ticks are boundary points in price space (\(1.0001^{n}\)),
//     - and tick spacing dictates that liquidity can only be added at tick indices divisible by this value.
// Relationship to Fees:
// - 0.01% Fee Tier: 1 tick spacing (highest granularity).
// - 0.05% Fee Tier: 10 tick spacing.
// - 0.30% Fee Tier: 60 tick spacing.
// - 1.00% Fee Tier: 200 tick spacing.
// Price Movement:
// - A move of 1 tick always represents a 0.01% price change.
// - Therefore, a tick spacing of 60 means the price moves in increments of \(60\times 0.01\%=0.60\%\).
// Purpose:
// - This mechanism enables concentrated liquidity while reducing gas costs for swaps and pool updates by limiting the number of initialized ticks.
// Range:
// - Ticks range from -887,272 to 887,272.
export type LiquidityTickData = {
  currentTick: number; // tick at currentPrice
  tickSpacing: number;
  baseLiquidity: number; // active liquidity before first initialized tick
  ticks: LiquidityTick[]; // sorted by tickIndex
};

const LOG_1P0001 = Math.log(1.0001);

function tickFromPrice(
  price: number,
  currentPrice: number,
  currentTick: number,
) {
  const safe = Math.max(price, currentPrice * 1e-12, 1e-12);
  const ratio = safe / Math.max(currentPrice, 1e-12);
  return currentTick + Math.floor(Math.log(ratio) / LOG_1P0001);
}

function snapToSpacing(tick: number, spacing: number) {
  if (spacing <= 1) return tick;
  return Math.round(tick / spacing) * spacing;
}

function buildMockTicksFromIntervals(args: {
  currentPrice: number;
  currentTick: number;
  tickSpacing: number;
  baseLiquidity: number;
  intervals: Array<{ fromMul: number; toMul: number; liquidity: number }>;
}): LiquidityTickData {
  const { currentPrice, currentTick, tickSpacing, baseLiquidity, intervals } =
    args;

  const deltas = new Map<number, number>();
  const addDelta = (tick: number, delta: number) => {
    deltas.set(tick, (deltas.get(tick) ?? 0) + delta);
  };

  for (const it of intervals) {
    const fromP = currentPrice * it.fromMul;
    const toP = currentPrice * it.toMul;
    const a = Math.min(fromP, toP);
    const b = Math.max(fromP, toP);

    let t0 = snapToSpacing(
      tickFromPrice(a, currentPrice, currentTick),
      tickSpacing,
    );
    let t1 = snapToSpacing(
      tickFromPrice(b, currentPrice, currentTick),
      tickSpacing,
    );

    if (t1 === t0) t1 = t0 + tickSpacing;

    addDelta(t0, it.liquidity);
    addDelta(t1, -it.liquidity);
  }

  const ticks = Array.from(deltas.entries())
    .map(([tickIndex, liquidityNet]) => ({ tickIndex, liquidityNet }))
    .sort((a, b) => a.tickIndex - b.tickIndex);

  return { currentTick, tickSpacing, baseLiquidity, ticks };
}

function defaultMockLiquidityData(currentPrice: number): LiquidityTickData {
  // Uniswap-like bands: thick near price + some distant walls.
  return buildMockTicksFromIntervals({
    currentPrice,
    currentTick: 0,
    tickSpacing: 60,
    baseLiquidity: 800,
    intervals: [
      { fromMul: 0.985, toMul: 1.015, liquidity: 5000 },
      { fromMul: 0.94, toMul: 0.975, liquidity: 1800 },
      { fromMul: 1.025, toMul: 1.08, liquidity: 2200 },
      { fromMul: 0.7, toMul: 0.85, liquidity: 900 },
      { fromMul: 1.15, toMul: 1.4, liquidity: 1100 },
      { fromMul: 1.6, toMul: 2.1, liquidity: 700 },
    ],
  });
}

function buildLiquidityQuery(data: LiquidityTickData) {
  const ticks = [...data.ticks].sort((a, b) => a.tickIndex - b.tickIndex);
  const idxs = ticks.map((t) => t.tickIndex);
  const prefixNet: number[] = [];
  let acc = 0;
  for (const t of ticks) {
    acc += t.liquidityNet;
    prefixNet.push(acc);
  }

  const liquidityAtTick = (tick: number) => {
    // last idx <= tick
    let lo = 0;
    let hi = idxs.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if ((idxs[mid] ?? 0) <= tick) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const net = ans >= 0 ? (prefixNet[ans] ?? 0) : 0;
    return Math.max(0, data.baseLiquidity + net);
  };

  return { liquidityAtTick };
}

export interface LiquidityRangeChartProps {
  currentPrice: number;
  minPrice: string;
  maxPrice: string;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  barCount?: number;
  domainPaddingPct?: number; // initial max % (e.g. 30 => +3000%)
  liquidityData?: LiquidityTickData; // omit to use built-in mock
  className?: string;
}

export function LiquidityRangeChart({
  currentPrice,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  barCount = 48,
  domainPaddingPct = 30, // +3000% default
  liquidityData,
  className,
}: LiquidityRangeChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(0);
  const [isPanning, setIsPanning] = useState(false);
  const absMax = useMemo(
    () => currentPrice * (1 + Math.max(0, domainPaddingPct)),
    [currentPrice, domainPaddingPct],
  );
  const absMin = 0;

  // Viewport for the histogram (what the bars show). Defaults to +/-5%.
  const [viewMin, setViewMin] = useState<number>(() => currentPrice * 0.95);
  const [viewMax, setViewMax] = useState<number>(() => currentPrice * 1.05);

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    startDist: number;
    startViewMin: number;
    startViewMax: number;
  } | null>(null);

  const parsedMin = parseNumberSafe(minPrice);
  const parsedMax = parseNumberSafe(maxPrice);

  // Reset viewport when the pool/currentPrice changes.
  useEffect(() => {
    const nextMin = clamp(currentPrice * 0.95, absMin, absMax);
    const nextMax = clamp(currentPrice * 1.05, absMin, absMax);
    setViewMin(Math.min(nextMin, nextMax));
    setViewMax(Math.max(nextMin, nextMax));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrice, absMax]);

  const domain = useMemo(() => {
    const min = clamp(Math.min(viewMin, viewMax), absMin, absMax);
    const max = clamp(Math.max(viewMin, viewMax), absMin, absMax);
    // Avoid divide-by-zero
    const safeMax = max <= min ? min + 1e-9 : max;
    return { min, max: safeMax };
  }, [absMax, viewMax, viewMin]);

  const tickData = useMemo(() => {
    return liquidityData ?? defaultMockLiquidityData(currentPrice);
  }, [currentPrice, liquidityData]);
  console.log("🚀 ~ tickData:", tickData);

  // Uniswap-style: ticks -> active liquidity -> log-binned histogram.
  const bars = useMemo(() => {
    const { liquidityAtTick } = buildLiquidityQuery(tickData);

    // If domain.min is 0, use epsilon for log scale.
    const eps = Math.max(currentPrice * 1e-6, 1e-12);
    const logMin = Math.log(Math.max(domain.min, eps));
    const logMax = Math.log(Math.max(domain.max, eps));
    const span = Math.max(1e-12, logMax - logMin);

    return Array.from({ length: barCount }, (_, i) => {
      const xm = (i + 0.5) / barCount;
      const price = Math.exp(logMin + xm * span);
      const tick = snapToSpacing(
        tickFromPrice(price, currentPrice, tickData.currentTick),
        tickData.tickSpacing,
      );
      return liquidityAtTick(tick);
    });
  }, [barCount, currentPrice, domain.max, domain.min, tickData]);

  const maxBar = useMemo(() => Math.max(1e-9, ...bars), [bars]);
  const thickCutoff = useMemo(() => percentile(bars, 0.75), [bars]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setWidth(el.getBoundingClientRect().width);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Log-scale mapping (Uniswap-like feel). When domain includes 0, use epsilon.
  const eps = Math.max(currentPrice * 1e-6, 1e-12);
  const logMin = Math.log(Math.max(domain.min, eps));
  const logMax = Math.log(Math.max(domain.max, eps));
  const logSpan = Math.max(1e-12, logMax - logMin);

  const toPct = (price: number) => {
    const p = Math.max(price, eps);
    return clamp((Math.log(p) - logMin) / logSpan, 0, 1);
  };
  const fromPct = (pct: number) => {
    const p = Math.exp(logMin + clamp(pct, 0, 1) * logSpan);
    // If viewport includes 0, allow snapping to 0 at extreme left.
    if (domain.min === 0 && pct <= 0.0005) return 0;
    return p;
  };

  const currentPct = toPct(currentPrice);
  const minPct = toPct(parsedMin ?? currentPrice * 0.95);
  const maxPct = toPct(parsedMax ?? currentPrice * 1.05);
  const leftPct = Math.min(minPct, maxPct);
  const rightPct = Math.max(minPct, maxPct);
  const rangeWidthPct = clamp(rightPct - leftPct, 0, 1);

  const minDiffPct =
    ((parsedMin ?? currentPrice * 0.95) / currentPrice - 1) * 100;
  const maxDiffPct =
    ((parsedMax ?? currentPrice * 1.05) / currentPrice - 1) * 100;

  const startDrag = (which: "min" | "max", e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const update = (clientX: number) => {
      const x = clamp(clientX - rect.left, 0, rect.width);
      const pct = rect.width === 0 ? 0 : x / rect.width;
      const price = fromPct(pct);

      if (which === "min") {
        const other = parseNumberSafe(maxPrice) ?? currentPrice * 1.05;
        const clamped = Math.min(price, other);
        onMinPriceChange(formatPriceInput(clamped));
      } else {
        const other = parseNumberSafe(minPrice) ?? currentPrice * 0.95;
        const clamped = Math.max(price, other);
        onMaxPriceChange(formatPriceInput(clamped));
      }
    };

    update(e.clientX);

    const onMove = (ev: PointerEvent) => update(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
  };

  const zoomViewport = (mult: number) => {
    // Zoom in log space so it feels like Uniswap's chart.
    const eps = Math.max(currentPrice * 1e-6, 1e-12);
    const vMin = Math.max(domain.min, eps);
    const vMax = Math.max(domain.max, eps);
    const absMinLog = Math.log(Math.max(absMin, eps));
    const absMaxLog = Math.log(Math.max(absMax, eps));

    const logMin = Math.log(vMin);
    const logMax = Math.log(vMax);
    const center = (logMin + logMax) / 2;
    const span = Math.max(1e-12, logMax - logMin);
    const nextSpan = clamp(span * mult, 1e-6, absMaxLog - absMinLog);

    let nextMinLog = center - nextSpan / 2;
    let nextMaxLog = center + nextSpan / 2;

    if (nextMinLog < absMinLog) {
      const shift = absMinLog - nextMinLog;
      nextMinLog += shift;
      nextMaxLog += shift;
    }
    if (nextMaxLog > absMaxLog) {
      const shift = absMaxLog - nextMaxLog;
      nextMinLog += shift;
      nextMaxLog += shift;
    }

    setViewMin(clamp(Math.exp(nextMinLog), absMin, absMax));
    setViewMax(clamp(Math.exp(nextMaxLog), absMin, absMax));
  };

  const startPan = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // If user is pinching (2 pointers), don't start panning the range.
    if (pointersRef.current.size >= 2) return;
    const el = containerRef.current;
    if (!el) return;

    // Keep pointer events inside the chart (helps avoid drawer scroll/drag).
    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const eps = Math.max(currentPrice * 1e-6, 1e-12);
    const startViewMin = domain.min;
    const startViewMax = domain.max;
    const startViewMinSafe = Math.max(startViewMin, eps);
    const startViewMaxSafe = Math.max(startViewMax, eps);
    const startLogSpan = Math.max(
      1e-12,
      Math.log(startViewMaxSafe) - Math.log(startViewMinSafe),
    );

    setIsPanning(true);

    const update = (clientX: number) => {
      // If a second finger is added (pinch), stop panning updates.
      if (pointersRef.current.size >= 2) return;
      const dx = clientX - startX;
      const dp = rect.width === 0 ? 0 : dx / rect.width;
      const deltaLog = dp * startLogSpan;
      let factor = Math.exp(deltaLog);

      // Clamp factor so viewport remains within absolute bounds.
      if (startViewMaxSafe * factor > absMax) {
        factor = absMax / startViewMaxSafe;
      }
      if (startViewMinSafe * factor < eps) {
        factor = eps / startViewMinSafe;
      }

      const nextViewMin = startViewMin === 0 ? 0 : startViewMinSafe * factor;
      const nextViewMax = startViewMaxSafe * factor;

      setViewMin(clamp(nextViewMin, absMin, absMax));
      setViewMax(clamp(nextViewMax, absMin, absMax));
    };

    update(e.clientX);

    const onMove = (ev: PointerEvent) => update(ev.clientX);
    const onUp = () => {
      setIsPanning(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
  };

  // Drag the green overlay to move the selected range (min/max) only.
  const startSelectionPan = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;

    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const rect = el.getBoundingClientRect();
    const startX = e.clientX;

    const rawMin = parseNumberSafe(minPrice) ?? currentPrice * 0.95;
    const rawMax = parseNumberSafe(maxPrice) ?? currentPrice * 1.05;
    const startMin = Math.min(rawMin, rawMax);
    const startMax = Math.max(rawMin, rawMax);
    const eps = Math.max(currentPrice * 1e-6, 1e-12);
    const startMinSafe = Math.max(startMin, eps);
    const startMaxSafe = Math.max(startMax, eps);
    const startLogSpan = Math.max(
      1e-12,
      Math.log(Math.max(domain.max, eps)) - Math.log(Math.max(domain.min, eps)),
    );

    const update = (clientX: number) => {
      if (pointersRef.current.size >= 2) return;
      const dx = clientX - startX;
      const dp = rect.width === 0 ? 0 : dx / rect.width;
      const deltaLog = dp * startLogSpan;
      let factor = Math.exp(deltaLog);

      // Clamp factor so selection stays within absolute bounds.
      if (startMaxSafe * factor > absMax) {
        factor = absMax / startMaxSafe;
      }
      if (startMinSafe * factor < eps) {
        factor = eps / startMinSafe;
      }

      const nextMin = startMin === 0 ? 0 : startMinSafe * factor;
      const nextMax = startMaxSafe * factor;

      onMinPriceChange(formatPriceInput(nextMin));
      onMaxPriceChange(formatPriceInput(nextMax));
    };

    update(e.clientX);

    const onMove = (ev: PointerEvent) => update(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
  };

  const onPointerDownCapture = (e: React.PointerEvent) => {
    console.log("🚀 ~ down capture e.pointerId:", e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMoveCapture = (e: React.PointerEvent) => {
    const map = pointersRef.current;
    if (!map.has(e.pointerId)) return;
    console.log("🚀 ~ map:", map);
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (map.size !== 2) {
      pinchRef.current = null;
      return;
    }

    e.preventDefault();

    const pts = Array.from(map.values());
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    const dist = Math.hypot(dx, dy);

    if (!pinchRef.current) {
      pinchRef.current = {
        startDist: dist,
        startViewMin: domain.min,
        startViewMax: domain.max,
      };
      return;
    }

    const { startDist, startViewMin, startViewMax } = pinchRef.current;
    const scale = startDist === 0 ? 1 : dist / startDist;
    // Pinch out (scale>1) => zoom in (smaller span)
    // Pinch in  (scale<1) => zoom out (larger span)
    const startSpan = startViewMax - startViewMin;
    const center = (startViewMax + startViewMin) / 2;
    const nextSpan = clamp(
      startSpan / scale,
      currentPrice * 1e-6,
      absMax - absMin,
    );

    let nextMin = center - nextSpan / 2;
    let nextMax = center + nextSpan / 2;

    if (nextMin < absMin) {
      const shift = absMin - nextMin;
      nextMin += shift;
      nextMax += shift;
    }
    if (nextMax > absMax) {
      const shift = absMax - nextMax;
      nextMin += shift;
      nextMax += shift;
    }

    setViewMin(clamp(nextMin, absMin, absMax));
    setViewMax(clamp(nextMax, absMin, absMax));
  };

  const onPointerUpCapture = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    console.log("🚀 ~ up capture e.pointerId:", e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
  };

  // Pan ONLY the viewport (chart view) without changing selected min/max.
  const panViewByDeltaPixels = (deltaPixels: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dp = rect.width === 0 ? 0 : deltaPixels / rect.width;

    const eps = Math.max(currentPrice * 1e-6, 1e-12);
    const startMin = domain.min;
    const startMax = domain.max;
    const startMinSafe = Math.max(startMin, eps);
    const startMaxSafe = Math.max(startMax, eps);
    const logSpan = Math.max(
      1e-12,
      Math.log(startMaxSafe) - Math.log(startMinSafe),
    );

    const deltaLog = dp * logSpan;
    let factor = Math.exp(deltaLog);

    if (startMaxSafe * factor > absMax) {
      factor = absMax / startMaxSafe;
    }
    if (startMinSafe * factor < eps) {
      factor = eps / startMinSafe;
    }

    const nextMin = startMin === 0 ? 0 : startMinSafe * factor;
    const nextMax = startMaxSafe * factor;

    setViewMin(clamp(nextMin, absMin, absMax));
    setViewMax(clamp(nextMax, absMin, absMax));
  };

  const zoomByWheel = (deltaY: number) => {
    // Trackpad pinch typically arrives as wheel + ctrlKey on macOS.
    // deltaY > 0 => zoom out (show more)
    // deltaY < 0 => zoom in  (show less)
    const k = 0.002;
    const mult = Math.exp(deltaY * k);
    zoomViewport(mult);
  };

  // Native non-passive wheel interception so the dialog never scrolls.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      ev.stopPropagation();

      // Trackpad pinch (macOS) usually comes through as ctrl+wheel.
      if (ev.ctrlKey) {
        zoomByWheel(ev.deltaY);
        return;
      }

      // Default behavior:
      // - vertical scroll => zoom in/out
      // - horizontal scroll => pan left/right
      const absX = Math.abs(ev.deltaX);
      const absY = Math.abs(ev.deltaY);

      if (absY >= absX) {
        zoomByWheel(ev.deltaY);
      } else {
        // Horizontal scroll should move the view only (not prices).
        panViewByDeltaPixels(ev.deltaX);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain.min, domain.max, minPrice, maxPrice, absMax, currentPrice]);

  const axisTicks = useMemo(() => {
    const ticks = 4;
    const arr: number[] = [];
    const eps = Math.max(currentPrice * 1e-6, 1e-12);
    const logMin = Math.log(Math.max(domain.min, eps));
    const logMax = Math.log(Math.max(domain.max, eps));
    const span = Math.max(1e-12, logMax - logMin);
    for (let i = 0; i < ticks; i++) {
      const t = i / (ticks - 1);
      if (i === 0 && domain.min === 0) {
        arr.push(0);
      } else {
        arr.push(Math.exp(logMin + t * span));
      }
    }
    return arr;
  }, [currentPrice, domain.max, domain.min]);

  return (
    <div className={cn("w-full select-none", className)}>
      <div className={cn(text.b4(), "mb-3 text-white")}>Liquidity Range</div>
      <div
        ref={containerRef}
        className={cn(
          "bg-black-900 relative h-40 w-full touch-none overflow-hidden overscroll-none",
          isPanning ? "cursor-grabbing" : "cursor-grab",
        )}
        onPointerDownCapture={onPointerDownCapture}
        onPointerMoveCapture={onPointerMoveCapture}
        onPointerUpCapture={onPointerUpCapture}
        onPointerCancelCapture={onPointerUpCapture}
        onPointerDown={startPan}
      >
        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-1 px-5 pt-6 pb-7">
          {bars.map((v, idx) => {
            const hPct = clamp(v / maxBar, 0, 1);
            const barCenter = (idx + 0.5) / bars.length;
            const inRange = barCenter >= leftPct && barCenter <= rightPct;
            const isThick = v >= thickCutoff;
            return (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                className={cn(
                  "w-full",
                  inRange
                    ? isThick
                      ? "bg-green/30"
                      : "bg-green/20"
                    : isThick
                      ? "bg-white/18"
                      : "bg-white/10",
                )}
                style={{ height: `${Math.round(hPct * 100)}%` }}
              />
            );
          })}
        </div>

        {/* Range overlay */}
        <div
          className="border-green bg-green/15 absolute top-6 bottom-7 cursor-grab border-x-[1.5] active:cursor-grabbing"
          style={{
            left: `${leftPct * 100}%`,
            width: `${Math.max(0, (rightPct - leftPct) * 100)}%`,
          }}
          onPointerDown={startSelectionPan}
        />

        {/* Current price marker */}
        <div
          className="pointer-events-none absolute top-6 bottom-7 w-px border-l-2 border-dashed border-white"
          style={{ left: `${currentPct * 100}%` }}
        />
        <div
          className={cn(
            text.b4(),
            "pointer-events-none absolute top-0 -translate-x-1/2 text-white",
          )}
          style={{ left: `${currentPct * 100}%` }}
        >
          {formatPriceInput(currentPrice, 6)}
        </div>

        {/* Handles */}
        <div
          className="absolute top-6 bottom-7 flex w-5 -translate-x-1/2 items-center justify-center"
          style={{ left: `${leftPct * 100}%` }}
          onPointerDown={(e) => startDrag("min", e)}
          role="button"
          aria-label="Adjust minimum price"
          tabIndex={0}
        >
          <div className="bg-green flex h-10 w-4 items-center justify-center rounded-full text-black">
            <div className="flex flex-col gap-0.5">
              <span className="h-1 w-1 rounded-full bg-black/80" />
              <span className="h-1 w-1 rounded-full bg-black/80" />
              <span className="h-1 w-1 rounded-full bg-black/80" />
            </div>
          </div>
        </div>
        <div
          className="absolute top-6 bottom-7 flex w-5 -translate-x-1/2 items-center justify-center"
          style={{ left: `${rightPct * 100}%` }}
          onPointerDown={(e) => startDrag("max", e)}
          role="button"
          aria-label="Adjust maximum price"
          tabIndex={0}
        >
          <div className="bg-green flex h-10 w-4 items-center justify-center rounded-full text-black">
            <div className="flex flex-col gap-0.5">
              <span className="h-1 w-1 rounded-full bg-black/80" />
              <span className="h-1 w-1 rounded-full bg-black/80" />
              <span className="h-1 w-1 rounded-full bg-black/80" />
            </div>
          </div>
        </div>

        {/* Percent labels near handles */}
        {(() => {
          const minFlip = leftPct < 0.06;
          const maxFlip = rightPct > 0.94;
          return (
            <>
              <div
                className={cn(
                  text.sb3(),
                  "text-green pointer-events-none absolute top-1/2 -translate-y-1/2",
                  minFlip ? "translate-x-0 pl-4" : "-translate-x-full pr-4",
                )}
                style={{ left: `${leftPct * 100}%` }}
              >
                {formatPct(minDiffPct)}
              </div>
              <div
                className={cn(
                  text.sb3(),
                  "text-green pointer-events-none absolute top-1/2 -translate-y-1/2",
                  maxFlip ? "-translate-x-full pr-4" : "translate-x-0 pl-4",
                )}
                style={{ left: `${rightPct * 100}%` }}
              >
                {formatPct(maxDiffPct)}
              </div>
            </>
          );
        })()}

        {/* X-axis */}
        <div className="absolute inset-x-0 bottom-2 flex items-center justify-between px-5 text-[11px] whitespace-nowrap text-white/50 tabular-nums">
          {axisTicks.map((t) => (
            <span key={t} className="max-w-[25%] overflow-hidden text-ellipsis">
              {formatPriceInput(t, 6)}
            </span>
          ))}
        </div>
      </div>

      {/* Helps debug responsive sizing if needed */}
      {width === 0 ? null : null}
    </div>
  );
}
