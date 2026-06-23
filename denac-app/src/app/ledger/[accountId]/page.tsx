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

type Account = { id: string; code: string; name: string; type: string };

type LedgerData = {
  account: Account;
  rows: LedgerRow[];
  closingBalance: number;
};

export default function LedgerPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = use(params);
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/ledger/${accountId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [accountId]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2 }).format(n);

  if (loading) return <p className="text-gray-400">Loading…</p>;
  if (!data) return <p className="text-red-500">Account not found.</p>;

  const { account, rows, closingBalance } = data;
  const isDebitNormal = account.type === "ASSET" || account.type === "EXPENSE";

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/ledger" className="hover:underline text-indigo-600">Ledger</Link>
        <span>/</span>
        <span>{account.name}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <p className="text-gray-500 text-sm">
            {account.code} · {account.type}
            {" · "}
            <span className={closingBalance >= 0 ? "text-green-700" : "text-red-700"}>
              Balance: {isDebitNormal ? (closingBalance >= 0 ? "Dr" : "Cr") : (closingBalance >= 0 ? "Cr" : "Dr")}{" "}
              {fmt(Math.abs(closingBalance))}
            </span>
          </p>
        </div>
        <Link href="/journal" className="btn-primary text-sm">+ New Entry</Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-400">No transactions yet.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Ref</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-right">Debit</th>
                <th className="px-4 py-2 text-right">Credit</th>
                <th className="px-4 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{new Date(row.date).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-2 font-mono text-xs">{row.reference}</td>
                  <td className="px-4 py-2">{row.description}</td>
                  <td className="px-4 py-2 text-right font-mono">{row.debit ? fmt(row.debit) : ""}</td>
                  <td className="px-4 py-2 text-right font-mono">{row.credit ? fmt(row.credit) : ""}</td>
                  <td className={`px-4 py-2 text-right font-mono font-medium ${row.balance < 0 ? "text-red-600" : ""}`}>
                    {fmt(Math.abs(row.balance))} {row.balance >= 0 ? (isDebitNormal ? "Dr" : "Cr") : (isDebitNormal ? "Cr" : "Dr")}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td colSpan={3} className="px-4 py-2 text-xs uppercase text-gray-500">Closing Balance</td>
                <td colSpan={3} className="px-4 py-2 text-right font-mono">
                  {fmt(Math.abs(closingBalance))}{" "}
                  {closingBalance >= 0 ? (isDebitNormal ? "Dr" : "Cr") : (isDebitNormal ? "Cr" : "Dr")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
