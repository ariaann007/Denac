"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";

type LedgerRow = {
  id: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

type Account = { id: string; code: string; name: string; type: string; subtype: string | null };

type LedgerData = {
  account: Account;
  rows: LedgerRow[];
  closingBalance: number;
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  ASSET:     "Asset account — normally carries a Debit balance",
  LIABILITY: "Liability account — normally carries a Credit balance",
  EQUITY:    "Equity account — normally carries a Credit balance",
  INCOME:    "Income account — normally carries a Credit balance",
  EXPENSE:   "Expense account — normally carries a Debit balance",
};

export default function LedgerPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = use(params);
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/ledger/${accountId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => {
        console.error("Failed to load ledger:", err);
        setLoading(false);
      });
  }, [accountId]);

  const fmtCcy = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Math.abs(n));

  const fmtNum = (n: number) =>
    n === 0 ? "" : new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2 }).format(n);

  if (loading) return <p className="text-gray-400 py-10 text-center">Loading ledger…</p>;
  if (!data || (data as { error?: string }).error) return <p className="text-red-500">Account not found.</p>;

  const { account, rows, closingBalance } = data;
  const isDebitNormal = account.type === "ASSET" || account.type === "EXPENSE";

  const balanceSide = (bal: number) => {
    if (bal === 0) return "Nil";
    if (isDebitNormal) return bal > 0 ? "Dr" : "Cr";
    return bal > 0 ? "Cr" : "Dr";
  };

  const totalDebit  = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
        <Link href="/ledger" className="hover:underline text-purple-600">Ledger</Link>
        <span>/</span>
        <Link href="/journal" className="hover:underline text-purple-600">Journal</Link>
        <span>/</span>
        <Link href="/trial-balance" className="hover:underline text-purple-600">Trial Balance</Link>
        <span>/</span>
        <span className="text-gray-600">{account.name}</span>
      </div>

      {/* Account header */}
      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{account.code}</span>
              {account.subtype && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium">{account.subtype}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold">{account.name}</h1>
            <p className="text-xs text-gray-400 mt-1">{TYPE_DESCRIPTIONS[account.type]}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Closing Balance</p>
            <p className={`text-2xl font-bold ${closingBalance === 0 ? "text-gray-400" : isDebitNormal ? (closingBalance > 0 ? "text-gray-900" : "text-red-600") : (closingBalance > 0 ? "text-gray-900" : "text-red-600")}`}>
              {fmtCcy(closingBalance)}
            </p>
            <p className="text-sm font-medium text-gray-500">{balanceSide(closingBalance)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Debits</p>
            <p className="font-mono font-semibold text-gray-700">{fmtCcy(totalDebit)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Credits</p>
            <p className="font-mono font-semibold text-gray-700">{fmtCcy(totalCredit)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Transactions</p>
            <p className="font-semibold text-gray-700">{rows.length}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">As at {today}</p>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-secondary text-xs">Print</button>
          <Link href="/journal" className="btn-primary text-xs">+ New Journal Entry</Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <p className="text-gray-400 mb-2">No transactions posted to this account yet.</p>
          <Link href="/journal" className="text-indigo-700 hover:underline text-sm">Post a journal entry →</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-purple-700 text-white text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left w-28">Date</th>
                <th className="px-4 py-2.5 text-left w-24">Ref</th>
                <th className="px-4 py-2.5 text-left">Particulars</th>
                <th className="px-4 py-2.5 text-right w-28">Debit £</th>
                <th className="px-4 py-2.5 text-right w-28">Credit £</th>
                <th className="px-4 py-2.5 text-right w-36">Balance £</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Opening balance row */}
              <tr className="bg-gray-50 text-xs text-gray-500 italic">
                <td className="px-4 py-2" colSpan={5}>Opening Balance</td>
                <td className="px-4 py-2 text-right font-mono">0.00 {isDebitNormal ? "Dr" : "Cr"}</td>
              </tr>

              {rows.map((row, idx) => {
                const isNegBal = isDebitNormal ? row.balance < 0 : row.balance < 0;
                return (
                  <tr key={row.id} className={`hover:bg-gray-50 ${idx % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 text-xs">
                      {new Date(row.date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{row.reference}</td>
                    <td className="px-4 py-2.5 text-gray-800">{row.description}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-800">
                      {row.debit > 0 ? fmtNum(row.debit) : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-800">
                      {row.credit > 0 ? fmtNum(row.credit) : ""}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${isNegBal ? "text-red-600" : "text-gray-900"}`}>
                      {fmtNum(Math.abs(row.balance))} {balanceSide(row.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totals row */}
            <tfoot>
              <tr className="bg-gray-100 text-sm font-semibold border-t-2 border-gray-300">
                <td colSpan={3} className="px-4 py-2.5 text-xs uppercase text-gray-500 tracking-wide">
                  Period Totals
                </td>
                <td className="px-4 py-2.5 text-right font-mono border-t border-gray-400">
                  {fmtNum(totalDebit)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono border-t border-gray-400">
                  {fmtNum(totalCredit)}
                </td>
                <td className="px-4 py-2.5"></td>
              </tr>
              <tr className="bg-purple-700 text-white text-sm font-bold">
                <td colSpan={5} className="px-4 py-2.5 uppercase tracking-wide text-xs">Closing Balance</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {fmtNum(Math.abs(closingBalance))} {balanceSide(closingBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
