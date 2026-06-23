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

const TYPE_COLORS: Record<string, string> = {
  ASSET: "bg-blue-50",
  LIABILITY: "bg-red-50",
  EQUITY: "bg-purple-50",
  INCOME: "bg-green-50",
  EXPENSE: "bg-orange-50",
};

export default function TrialBalancePage() {
  const [data, setData] = useState<TBData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trial-balance")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  const fmt = (n: number) =>
    n === 0 ? "" : new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2 }).format(n);

  const balanced =
    data && Math.abs(data.totals.debitBalance - data.totals.creditBalance) < 0.001;

  if (loading) return <p className="text-gray-400">Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Trial Balance</h1>
        {data && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${balanced ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {balanced ? "✓ Balanced" : "⚠ Out of balance"}
          </span>
        )}
      </div>

      {data && data.rows.length === 0 ? (
        <p className="text-gray-400">No accounts with transactions yet.</p>
      ) : data ? (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Account</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-right">Debit (Dr)</th>
                <th className="px-4 py-2 text-right">Credit (Cr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.rows.map((row) => (
                <tr key={row.id} className={`hover:bg-gray-50 ${TYPE_COLORS[row.type] || ""}`}>
                  <td className="px-4 py-2 font-mono text-xs">{row.code}</td>
                  <td className="px-4 py-2">
                    <Link href={`/ledger/${row.id}`} className="text-indigo-700 hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{row.type}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(row.debitBalance)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(row.creditBalance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
              <tr>
                <td colSpan={3} className="px-4 py-2 text-xs uppercase text-gray-600">Total</td>
                <td className="px-4 py-2 text-right font-mono">
                  {new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2 }).format(data.totals.debitBalance)}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2 }).format(data.totals.creditBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}

      {!balanced && data && (
        <p className="mt-4 text-red-600 text-sm">
          Difference: {Math.abs(data.totals.debitBalance - data.totals.creditBalance).toFixed(2)} — check your journal entries.
        </p>
      )}
    </div>
  );
}
