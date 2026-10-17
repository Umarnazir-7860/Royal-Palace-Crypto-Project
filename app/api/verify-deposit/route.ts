import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Chain = "TRON" | "BSC";
type PackageRow = { id: string; amount_usd: string | number };
type VerifiedTransfer = { sender: string; recipient: string; token: string; amount: bigint; decimals: number };

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export async function POST(request: Request) {
  const supabase = await createAuthenticatedSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in before verifying a deposit." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isRecord(body) || !isChain(body.chain) || typeof body.packageId !== "string" || typeof body.txHash !== "string") {
    return NextResponse.json({ error: "Provide a supported network, package, and transaction hash." }, { status: 400 });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.packageId)) {
    return NextResponse.json({ error: "Package ID is invalid." }, { status: 400 });
  }

  const txHash = body.txHash.trim();
  const validHash = body.chain === "TRON"
    ? /^[a-fA-F0-9]{64}$/.test(txHash)
    : /^(0x)?[a-fA-F0-9]{64}$/i.test(txHash);
  if (!validHash) {
    return NextResponse.json({ error: "Transaction hash format is invalid for the selected network." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: packageRow, error: packageError } = await admin
    .from("packages")
    .select("id, amount_usd")
    .eq("id", body.packageId)
    .eq("is_active", true)
    .maybeSingle<PackageRow>();

  if (packageError) {
    console.error("Package lookup failed:", packageError.message);
    return NextResponse.json({ error: "Could not load the selected package." }, { status: 500 });
  }
  if (!packageRow) {
    return NextResponse.json({ error: "Selected package does not exist or is inactive." }, { status: 400 });
  }

  let transfer: VerifiedTransfer;
  try {
    transfer = body.chain === "TRON"
      ? await verifyTronTransfer(txHash)
      : await verifyBscTransfer(txHash);
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error("Blockchain provider error:", error.message);
      return NextResponse.json({ error: "Blockchain provider is temporarily unavailable. Please retry later." }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "Blockchain verification failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const expectedWallet = requiredEnv(body.chain === "TRON" ? "TRON_USDT_CONTRACT" : "BSC_USDT_CONTRACT");
  const expectedRecipient = requiredEnv(body.chain === "TRON" ? "NEXT_PUBLIC_TRON_USDT_ADDRESS" : "NEXT_PUBLIC_BSC_USDT_ADDRESS");
  const recipientMatches = body.chain === "TRON"
    ? normalizeTronAddress(transfer.recipient) === normalizeTronAddress(expectedRecipient)
    : normalizeEvmAddress(transfer.recipient) === normalizeEvmAddress(expectedRecipient);
  const tokenMatches = body.chain === "TRON"
    ? normalizeTronAddress(transfer.token) === normalizeTronAddress(expectedWallet)
    : normalizeEvmAddress(transfer.token) === normalizeEvmAddress(expectedWallet);
  const expectedUnits = toTokenUnits(packageRow.amount_usd, transfer.decimals);

  if (!recipientMatches || !tokenMatches || transfer.amount !== expectedUnits) {
    return NextResponse.json({ error: "Confirmed transfer does not match the configured USDT token, receiving wallet, and exact package amount." }, { status: 422 });
  }

  const { error: processError } = await admin.rpc("process_verified_deposit", {
    p_user_id: user.id,
    p_tx_hash: body.chain === "BSC" ? `0x${txHash.replace(/^0x/i, "").toLowerCase()}` : txHash.toLowerCase(),
    p_chain: body.chain,
    p_package_id: packageRow.id,
    p_amount_usd: String(packageRow.amount_usd),
    p_from_address: transfer.sender,
  });

  if (processError) {
    if (processError.message.includes("duplicate key") || processError.code === "23505") {
      return NextResponse.json({ error: "This transaction has already been used." }, { status: 409 });
    }
    console.error("Deposit processing failed:", processError.message);
    return NextResponse.json({ error: "Deposit was verified but could not be recorded. Contact support before retrying." }, { status: 500 });
  }

  return NextResponse.json({ message: "Deposit verified and package activated." });
}

async function verifyBscTransfer(txHash: string): Promise<VerifiedTransfer> {
  const apiKey = requiredEnv("BSC_API_KEY");
  const hash = `0x${txHash.replace(/^0x/i, "").toLowerCase()}`;
  const tokenContract = requiredEnv("BSC_USDT_CONTRACT");
  const [transaction, receipt, latestBlock, tokenDecimals] = await Promise.all([
    bscScanRequest("eth_getTransactionByHash", apiKey, { txhash: hash }),
    bscScanRequest("eth_getTransactionReceipt", apiKey, { txhash: hash }),
    bscScanRequest("eth_blockNumber", apiKey),
    bscScanRequest("eth_call", apiKey, { to: tokenContract, data: "0x313ce567", tag: "latest" }),
  ]);
  if (!isRecord(transaction) || !isRecord(receipt) || typeof latestBlock !== "string") {
    throw new Error("Transaction was not found or its receipt is not available yet.");
  }
  if (receipt.status !== "0x1" || typeof receipt.blockNumber !== "string") {
    throw new Error("Transaction has failed or is not mined.");
  }

  const confirmations = BigInt(latestBlock) - BigInt(receipt.blockNumber) + 1n;
  const minimum = BigInt(process.env.BSC_MIN_CONFIRMATIONS ?? "12");
  if (confirmations < minimum) throw new Error("Transaction has not reached the required confirmation depth.");
  if (typeof tokenDecimals !== "string" || !/^0x[0-9a-f]+$/i.test(tokenDecimals)) {
    throw new Error("Could not confirm the configured token decimals.");
  }
  const decimals = Number(BigInt(tokenDecimals));
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
    throw new Error("Configured token has unsupported decimals.");
  }

  const wallet = typeof process.env.NEXT_PUBLIC_BSC_USDT_ADDRESS === "string"
    ? normalizeEvmAddress(process.env.NEXT_PUBLIC_BSC_USDT_ADDRESS)
    : "";
  if (normalizeEvmAddress(String(transaction.to ?? "")) !== normalizeEvmAddress(tokenContract)) {
    throw new Error("Transaction did not call the configured BEP-20 USDT contract.");
  }

  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  const transfers = logs.filter((log): log is Record<string, unknown> =>
    isRecord(log) &&
    normalizeEvmAddress(String(log.address ?? "")) === normalizeEvmAddress(tokenContract) &&
    Array.isArray(log.topics) &&
    typeof log.topics[0] === "string" && log.topics[0].toLowerCase() === TRANSFER_TOPIC &&
    typeof log.topics[1] === "string" &&
    typeof log.topics[2] === "string" &&
    normalizeEvmAddress(`0x${String(log.topics[2]).slice(-40)}`) === wallet &&
    typeof log.data === "string" && /^0x[0-9a-f]+$/i.test(log.data),
  );
  if (transfers.length !== 1) throw new Error("Transaction must contain exactly one USDT transfer to the configured wallet.");

  const topics = transfers[0].topics as string[];
  return {
    sender: `0x${topics[1].slice(-40)}`,
    recipient: `0x${topics[2].slice(-40)}`,
    token: String(transfers[0].address),
    amount: BigInt(String(transfers[0].data)),
    decimals,
  };
}

async function bscScanRequest(action: string, apiKey: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", "56");
  url.searchParams.set("module", "proxy");
  url.searchParams.set("action", action);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("apikey", apiKey);
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new ProviderError("BscScan request failed.");
  }
  if (!response.ok) throw new Error("BscScan could not verify this transaction.");
  const payload: unknown = await response.json();
  if (!isRecord(payload) || ("status" in payload && payload.status === "0" && payload.message !== "No transactions found")) {
    throw new Error("BscScan rejected the verification request.");
  }
  if (!("result" in payload) || payload.result === null) throw new Error("Transaction data is not available.");
  return payload.result;
}

async function verifyTronTransfer(txHash: string): Promise<VerifiedTransfer> {
  const endpoint = new URL(`https://api.trongrid.io/v1/transactions/${txHash}/events`);
  endpoint.searchParams.set("only_confirmed", "true");
  endpoint.searchParams.set("limit", "200");
  const headers: HeadersInit = {};
  if (process.env.TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;
  let response: Response;
  try {
    response = await fetch(endpoint, { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new ProviderError("TronGrid request failed.");
  }
  if (!response.ok) throw new Error("TronGrid could not verify this transaction.");
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.data)) throw new Error("TronGrid returned an invalid response.");

  const contract = normalizeTronAddress(requiredEnv("TRON_USDT_CONTRACT"));
  const recipient = normalizeTronAddress(requiredEnv("NEXT_PUBLIC_TRON_USDT_ADDRESS"));
  const matches = payload.data.filter((event): event is Record<string, unknown> => {
    if (!isRecord(event) || event.event_name !== "Transfer" || !isRecord(event.result)) return false;
    const tokenInfo = isRecord(event.token_info) ? event.token_info : {};
    return normalizeTronAddress(String(tokenInfo.address ?? event.contract_address ?? "")) === contract &&
      normalizeTronAddress(String(event.result.to ?? "")) === recipient &&
      typeof event.result.from === "string" &&
      typeof event.result.value === "string" && /^\d+$/.test(event.result.value);
  });
  if (matches.length !== 1) throw new Error("No single confirmed USDT transfer to the configured TRON wallet was found.");
  const event = matches[0];
  const tokenInfo = event.token_info as Record<string, unknown>;
  const result = event.result as Record<string, unknown>;
  const decimals = Number(tokenInfo.decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
    throw new Error("Could not confirm the configured token decimals.");
  }
  return {
    sender: String(result.from),
    recipient: String(result.to),
    token: String(tokenInfo.address ?? event.contract_address),
    amount: BigInt(String(result.value)),
    decimals,
  };
}

function toTokenUnits(amount: string | number, decimals: number): bigint {
  const value = String(amount);
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error("Package amount is invalid.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error("Package amount has unsupported precision.");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

function normalizeEvmAddress(address: string): string {
  const normalized = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) throw new Error("Configured EVM wallet or token address is invalid.");
  return normalized;
}

function normalizeTronAddress(address: string): string {
  const normalized = address.trim();
  if (/^(0x)?41[a-fA-F0-9]{40}$/.test(normalized)) return normalized.replace(/^0x/i, "").toLowerCase();
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = 0n;
  for (const character of normalized) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error("Configured TRON address is invalid.");
    value = value * 58n + BigInt(digit);
  }
  let hex = value.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const leadingZeroes = normalized.match(/^1*/)?.[0].length ?? 0;
  const decoded = Buffer.concat([Buffer.alloc(leadingZeroes), Buffer.from(hex, "hex")]);
  if (decoded.length !== 25) throw new Error("Configured TRON address is invalid.");
  const payload = decoded.subarray(0, 21);
  const checksum = createHash("sha256").update(createHash("sha256").update(payload).digest()).digest().subarray(0, 4);
  if (!checksum.equals(decoded.subarray(21)) || payload[0] !== 0x41) throw new Error("Configured TRON address checksum is invalid.");
  return payload.toString("hex").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isChain(value: unknown): value is Chain {
  return value === "TRON" || value === "BSC";
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Server is missing required configuration: ${name}`);
  return value;
}

class ProviderError extends Error {}
