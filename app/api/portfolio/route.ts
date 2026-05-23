import { NextResponse } from "next/server";
import crypto from "crypto";

const KSEI_BASE = "https://akses.ksei.co.id";

let cachedKseiToken: string | null = null;

async function kseiLogin(): Promise<string> {
  console.log("🔒 KSEI: Token mati atau kosong. Menjalankan flow login baru...");
  const email = process.env.KSEI_EMAIL;
  const password = process.env.KSEI_PASSWORD;
  if (!email || !password) throw new Error("KSEI credentials not set in .env");

  const timestamp = Math.floor(Date.now() / 1000);
  const sha1Pass = crypto.createHash("sha1").update(password).digest("hex");
  const paramRaw = `${sha1Pass}@@!!@@${timestamp}`;
  const param = Buffer.from(paramRaw).toString("base64");

  const genRes = await fetch(`${KSEI_BASE}/service/activation/generated?param=${encodeURIComponent(param)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: `${KSEI_BASE}/login`,
    },
    cache: "no-store",
  });

  if (!genRes.ok) throw new Error(`KSEI activation HTTP ${genRes.status}`);
  const genData = await genRes.json();
  const encPass: string | undefined = genData?.data?.[0]?.pass;
  if (!encPass) throw new Error("KSEI: encrypted password not returned");

  const loginRes = await fetch(`${KSEI_BASE}/service/login?lang=en`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: `${KSEI_BASE}/login`,
    },
    body: JSON.stringify({ username: email, password: encPass, appType: "web", id: "1" }),
    cache: "no-store",
  });

  if (!loginRes.ok) throw new Error(`KSEI login HTTP ${loginRes.status}`);
  const loginData = await loginRes.json();
  const token: string | undefined = loginData?.validation;
  if (!token) throw new Error("KSEI: no JWT returned from login");

  return token;
}

async function fetchSummaryWithDates(token: string) {
  const candidates = [0, 1, 2].map((daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  });

  for (const tanggal of candidates) {
    const res = await fetch(`${KSEI_BASE}/service/myportofolio/summary?type=&tanggal=${tanggal}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) return { status: "AUTH_ERROR", data: null };
    if (res.ok) {
      const data = await res.json();
      if (data.summaryValue !== undefined) return { status: "SUCCESS", data };
    }
  }
  return { status: "FAILED", data: null };
}

