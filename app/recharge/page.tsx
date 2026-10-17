"use client";

import { useEffect, useState } from "react";
import { Copy, LoaderCircle } from "lucide-react";

const packages = [
  { id: "11111111-1111-4111-8111-111111111111", amount: 100 },
  { id: "22222222-2222-4222-8222-222222222222", amount: 200 },
  { id: "33333333-3333-4333-8333-333333333333", amount: 300 },
  { id: "44444444-4444-4444-8444-444444444444", amount: 500 },
];

type Chain = "TRON" | "BSC";

export default function RechargePage() {
  const [chain, setChain] = useState<Chain>("TRON");
  const [packageId, setPackageId] = useState(packages[0].id);
  const [txHash, setTxHash] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = packages.find((item) => item.id === packageId)?.amount ?? 100;
  const wallet = chain === "TRON"
    ? process.env.NEXT_PUBLIC_TRON_USDT_ADDRESS ?? ""
    : process.env.NEXT_PUBLIC_BSC_USDT_ADDRESS ?? "";

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("package");
    if (id && packages.some((item) => item.id === id)) setPackageId(id);
  }, []);

  async function copyWallet() {
    if (!wallet) {
      setMessage("The deposit wallet has not been configured.");
      return;
    }
    await navigator.clipboard.writeText(wallet);
    setMessage("Wallet address copied.");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/verify-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain, packageId, txHash: txHash.trim() }),
      });
      const result: { error?: string; message?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Deposit verification failed.");
      setMessage(result.message ?? "Deposit verified and package activated.");
      setTxHash("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deposit verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-[#d5ad63]">USDT DEPOSIT</p>
      <h1 className="mt-2 text-3xl font-semibold">Recharge</h1>
      <p className="mt-2 text-sm text-white/55">Send the exact package amount, then submit its transaction hash.</p>
      <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
        <label className="block text-sm text-white/70" htmlFor="chain">Network</label>
        <select id="chain" value={chain} onChange={(event) => setChain(event.target.value as Chain)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#11141c] p-3">
          <option value="TRON">USDT · TRC-20</option>
          <option value="BSC">USDT · BEP-20</option>
        </select>
        <div className="mt-5 rounded-xl border border-dashed border-white/15 p-5 text-center">
          <div aria-label="QR code placeholder" className="mx-auto grid size-32 grid-cols-8 gap-1 rounded-lg bg-white p-2">
            {Array.from({ length: 64 }, (_, index) => (
              <span key={index} className={(index * 7 + index % 5) % 3 === 0 ? "rounded-sm bg-black" : "rounded-sm bg-white"} />
            ))}
          </div>
          <p className="mt-3 text-xs text-white/45">QR placeholder — verify the address below</p>
        </div>
        <label className="mt-5 block text-sm text-white/70" htmlFor="wallet">Master wallet address</label>
        <div className="mt-2 flex gap-2">
          <input id="wallet" readOnly value={wallet || "Configure NEXT_PUBLIC wallet address"} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#11141c] p-3 text-xs text-white/70" />
          <button type="button" onClick={copyWallet} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 text-sm hover:bg-white/5"><Copy size={16} />Copy</button>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm text-white/70" htmlFor="package">Package amount</label>
          <select id="package" value={packageId} onChange={(event) => setPackageId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#11141c] p-3">
            {packages.map((item) => <option key={item.id} value={item.id}>${item.amount} USDT</option>)}
          </select>
          <p className="text-xs text-white/45">Send exactly ${amount} USDT on {chain === "TRON" ? "TRC-20" : "BEP-20"}.</p>
          <label className="block text-sm text-white/70" htmlFor="txHash">Transaction hash</label>
          <input
            id="txHash"
            required
            autoComplete="off"
            maxLength={chain === "TRON" ? 64 : 66}
            minLength={64}
            pattern={chain === "TRON" ? "[A-Fa-f0-9]{64}" : "(0[xX])?[A-Fa-f0-9]{64}"}
            value={txHash}
            onChange={(event) => setTxHash(event.target.value)}
            placeholder={chain === "TRON" ? "64-character transaction ID" : "0x + 64 hexadecimal characters"}
            className="w-full rounded-xl border border-white/10 bg-[#11141c] p-3 font-mono text-sm"
          />
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d5ad63] px-4 py-3 font-semibold text-[#17130b] disabled:opacity-60">
            {busy && <LoaderCircle size={17} className="animate-spin" />}
            {busy ? "Verifying..." : "Verify deposit"}
          </button>
          {message && <p role="status" className="text-sm text-white/70">{message}</p>}
        </form>
      </div>
      <p className="mt-5 text-xs leading-5 text-white/40">
        Never send tokens over the wrong network. Deposit verification requires a signed-in account
        and confirmed on-chain transfer. Transactions cannot be reversed.
      </p>
    </div>
  );
}
