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

function defaultHistogram(count: number) {
  // deterministic-ish bell curve centered in the middle
  const mid = (count - 1) / 2;
  const sigma = count / 8;
  return Array.from({ length: count }, (_, i) => {
    const z = (i - mid) / sigma;
    const y = Math.exp(-(z * z) / 2);
    // add a tiny deterministic ripple so it doesn't look perfectly smooth
    const ripple = 0.06 * Math.sin(i * 1.7) + 0.04 * Math.cos(i * 0.9);
    return Math.max(0, y + ripple);
  });
}

export interface LiquidityRangeChartProps {
  currentPrice: number;
  minPrice: string;
  maxPrice: string;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  barCount?: number;
  domainPaddingPct?: number; // initial max % (e.g. 30 => +3000%)
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

  // "Price-anchored" synthetic liquidity so bars shift when viewport pans/zooms.
  // (Until you wire real tick/liquidity data.)
  const bars = useMemo(() => {
    const span = domain.max - domain.min;
    const base = Math.max(1e-9, currentPrice);
    return Array.from({ length: barCount }, (_, i) => {
      const price = domain.min + ((i + 0.5) / barCount) * span;
      const x = price / base; // price ratio vs current

      // Peaks around current price and a wider shoulder to mimic "liquidity walls".
      const z1 = (x - 1) / 0.06;
      const z2 = (x - 1) / 0.18;
      const peak = Math.exp(-(z1 * z1) / 2);
      const shoulder = 0.45 * Math.exp(-(z2 * z2) / 2);

      // Deterministic ripple based on price ratio so it is anchored to price.
      const ripple =
        0.12 * Math.sin(x * 13.7) +
        0.08 * Math.cos(x * 7.3) +
        0.05 * Math.sin(x * 31.1);

      return Math.max(0, peak + shoulder + ripple);
    });
  }, [barCount, currentPrice, domain.max, domain.min]);

  const maxBar = useMemo(() => Math.max(1e-9, ...bars), [bars]);

  // Keep selected min/max inside the viewport (so handles stay visible).
  useEffect(() => {
    const min = parsedMin ?? currentPrice * 0.95;
    const max = parsedMax ?? currentPrice * 1.05;
    const clampedMin = clamp(min, domain.min, domain.max);
    const clampedMax = clamp(max, domain.min, domain.max);

    if (Number.isFinite(clampedMin) && clampedMin !== min) {
      onMinPriceChange(formatPriceInput(clampedMin));
    }
    if (Number.isFinite(clampedMax) && clampedMax !== max) {
      onMaxPriceChange(formatPriceInput(clampedMax));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain.min, domain.max, currentPrice]);

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

  const toPct = (price: number) =>
    clamp((price - domain.min) / (domain.max - domain.min), 0, 1);
  const fromPct = (pct: number) => domain.min + pct * (domain.max - domain.min);

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
    const span = domain.max - domain.min;
    const center = (domain.max + domain.min) / 2;
    const nextSpan = clamp(span * mult, currentPrice * 1e-6, absMax - absMin);

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
    const startViewMin = domain.min;
    const startViewMax = domain.max;
    const startSelMin = parseNumberSafe(minPrice) ?? currentPrice * 0.95;
    const startSelMax = parseNumberSafe(maxPrice) ?? currentPrice * 1.05;

    setIsPanning(true);

    const update = (clientX: number) => {
      // If a second finger is added (pinch), stop panning updates.
      if (pointersRef.current.size >= 2) return;
      const dx = clientX - startX;
      const dp = rect.width === 0 ? 0 : dx / rect.width;
      const deltaPrice = dp * (startViewMax - startViewMin);

      let nextViewMin = startViewMin + deltaPrice;
      let nextViewMax = startViewMax + deltaPrice;
      let nextSelMin = startSelMin + deltaPrice;
      let nextSelMax = startSelMax + deltaPrice;

      if (nextViewMin < absMin) {
        const shift = absMin - nextViewMin;
        nextViewMin += shift;
        nextViewMax += shift;
        nextSelMin += shift;
        nextSelMax += shift;
      }
      if (nextViewMax > absMax) {
        const shift = absMax - nextViewMax;
        nextViewMin += shift;
        nextViewMax += shift;
        nextSelMin += shift;
        nextSelMax += shift;
      }

      setViewMin(nextViewMin);
      setViewMax(nextViewMax);
      onMinPriceChange(formatPriceInput(clamp(nextSelMin, absMin, absMax)));
      onMaxPriceChange(formatPriceInput(clamp(nextSelMax, absMin, absMax)));
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

  const onPointerDownCapture = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMoveCapture = (e: React.PointerEvent) => {
    const map = pointersRef.current;
    if (!map.has(e.pointerId)) return;
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
    if (pointersRef.current.size < 2) pinchRef.current = null;
  };

  const panByDeltaPixels = (deltaPixels: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dp = rect.width === 0 ? 0 : deltaPixels / rect.width;
    const deltaPrice = dp * (domain.max - domain.min);

    let nextViewMin = domain.min + deltaPrice;
    let nextViewMax = domain.max + deltaPrice;
    let nextSelMin =
      (parseNumberSafe(minPrice) ?? currentPrice * 0.95) + deltaPrice;
    let nextSelMax =
      (parseNumberSafe(maxPrice) ?? currentPrice * 1.05) + deltaPrice;

    if (nextViewMin < absMin) {
      const shift = absMin - nextViewMin;
      nextViewMin += shift;
      nextViewMax += shift;
      nextSelMin += shift;
      nextSelMax += shift;
    }
    if (nextViewMax > absMax) {
      const shift = absMax - nextViewMax;
      nextViewMin += shift;
      nextViewMax += shift;
      nextSelMin += shift;
      nextSelMax += shift;
    }

    setViewMin(nextViewMin);
    setViewMax(nextViewMax);
    onMinPriceChange(formatPriceInput(clamp(nextSelMin, absMin, absMax)));
    onMaxPriceChange(formatPriceInput(clamp(nextSelMax, absMin, absMax)));
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

      if (ev.ctrlKey) {
        zoomByWheel(ev.deltaY);
        return;
      }

      const delta = ev.deltaX !== 0 ? ev.deltaX : ev.deltaY;
      panByDeltaPixels(delta);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain.min, domain.max, minPrice, maxPrice, absMax, currentPrice]);

  const axisTicks = useMemo(() => {
    const ticks = 4;
    const arr: number[] = [];
    for (let i = 0; i < ticks; i++) {
      arr.push(domain.min + (i / (ticks - 1)) * (domain.max - domain.min));
    }
    return arr;
  }, [domain.max, domain.min]);

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
            return (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                className={cn(
                  "w-full",
                  inRange ? "bg-green/20" : "bg-white/10",
                )}
                style={{ height: `${Math.round(hPct * 100)}%` }}
              />
            );
          })}
        </div>

        {/* Range overlay */}
        <div
          className="border-green bg-green/15 pointer-events-none absolute top-6 bottom-7 border-x-[1.5]"
          style={{
            left: `${leftPct * 100}%`,
            width: `${Math.max(0, (rightPct - leftPct) * 100)}%`,
          }}
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
                  minFlip ? "translate-x-0 pl-2" : "-translate-x-full pr-2",
                )}
                style={{ left: `${leftPct * 100}%` }}
              >
                {formatPct(minDiffPct)}
              </div>
              <div
                className={cn(
                  text.sb3(),
                  "text-green pointer-events-none absolute top-1/2 -translate-y-1/2",
                  maxFlip ? "-translate-x-full pr-2" : "translate-x-0 pl-2",
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
