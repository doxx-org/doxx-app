"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  switchText = "LITE",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & { switchText?: string }) {
  return (
    <SwitchPrimitive.Root
      data-slot='switch'
      className={cn(
        "relative w-18 p-2 rounded-full border-2 border-green-400 bg-gradient-to-r from-neutral-800 via-neutral-800 to-green-900 transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 flex items-center",
        className
      )}
      {...props}
    >
      {/* Thumb */}
      <SwitchPrimitive.Thumb
        data-slot='switch-thumb'
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow transition-transform duration-300 data-[state=checked]:translate-x-[4.7rem]"
        )}
      />
      {/* Text aligned right */}
      <span className='absolute right-6 top-1/2 -translate-y-1/2 text-hsb2 select-none pointer-events-none z-10'>
        {switchText}
      </span>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
