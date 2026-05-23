"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Segment {
  name: string;
  value: number;
  share: number;
  source: string;
}

interface EquityBreakdown {
  ticker: string;
  companyName: string;
  shares: number;
  lots: number;
  price: number;
  idrValue: number;
}

interface IndodaxBreakdown {
  currency: string;
  amount: number;
  idrValue: number;
  price?: number;
}

interface PortfolioData {
  grandTotal: number;
  kseiTotal: number;
  indodaxTotal: number;
  segments: Segment[];
  equityBreakdown: EquityBreakdown[];
  indodaxBreakdown: IndodaxBreakdown[];
  errors: { ksei: string | null; indodax: string | null };
  lastUpdated: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENT_COLORS: Record<string, string> = {
  "Equity": "#2563EB",
  "Mutual Fund": "#059669",
  "Crypto": "#EA580C",
  "Obligasi": "#7C3AED",
  "Lainnya": "#64748B",
};

const DEFAULT_COLOR = "#94A3B8";

function colorOf(name: string) {
  return SEGMENT_COLORS[name] ?? DEFAULT_COLOR;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatIDR(value: number, compact = false) {
  if (compact && value >= 1_000_000) {
    return (
      "Rp " +
      new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 1,
      }).format(value / 1_000_000) +
      " jt"
    );
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(n: number) {
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(4);
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 6 }).format(n);
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
      <span className="mt-0.5">⚠️</span>
      <span>{message}</span>
    </div>
  );
}

function PieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) {
  if (!percent || percent < 0.01) return null;
  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={700}
    >
      {(percent * 100).toFixed(1)}%
    </text>
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-slate-800">{name}</p>
      <p className="text-slate-600">{formatIDR(value)}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false); // <── Tambah state baru
  const router = useRouter(); // <── Panggil router

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Fungsi Logout ──
  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh(); // Memicu middleware buat nge-blokir akses
      }
    } catch (e) {
      console.error("Gagal logout:", e);
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <main className="min-h-screen py-10 px-4 bg-slate-50">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        {/* ── Bagian Header (Ganti dengan ini) ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Portfolio Summary</h1>
            {data && <p className="text-xs text-slate-400 mt-0.5">{formatDate(data.lastUpdated)}</p>}
          </div>
          
          {/* Kelompok Tombol Aksi */}
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading || logoutLoading}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3.5 py-2 rounded-lg transition-colors"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>↻ <span className="hidden md:inline">Refresh</span></>
              )}
            </button>

            <button
              onClick={handleLogout}
              disabled={loading || logoutLoading}
              className="text-sm font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-50 px-3.5 py-2 rounded-lg transition-colors"
            >
              {logoutLoading ? "Leaving…" : "Logout"}
            </button>
          </div>
        </div>
        {/* ── Akhir Header ── */}

        {fetchError && <ErrorBanner message={fetchError} />}

        {loading && !data && (
          <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center gap-3">
            <Spinner />
            <p className="text-slate-500 text-sm">Fetching portfolio data…</p>
          </div>
        )}

        {data && (
          <>
            {data.errors.ksei && <ErrorBanner message={`KSEI: ${data.errors.ksei}`} />}
            {data.errors.indodax && <ErrorBanner message={`Indodax: ${data.errors.indodax}`} />}

            {/* Total card */}
            <div className="bg-white rounded-2xl shadow-sm px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Total Assets</p>
              <p className="text-3xl font-bold text-slate-900">{formatIDR(data.grandTotal)}</p>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                {data.kseiTotal > 0 && (
                  <span>KSEI <span className="font-medium text-slate-700">{formatIDR(data.kseiTotal)}</span></span>
                )}
                {data.indodaxTotal > 0 && (
                  <span>Indodax <span className="font-medium text-slate-700">{formatIDR(data.indodaxTotal)}</span></span>
                )}
              </div>
            </div>

            {/* Pie chart */}
            {data.segments.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Asset Allocation</p>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={data.segments}
                      cx="50%"
                      cy="50%"
                      outerRadius={105}
                      dataKey="value"
                      nameKey="name"
                      labelLine={false}
                      label={(props: any) => <PieLabel {...props} />}
                    >
                      {data.segments.map((seg) => (
                        <Cell key={seg.name} fill={colorOf(seg.name)} stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="mt-4 divide-y divide-slate-50">
                  {[...data.segments]
                    .sort((a, b) => b.value - a.value)
                    .map((seg) => (
                      <div key={seg.name} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorOf(seg.name) }} />
                          <div>
                            <span className="text-sm font-medium text-slate-800">{seg.name}</span>
                            <span className="ml-1.5 text-xs text-slate-400">{seg.source}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatIDR(seg.value)}</p>
                          <p className="text-xs text-slate-400">{seg.share.toFixed(2)}%</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ── Equity breakdown ── */}
            {data.equityBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Equity</p>
                <div className="divide-y divide-slate-50">
                  {[...data.equityBreakdown]
                    .sort((a, b) => b.idrValue - a.idrValue)
                    .map((item) => (
                      <div key={item.ticker} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{item.ticker}</p>
                          <p className="text-xs text-slate-400">
                            {formatAmount(item.lots)} lot
                            {item.price ? ` · @${formatIDR(item.price)}` : ""}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{formatIDR(item.idrValue)}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Crypto breakdown */}
            {data.indodaxBreakdown.some((b) => b.idrValue > 0) && (
              <div className="bg-white rounded-2xl shadow-sm px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Crypto</p>
                <div className="divide-y divide-slate-50">
                  {[...data.indodaxBreakdown]
                    .filter((b) => b.idrValue > 0)
                    .sort((a, b) => b.idrValue - a.idrValue)
                    .map((item) => (
                      <div key={item.currency} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{item.currency}</p>
                          <p className="text-xs text-slate-400">
                            {formatAmount(item.amount)}
                            {item.price ? ` · @${formatIDR(item.price)}` : ""}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{formatIDR(item.idrValue)}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}