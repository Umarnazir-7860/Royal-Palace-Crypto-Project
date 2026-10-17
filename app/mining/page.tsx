import { IntegrationNotice } from "@/app/components/integration-notice";

export default function MiningPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm text-[#d5ad63]">YIELD ENGINE</p>
      <h1 className="mt-2 text-3xl font-semibold">Mining</h1>
      <p className="mt-2 text-sm text-white/55">Active package yield overview.</p>
      <IntegrationNotice
        title="Live accrual is not enabled"
        description="Package yield percentages are configurable in Supabase, but no scheduled yield-crediting job or real-time account feed is included. A countdown must never be treated as a credited or guaranteed balance."
      />
    </div>
  );
}
