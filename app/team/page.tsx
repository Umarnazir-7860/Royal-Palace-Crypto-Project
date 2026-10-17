import { IntegrationNotice } from "@/app/components/integration-notice";

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm text-[#d5ad63]">REFERRAL NETWORK</p>
      <h1 className="mt-2 text-3xl font-semibold">Team</h1>
      <p className="mt-2 text-sm text-white/55">Your referral code and downline overview.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {["Level 1", "Level 2", "Level 3"].map((level) => (
          <div key={level} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm text-white/55">{level}</p>
            <p className="mt-2 text-xl font-semibold">—</p>
          </div>
        ))}
      </div>
      <IntegrationNotice
        title="Referral data is not connected"
        description="Every Supabase profile receives a unique referral code. The signup trigger maps direct and two-level-upline relationships, and verified investments create commission records atomically. Sign-in, referral-link sharing, and team metrics still need an authenticated dashboard integration."
      />
    </div>
  );
}
