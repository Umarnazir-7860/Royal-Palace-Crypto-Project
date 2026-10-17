import type { Metadata } from "next";
import Link from "next/link";
import { Coins, LayoutDashboard, Pickaxe, Users, Wallet } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Royal Place | USDT Staking",
  description: "Royal Place staking and account dashboard.",
};

const navigation = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/packages", label: "Packages", Icon: Coins },
  { href: "/recharge", label: "Recharge", Icon: Wallet },
  { href: "/mining", label: "Mining", Icon: Pickaxe },
  { href: "/team", label: "Team", Icon: Users },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen md:flex">
          <aside className="border-b border-white/10 bg-[#0d0f15] p-5 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
            <Link href="/" className="text-xl font-semibold tracking-wide">
              <span className="text-[#d5ad63]">ROYAL</span> PLACE
            </Link>
            <nav className="mt-8 flex gap-2 overflow-x-auto md:flex-col">
              {navigation.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white"
                >
                  <Icon size={17} />
                  {label}
                </Link>
              ))}
              <Link href="/withdraw" className="rounded-xl px-3 py-2.5 text-sm text-white/65 hover:bg-white/5">
                Withdraw
              </Link>
              <Link href="/records" className="rounded-xl px-3 py-2.5 text-sm text-white/65 hover:bg-white/5">
                Records
              </Link>
            </nav>
            <p className="mt-10 hidden text-xs leading-5 text-white/35 md:block">
              USDT transactions are irreversible. Verify the selected network and wallet before sending.
            </p>
          </aside>
          <main className="w-full flex-1 p-5 md:p-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
