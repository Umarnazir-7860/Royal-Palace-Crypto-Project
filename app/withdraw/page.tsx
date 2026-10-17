import { IntegrationNotice } from "@/app/components/integration-notice";

export default function WithdrawPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm text-[#d5ad63]">PAYOUTS</p>
      <h1 className="mt-2 text-3xl font-semibold">Withdraw</h1>
      <p className="mt-2 text-sm text-white/55">Manage payout requests from your available balance.</p>
      <IntegrationNotice
        title="Withdrawal requests are not enabled"
        description="The database includes a withdrawal request table, but this scaffold does not reserve funds, check an authenticated balance, or process payouts. No withdrawal form is shown until those server-side controls are implemented."
      />
    </div>
  );
}
