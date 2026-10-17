import { IntegrationNotice } from "@/app/components/integration-notice";

const categories = ["Deposits", "Withdrawals", "Daily yields", "Referral commissions"];

export default function RecordsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm text-[#d5ad63]">ACCOUNT ACTIVITY</p>
      <h1 className="mt-2 text-3xl font-semibold">Records</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((category) => (
          <span key={category} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/65">{category}</span>
        ))}
      </div>
      <IntegrationNotice
        title="No live ledger is connected"
        description="Deposit, withdrawal, yield, and commission tables are prepared for user-scoped history queries. This screen does not fabricate or display account activity before an authenticated data feed is wired."
      />
    </div>
  );
}
