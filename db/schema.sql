create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  referral_code text not null unique,
  available_balance numeric(20, 6) not null default 0 check (available_balance >= 0),
  invested_balance numeric(20, 6) not null default 0 check (invested_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.packages (
  id uuid primary key,
  code text not null unique,
  name text not null,
  amount_usd numeric(12, 6) not null unique check (amount_usd > 0),
  daily_yield_percent numeric(7, 4) not null default 1 check (daily_yield_percent >= 0),
  level_1_commission_percent numeric(7, 4) not null default 5 check (level_1_commission_percent >= 0),
  level_2_commission_percent numeric(7, 4) not null default 2 check (level_2_commission_percent >= 0),
  level_3_commission_percent numeric(7, 4) not null default 1 check (level_3_commission_percent >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  package_id uuid not null references public.packages (id),
  deposit_id uuid not null unique,
  invested_amount numeric(20, 6) not null check (invested_amount > 0),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  package_id uuid not null references public.packages (id),
  chain text not null check (chain in ('TRON', 'BSC')),
  tx_hash text not null,
  from_address text,
  amount_usd numeric(20, 6) not null check (amount_usd > 0),
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'rejected')),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (chain, tx_hash)
);

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  chain text not null check (chain in ('TRON', 'BSC')),
  payout_address text not null,
  amount_usd numeric(20, 6) not null check (amount_usd > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  tx_hash text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.yield_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_package_id uuid not null references public.user_packages (id) on delete cascade,
  yield_date date not null,
  amount_usd numeric(20, 6) not null check (amount_usd >= 0),
  status text not null default 'pending' check (status in ('pending', 'credited', 'reversed')),
  created_at timestamptz not null default now(),
  unique (user_package_id, yield_date)
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  level smallint not null check (level between 1 and 3),
  created_at timestamptz not null default now(),
  unique (user_id, level),
  check (user_id <> referrer_id)
);

create table public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  deposit_id uuid not null references public.deposits (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  investor_id uuid not null references public.profiles (id) on delete cascade,
  level smallint not null check (level between 1 and 3),
  amount_usd numeric(20, 6) not null check (amount_usd > 0),
  created_at timestamptz not null default now(),
  unique (deposit_id, referrer_id, level)
);

create index referrals_referrer_level_idx on public.referrals (referrer_id, level);
create index user_packages_user_status_idx on public.user_packages (user_id, status);
create index deposits_user_created_idx on public.deposits (user_id, created_at desc);
create index withdrawals_user_created_idx on public.withdrawals (user_id, created_at desc);
create index yield_records_user_date_idx on public.yield_records (user_id, yield_date desc);
create index referral_commissions_referrer_created_idx on public.referral_commissions (referrer_id, created_at desc);

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_referral_code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  direct_referrer uuid;
begin
  if new.raw_user_meta_data ->> 'referral_code' is not null then
    select id into direct_referrer
    from public.profiles
    where referral_code = upper(trim(new.raw_user_meta_data ->> 'referral_code'));
  end if;

  insert into public.profiles (id, email, referral_code)
  values (new.id, new.email, new_referral_code);

  if direct_referrer is not null then
    insert into public.referrals (user_id, referrer_id, level)
    values (new.id, direct_referrer, 1);

    insert into public.referrals (user_id, referrer_id, level)
    select new.id, r.referrer_id, r.level + 1
    from public.referrals r
    where r.user_id = direct_referrer and r.level < 3
    on conflict (user_id, level) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.create_profile_for_auth_user();

