"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils/index";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        text.b4(),
        "bg-black-900 flex w-fit items-center justify-center gap-2 rounded-lg text-gray-500",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-black-900 flex items-center justify-center px-2 py-3.5 whitespace-nowrap text-gray-500 transition-[color,box-shadow] hover:cursor-pointer hover:bg-gray-800 hover:text-gray-400 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-b data-[state=active]:border-white data-[state=active]:text-white",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
