# Royal Place MVP

Vercel-ready Next.js App Router scaffold for Supabase-backed USDT package deposits. The included deposit endpoint verifies confirmed USDT transfers on TRON (TRC-20) or BNB Smart Chain (BEP-20) before atomically activating a package and creating referral commissions.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase project, service role key, official USDT contracts, deposit addresses, BscScan API key, and (optionally) TronGrid API key.
3. Run `db/schema.sql` in the Supabase SQL Editor.
4. Configure Supabase Auth sign-in and use the profile trigger. Sign-up metadata may contain `referral_code` to attach the new user to a referrer.
5. Run `npm run dev`.

Never expose `SUPABASE_SERVICE_ROLE_KEY`, BscScan keys, or other server secrets with a `NEXT_PUBLIC_` prefix. The server endpoint authenticates the current Supabase session; an auth UI is intentionally left to the integrating project.

## Included app structure

```text
app/
  api/verify-deposit/route.ts  Authenticated chain verification and atomic activation
  mining/page.tsx              Yield engine integration notice
  packages/page.tsx            Fixed $100 / $200 / $300 / $500 package catalog
  recharge/page.tsx            Network, wallet, package, and transaction-hash form
  records/page.tsx              Account ledger integration notice
  team/page.tsx                 Referral dashboard integration notice
  withdraw/page.tsx             Safe withdrawal integration notice
  layout.tsx
  page.tsx                     Dashboard shell and quick actions
db/
  schema.sql                   Tables, RLS, referral signup trigger, deposit RPC, package seeds
lib/
  supabase/server.ts           Session and server-only admin clients
```

Mining, withdrawals, record, and team routes are present as explicit integration notices, not working account-data features. The database tables and user-scoped RLS policies are included. `yield_records` supports a daily-yield ledger, but this scaffold intentionally does not accrue yield or move funds.

## Configuration and trust assumptions

- Replace the example environment values with verified, official token contract addresses and wallets. Never use a wallet address from the browser as the verification source of truth.
- BSC confirmation depth defaults to 12 blocks; tune `BSC_MIN_CONFIRMATIONS` for the deployment's risk tolerance.
- The SQL package seeds use a **1% daily yield example** and referral commissions of **5% / 2% / 1%**. These are configurable product values, not guaranteed returns. Review legal, regulatory, accounting, and operational requirements before accepting funds.
- This scaffold does not accrue daily yield or process withdrawals. Those require auditable, idempotent scheduled/approval logic; do not credit yield from a client-side countdown.
- The included QR block is explicitly a visual placeholder, not a scannable payment QR.
- For production, independently audit provider API behavior, add rate limiting and monitoring, and consider direct node/RPC providers for stronger verification guarantees.
