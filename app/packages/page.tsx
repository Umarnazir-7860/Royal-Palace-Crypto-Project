import Link from "next/link";
import { Check, CircleDollarSign } from "lucide-react";

const packages = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Starter", amount: 100 },
  { id: "22222222-2222-4222-8222-222222222222", name: "Silver", amount: 200 },
  { id: "33333333-3333-4333-8333-333333333333", name: "Gold", amount: 300 },
  { id: "44444444-4444-4444-8444-444444444444", name: "Royal", amount: 500 },
];

export default function PackagesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm text-[#d5ad63]">INVESTMENT TIERS</p>
      <h1 className="mt-2 text-3xl font-semibold">Packages</h1>
      <p className="mt-2 text-sm text-white/55">Choose a fixed USDT package to continue to deposit verification.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {packages.map((item) => (
          <article key={item.id} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <CircleDollarSign className="text-[#d5ad63]" size={23} />
            <h2 className="mt-5 text-lg font-medium">{item.name}</h2>
            <p className="mt-2 text-3xl font-semibold">${item.amount}<span className="ml-2 text-sm font-normal text-white/50">USDT</span></p>
            <p className="mt-3 text-sm text-white/50">Fixed one-time package</p>
            <p className="mt-6 flex items-center gap-2 text-xs text-white/60">
              <Check size={15} className="text-[#d5ad63]" />
              Yield parameters configured by the platform
            </p>
            <Link
              href={`/recharge?package=${item.id}`}
              className="mt-7 rounded-xl bg-[#d5ad63] px-4 py-3 text-center text-sm font-semibold text-[#17130b] hover:bg-[#e1bf7b]"
            >
              Invest / Upgrade
            </Link>
          </article>
        ))}
      </div>
      <p className="mt-8 text-xs leading-5 text-white/40">
        Package selection is not a promise of profit. Confirm the network, token contract, and
        receiving address before sending funds.
      </p>
    </div>
  );
}
