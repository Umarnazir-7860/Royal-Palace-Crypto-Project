import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Coins, Pickaxe, Users } from "lucide-react";

const quickActions = [
  { href: "/recharge", label: "Recharge", Icon: ArrowDownToLine },
  { href: "/packages", label: "Explore packages", Icon: Coins },
  { href: "/withdraw", label: "Withdraw", Icon: ArrowUpFromLine },
  { href: "/mining", label: "Mining", Icon: Pickaxe },
  { href: "/team", label: "My team", Icon: Users },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm text-[#d5ad63]">ROYAL PLACE</p>
      <h1 className="mt-2 text-3xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-white/55">
        Your staking overview will appear here after you sign in.
      </p>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Available balance", "— USDT"],
          ["Active investment", "— USDT"],
          ["Daily yield", "— USDT"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-white/55">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-medium">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {quickActions.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm hover:border-[#d5ad63]/60">
              <Icon size={17} className="text-[#d5ad63]" />
              {label}
            </Link>
          ))}
        </div>
      </section>
      <p className="mt-10 max-w-3xl text-xs leading-5 text-white/40">
        Staking and digital-asset transfers carry risk. Any displayed yield is a configurable
        example, not a guarantee of future returns.
      </p>
    </div>
  );
}