async function fetchEquityWithDates(token: string) {
  const candidates = [0, 1, 2].map((daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  });

  for (const date of candidates) {
    const res = await fetch(`${KSEI_BASE}/service/myportofolio/equity?date=${date}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) return { status: "AUTH_ERROR", data: null };
    if (res.ok) {
      const data = await res.json();
      if (data.listData !== undefined) return { status: "SUCCESS", data };
    }
  }
  return { status: "FAILED", data: null };
}

async function getKseiAllData() {
  if (!cachedKseiToken) {
    cachedKseiToken = await kseiLogin();
  }

  console.log("➡️ KSEI: Mencoba mengambil semua data menggunakan token di memori...");
  let summaryRes = await fetchSummaryWithDates(cachedKseiToken);
  let equityRes = await fetchEquityWithDates(cachedKseiToken);

  if (summaryRes.status === "AUTH_ERROR" || equityRes.status === "AUTH_ERROR") {
    console.log("🔄 KSEI: Token terdeteksi kadaluwarsa (403/401). Login ulang...");
    cachedKseiToken = await kseiLogin();
    summaryRes = await fetchSummaryWithDates(cachedKseiToken);
    equityRes = await fetchEquityWithDates(cachedKseiToken);
  }

  return {
    summary: summaryRes.status === "SUCCESS" ? summaryRes.data : null,
    equity: equityRes.status === "SUCCESS" ? equityRes.data : null,
  };
}

// ─────────────────────────────────────────────
// Indodax (Tetap sama tanpa perubahan)
// ─────────────────────────────────────────────

async function getIndodaxPortfolio() {
  const apiKey = process.env.INDODAX_API_KEY;
  const secret = process.env.INDODAX_SECRET;
  if (!apiKey || !secret) throw new Error("Indodax credentials not set in .env");

  const nonce = Date.now().toString();
  const body = `method=getInfo&nonce=${nonce}`;
  const sign = crypto.createHmac("sha512", secret).update(body).digest("hex");

  const res = await fetch("https://indodax.com/tapi", {
    method: "POST",
    headers: { Key: apiKey, Sign: sign, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const data = await res.json();
  if (!data.success) throw new Error(`Indodax API error: ${data.error ?? "unknown"}`);

  const balances: Record<string, string> = data.return?.balance ?? {};
  const nonZero = Object.entries(balances).filter(([, v]) => parseFloat(v) > 0);
  if (nonZero.length === 0) return { total: 0, breakdown: [] };

  const summRes = await fetch("https://indodax.com/api/summaries", { cache: "no-store" });
  const summData = await summRes.json();
  const tickers: Record<string, { last: string }> = summData.tickers ?? {};

  let total = 0;
  const breakdown: any[] = [];

  for (const [currency, amtStr] of nonZero) {
    const amount = parseFloat(amtStr);
    if (currency === "idr") {
      total += amount;
      breakdown.push({ currency: "IDR", amount, idrValue: amount });
      continue;
    }
    const pairKey = `${currency}_idr`;
    const ticker = tickers[pairKey];
    if (ticker) {
      const price = parseFloat(ticker.last);
      const idrValue = amount * price;
      total += idrValue;
      breakdown.push({ currency: currency.toUpperCase(), amount, idrValue, price });
    } else {
      breakdown.push({ currency: currency.toUpperCase(), amount, idrValue: 0 });
    }
  }
  return { total, breakdown };
}

// ─────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────

export async function GET() {
  const [kseiResult, indodaxResult] = await Promise.allSettled([
    getKseiAllData(),
    getIndodaxPortfolio(),
  ]);

  const kseiAll = kseiResult.status === "fulfilled" ? kseiResult.value : null;
  const indodaxData = indodaxResult.status === "fulfilled" ? indodaxResult.value : null;

  const kseiData = kseiAll?.summary;
  const kseiEquityData = kseiAll?.equity;

  const allowedKseiTypes = ["EKUITAS", "REKSADANA"];
  const filteredKseiItems = kseiData?.summaryResponse?.filter((item: any) =>
    allowedKseiTypes.includes(item.type)
  ) || [];

  const kseiTotal = filteredKseiItems.reduce((acc: number, item: any) => acc + item.summaryAmount, 0);
  const indodaxTotal = indodaxData?.total ?? 0;
  const grandTotal = kseiTotal + indodaxTotal;

  const segments: any[] = [];
  const typeTranslation: Record<string, string> = { EKUITAS: "Equity", REKSADANA: "Mutual Fund" };

  for (const item of filteredKseiItems) {
    if (item.summaryAmount > 0) {
      segments.push({
        name: typeTranslation[item.type] || item.type,
        value: item.summaryAmount,
        share: grandTotal > 0 ? (item.summaryAmount / grandTotal) * 100 : 0,
        source: "KSEI",
      });
    }
  }

  if (indodaxTotal > 0) {
    segments.push({
      name: "Crypto",
      value: indodaxTotal,
      share: grandTotal > 0 ? (indodaxTotal / grandTotal) * 100 : 0,
      source: "Indodax",
    });
  }

  // Pemetaan detail asset Saham (Equity Breakdown)
  const equityBreakdown: any[] = [];
  if (kseiEquityData?.listData) {
    for (const item of kseiEquityData.listData) {
      equityBreakdown.push({
        ticker: item.codeBaseSec,
        companyName: item.secDesc,
        shares: item.jmlLembar,
        lots: item.jmlLembar / 100,
        price: item.harga,
        idrValue: item.amountBalance,
      });
    }
  }

  const response = {
    grandTotal,
    kseiTotal,
    indodaxTotal,
    segments,
    equityBreakdown,
    indodaxBreakdown: indodaxData?.breakdown ?? [],
    errors: {
      ksei: kseiResult.status === "rejected" ? String(kseiResult.reason) : (kseiAll?.summary ? null : "Gagal memuat beberapa data KSEI"),
      indodax: indodaxResult.status === "rejected" ? String(indodaxResult.reason) : null,
    },
    lastUpdated: new Date().toISOString(),
  };

  return NextResponse.json(response);
}