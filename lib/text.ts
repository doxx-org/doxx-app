// utils/text.ts
import { cva } from "class-variance-authority";
import { toast } from "sonner";

export const text = {
  h1: cva("text-[32px] leading-none font-bold font-plus-jakarta-sans"),
  h2: cva("text-[24px] leading-none font-bold font-plus-jakarta-sans"),
  h3: cva("text-[20px] leading-none font-bold font-plus-jakarta-sans"),
  sh1: cva("text-[24px] leading-none font-medium font-plus-jakarta-sans"),
  sh2: cva("text-[20px] leading-none font-medium font-plus-jakarta-sans"),
  b1: cva("text-[20px] leading-none font-medium font-plus-jakarta-sans"),
  b2: cva("text-[16px] leading-none font-medium font-plus-jakarta-sans"),
  b3: cva("text-[14px] leading-none font-medium font-plus-jakarta-sans"),
  b4: cva("text-[12px] leading-none font-medium font-plus-jakarta-sans"),
  sb1: cva("text-[16px] leading-none font-normal font-roboto-mono"),
  sb2: cva("text-[14px] leading-none font-normal font-roboto-mono"),
  sb3: cva("text-[12px] leading-none font-normal font-roboto-mono"),
  sb4: cva("text-[10px] leading-none font-normal font-roboto-mono"),
  sb5: cva("text-[8px] leading-none font-normal font-roboto-mono"),
  sbx1: cva("text-[16px] leading-none font-medium font-roboto-mono"),
  sbx2: cva("text-[14px] leading-none font-medium font-roboto-mono"),
  sbx3: cva("text-[12px] leading-none font-medium font-roboto-mono"),
  r3: cva("text-[12px] leading-none font-normal font-plus-jakarta-sans"),
  r4: cva("text-[10px] leading-none font-normal font-plus-jakarta-sans"),
  hsb1: cva("text-[16px] leading-none font-semibold font-plus-jakarta-sans"),
  hsb2: cva("text-[14px] leading-none font-semibold font-plus-jakarta-sans"),
  hsb3: cva("text-[12px] leading-none font-semibold font-plus-jakarta-sans"),
  it1: cva("text-[24px] leading-none font-medium font-poltawski-nowy italic"),
  it2: cva("text-[16px] leading-none font-medium font-poltawski-nowy italic"),
};

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}
