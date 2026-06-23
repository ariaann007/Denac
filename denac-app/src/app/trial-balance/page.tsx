"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type TBRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  debitBalance: number;
  creditBalance: number;
};

type TBData = {
  rows: TBRow[];
  totals: { totalDebit: number; totalCredit: number; debitBalance: number; creditBalance: number };
};

const SECTION_ORDER = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;

const SECTION_META: Record<string, { label: string; description: string; color: string; headerColor: string }> = {
  ASSET:     { label: "Assets",      description: "What the business owns or is owed",       color: "bg-blue-50",   headerColor: "bg-purple-600 text-white" },
  LIABILITY: { label: "Liabilities", description: "What the business owes to others",         color: "bg-red-50",    headerColor: "bg-purple-600 text-white" },
  EQUITY:    { label: "Equity",      description: "Owner's stake in the business",            color: "bg-amber-50",  headerColor: "bg-purple-600 text-white" },
  INCOME:    { label: "Income",      description: "Revenue earned from business activities",  color: "bg-green-50",  headerColor: "bg-purple-600 text-white" },
  EXPENSE:   { label: "Expenses",    description: "Costs incurred running the business",      color: "bg-orange-50", headerColor: "bg-purple-600 text-white" },
};

export default function TrialBalancePage() {
  const [data, setData] = useState<TBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showZero, setShowZero] = useState(false);

  useEffect(() => {
    fetch("/api/trial-balance")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => {
        console.error("Failed to load trial balance:", err);
        setLoading(false);
      });
  }, []);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  const fmtPlain = (n: number) =>
    n === 0 ? "" : new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2 }).format(n);

  if (loading) return <p className="text-gray-400 py-10 text-center">Loading trial balance…</p>;
  if (!data) return null;

  const balanced = Math.abs(data.totals.debitBalance - data.totals.creditBalance) < 0.01;

  // Group rows by type
  const grouped = SECTION_ORDER.reduce((acc, t) => {
    acc[t] = data.rows.filter((r) => r.type === t && (showZero || r.debitBalance > 0 || r.creditBalance > 0));
    return acc;
  }, {} as Record<string, TBRow[]>);

  // Subtotals per section
  const subtotal = (type: string) => ({
    dr: grouped[type].reduce((s, r) => s + r.debitBalance, 0),
    cr: grouped[type].reduce((s, r) => s + r.creditBalance, 0),
  });

  // Net Profit / Loss = Income - Expenses
  const totalIncome   = data.rows.filter((r) => r.type === "INCOME").reduce((s, r) => s + r.creditBalance - r.debitBalance, 0);
  const totalExpenses = data.rows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + r.debitBalance - r.creditBalance, 0);
  const netProfit = totalIncome - totalExpenses;

  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
        <Link href="/journal" className="hover:underline text-purple-600">Journal</Link>
        <span>/</span>
        <Link href="/ledger" className="hover:underline text-purple-600">Ledger</Link>
        <span>/</span>
        <span className="text-gray-600">Trial Balance</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Trial Balance</h1>
          <p className="text-gray-500 text-sm mt-1">As at {today}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            A trial balance lists every account and its balance to confirm that total debits equal total credits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showZero}
              onChange={(e) => setShowZero(e.target.checked)}
              className="rounded"
            />
            Show zero-balance accounts
          </label>
          <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${balanced ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {balanced ? "✓ Balanced" : "⚠ Out of Balance"}
          </span>
          <button
            onClick={() => window.print()}
            className="btn-secondary text-xs"
          >
            Print
          </button>
        </div>
      </div>

      {/* Main table */}
      <div className="bg-white rounded-xl shadow overflow-hidden print:shadow-none print:rounded-none">
        {/* Column headers */}
        <div className="grid grid-cols-12 bg-purple-700 text-white text-xs font-semibold uppercase px-4 py-2.5">
          <div className="col-span-1">Code</div>
          <div className="col-span-5">Account Name</div>
          <div className="col-span-3 text-right">Debit (Dr) £</div>
          <div className="col-span-3 text-right">Credit (Cr) £</div>
        </div>

        {SECTION_ORDER.map((type) => {
          const meta = SECTION_META[type];
          const rows = grouped[type];
          const sub  = subtotal(type);
          const hasRows = data.rows.filter((r) => r.type === type).length > 0;
          if (!hasRows) return null;

          return (
            <div key={type}>
              {/* Section header */}
              <div className={`grid grid-cols-12 px-4 py-2 text-xs font-bold uppercase tracking-wide ${meta.headerColor}`}>
                <div className="col-span-6">{meta.label}</div>
                <div className="col-span-6 text-right font-normal italic">{meta.description}</div>
              </div>

              {/* Account rows */}
              {rows.length === 0 ? (
                <div className={`px-4 py-2 text-xs text-gray-400 italic ${meta.color}`}>
                  No transactions recorded for this section yet.
                </div>
              ) : (
                rows.map((row) => (
                  <div
                    key={row.id}
                    className={`grid grid-cols-12 px-4 py-2 text-sm border-b border-gray-100 hover:bg-gray-50 transition-colors ${meta.color} hover:brightness-95`}
                  >
                    <div className="col-span-1 font-mono text-xs text-gray-500 self-center">{row.code}</div>
                    <div className="col-span-5 self-center">
                      <Link href={`/ledger/${row.id}`} className="text-purple-700 hover:underline font-medium">
                        {row.name}
                      </Link>
                    </div>
                    <div className="col-span-3 text-right font-mono self-center text-gray-800">
                      {fmtPlain(row.debitBalance)}
                    </div>
                    <div className="col-span-3 text-right font-mono self-center text-gray-800">
                      {fmtPlain(row.creditBalance)}
                    </div>
                  </div>
                ))
              )}

              {/* Section subtotal */}
              <div className={`grid grid-cols-12 px-4 py-2 text-xs font-semibold border-b-2 border-gray-300 ${meta.color}`}>
                <div className="col-span-6 uppercase text-gray-600">Total {meta.label}</div>
                <div className="col-span-3 text-right font-mono border-t border-gray-400 pt-0.5">
                  {sub.dr > 0 ? fmtPlain(sub.dr) : "—"}
                </div>
                <div className="col-span-3 text-right font-mono border-t border-gray-400 pt-0.5">
                  {sub.cr > 0 ? fmtPlain(sub.cr) : "—"}
                </div>
              </div>
            </div>
          );
        })}

        {/* Grand total */}
        <div className="grid grid-cols-12 px-4 py-3 bg-purple-700 text-white text-sm font-bold">
          <div className="col-span-6 uppercase tracking-wide">Grand Total</div>
          <div className="col-span-3 text-right font-mono">
            {new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2 }).format(data.totals.debitBalance)}
          </div>
          <div className="col-span-3 text-right font-mono">
            {new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2 }).format(data.totals.creditBalance)}
          </div>
        </div>

        {!balanced && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-xs font-medium">
            ⚠ Difference of {fmt(Math.abs(data.totals.debitBalance - data.totals.creditBalance))} — check your journal entries for missing or incorrect postings.
          </div>
        )}
      </div>

      {/* Net Profit / Loss summary */}
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        <SummaryCard
          label="Total Income"
          value={fmt(totalIncome)}
          color="text-green-700"
          note="Revenue earned"
        />
        <SummaryCard
          label="Total Expenses"
          value={fmt(totalExpenses)}
          color="text-red-700"
          note="Costs incurred"
        />
        <SummaryCard
          label={netProfit >= 0 ? "Net Profit" : "Net Loss"}
          value={fmt(Math.abs(netProfit))}
          color={netProfit >= 0 ? "text-indigo-700" : "text-red-700"}
          note={netProfit >= 0 ? "Income exceeds expenses" : "Expenses exceed income"}
          highlight
        />
      </div>

      {/* Legend */}
      <div className="mt-6 bg-white rounded-xl shadow p-4 text-xs text-gray-500">
        <p className="font-semibold text-gray-700 mb-2">How to read this trial balance</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Debit (Dr)</strong> — increases Assets and Expenses; decreases Liabilities, Equity, and Income.</li>
          <li><strong>Credit (Cr)</strong> — increases Liabilities, Equity, and Income; decreases Assets and Expenses.</li>
          <li>The <strong>Grand Total Dr must equal Grand Total Cr</strong>. If they differ, a journal entry is missing or incorrect.</li>
          <li>Click any account name to view its full <strong>transaction ledger</strong>.</li>
          <li><strong>Net Profit</strong> = Total Income − Total Expenses. A positive figure means the business is profitable.</li>
        </ul>
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, color, note, highlight,
}: {
  label: string; value: string; color: string; note: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl shadow p-4 ${highlight ? "bg-purple-700 text-white" : "bg-white"}`}>
      <p className={`text-xs uppercase tracking-wide mb-1 ${highlight ? "text-indigo-200" : "text-gray-500"}`}>{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-white" : color}`}>{value}</p>
      <p className={`text-xs mt-1 ${highlight ? "text-indigo-200" : "text-gray-400"}`}>{note}</p>
    </div>
  );
}
