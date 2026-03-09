"use client";

import { useEffect, useState } from "react";
import DoxxIcon from "@/assets/icons/doxx-icon.svg";

export function MobileGuard({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");

    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    update(mq);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(true);

    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!checked) return null;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 bg-[#070707] px-8 text-center">
        <DoxxIcon className="h-6 w-auto" />

        <div className="flex flex-col items-center gap-3">
          <h1 className="font-plus-jakarta-sans text-2xl font-semibold text-[#F4F4F4]">
            Desktop Only
          </h1>
          <p className="font-plus-jakarta-sans max-w-xs text-sm leading-relaxed text-[#F4F4F4]/60">
            DoxX is currently only available on desktop. Please visit us on your
            desktop browser for the full experience.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-[#F4F4F4]/10 bg-[#F4F4F4]/5 px-4 py-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
          </span>
          <span className="font-plus-jakarta-sans text-xs text-[#F4F4F4]/50">
            Mobile support coming soon
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
