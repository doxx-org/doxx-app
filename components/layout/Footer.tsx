import Link from "next/link";
import X from "@/assets/icons/socials/x.svg";
import Discord from "@/assets/icons/socials/discord.svg";
import { text } from "@/lib/text";
import { cn } from "@/lib/utils";

export function Footer() {
  const navigation = [
    { name: "Security", href: "/" },
    { name: "Terms", href: "/" },
    { name: "Privacy", href: "/" },
    { name: "Docs", href: "/" },
  ];

  return (
    <footer className='bg-background w-full'>
      <div className='mx-auto px-8 py-4 w-full'>
        <div className='flex items-center justify-between'>
          <div className={cn(text.sb2(), "flex items-center text-gray-700")}>DoxX Exchange</div>
          <div className='flex items-center gap-8'>
            {navigation.map((item) => (
              <Link key={item.name} href={item.href} className={cn(text.sb3(), "text-gray-700")}>
                {item.name}
              </Link>
            ))}
            <Link href='https://x.com/doxx_exchange' target='_blank'>
              <X />
            </Link>
            <Link href='https://discord.gg/doxx' target='_blank'>
              <Discord />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