create or replace function public.process_verified_deposit(
  p_user_id uuid,
  p_tx_hash text,
  p_chain text,
  p_package_id uuid,
  p_amount_usd numeric,
  p_from_address text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_package public.packages%rowtype;
  new_deposit_id uuid;
  referral_row record;
  commission_amount numeric(20, 6);
  commission_percent numeric(7, 4);
begin
  if p_chain not in ('TRON', 'BSC') then
    raise exception 'Unsupported chain';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Profile does not exist';
  end if;

  select * into selected_package
  from public.packages
  where id = p_package_id and is_active = true
  for share;

  if not found or selected_package.amount_usd <> p_amount_usd then
    raise exception 'Package amount does not match';
  end if;

  insert into public.deposits (user_id, package_id, chain, tx_hash, from_address, amount_usd, status)
  values (p_user_id, p_package_id, p_chain, lower(p_tx_hash), p_from_address, p_amount_usd, 'confirmed')
  returning id into new_deposit_id;

  insert into public.user_packages (user_id, package_id, deposit_id, invested_amount)
  values (p_user_id, p_package_id, new_deposit_id, p_amount_usd);

  update public.profiles
  set invested_balance = invested_balance + p_amount_usd, updated_at = now()
  where id = p_user_id;

  for referral_row in
    select r.referrer_id, r.level
    from public.referrals r
    where r.user_id = p_user_id and r.level between 1 and 3
  loop
    commission_percent := case referral_row.level
      when 1 then selected_package.level_1_commission_percent
      when 2 then selected_package.level_2_commission_percent
      else selected_package.level_3_commission_percent
    end;
    commission_amount := round(p_amount_usd * commission_percent / 100, 6);
    if commission_amount > 0 then
      insert into public.referral_commissions (deposit_id, referrer_id, investor_id, level, amount_usd)
      values (new_deposit_id, referral_row.referrer_id, p_user_id, referral_row.level, commission_amount);
      update public.profiles
      set available_balance = available_balance + commission_amount, updated_at = now()
      where id = referral_row.referrer_id;
    end if;
  end loop;

  return new_deposit_id;
end;
$$;

revoke all on function public.process_verified_deposit(uuid, text, text, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.process_verified_deposit(uuid, text, text, uuid, numeric, text) to service_role;

alter table public.profiles enable row level security;
alter table public.packages enable row level security;
alter table public.user_packages enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;
alter table public.yield_records enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_commissions enable row level security;

create policy "Profiles are readable by their owner"
on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users can view active packages"
on public.packages for select to authenticated using (is_active = true);
create policy "Users can view their package history"
on public.user_packages for select to authenticated using (auth.uid() = user_id);
create policy "Users can view their deposits"
on public.deposits for select to authenticated using (auth.uid() = user_id);
create policy "Users can view their withdrawals"
on public.withdrawals for select to authenticated using (auth.uid() = user_id);
create policy "Users can view their yield history"
on public.yield_records for select to authenticated using (auth.uid() = user_id);
create policy "Users can view their referral tree"
on public.referrals for select to authenticated using (auth.uid() = user_id or auth.uid() = referrer_id);
create policy "Users can view their referral commissions"
on public.referral_commissions for select to authenticated using (auth.uid() = referrer_id or auth.uid() = investor_id);

insert into public.packages (
  id, code, name, amount_usd, daily_yield_percent,
  level_1_commission_percent, level_2_commission_percent, level_3_commission_percent
) values
  ('11111111-1111-4111-8111-111111111111', 'starter-100', 'Starter', 100, 1, 5, 2, 1),
  ('22222222-2222-4222-8222-222222222222', 'silver-200', 'Silver', 200, 1, 5, 2, 1),
  ('33333333-3333-4333-8333-333333333333', 'gold-300', 'Gold', 300, 1, 5, 2, 1),
  ('44444444-4444-4444-8444-444444444444', 'royal-500', 'Royal', 500, 1, 5, 2, 1)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  amount_usd = excluded.amount_usd,
  daily_yield_percent = excluded.daily_yield_percent,
  level_1_commission_percent = excluded.level_1_commission_percent,
  level_2_commission_percent = excluded.level_2_commission_percent,
  level_3_commission_percent = excluded.level_3_commission_percent;
