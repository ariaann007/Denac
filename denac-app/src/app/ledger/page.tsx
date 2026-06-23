"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Account = { id: string; code: string; name: string; type: string; subtype: string | null };

const TYPE_COLORS: Record<string, string> = {
  ASSET: "text-blue-700",
  LIABILITY: "text-red-700",
  EQUITY: "text-purple-700",
  INCOME: "text-green-700",
  EXPENSE: "text-orange-700",
};

export default function LedgerIndex() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load accounts:", err);
        setError("Failed to load accounts. Please refresh the page.");
        setLoading(false);
      });
  }, []);

  const TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];
  const grouped = TYPES.reduce((acc, t) => {
    acc[t] = accounts.filter((a) => a.type === t);
    return acc;
  }, {} as Record<string, Account[]>);

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
        <Link href="/journal" className="hover:underline text-purple-600">Journal</Link>
        <span>/</span>
        <Link href="/trial-balance" className="hover:underline text-purple-600">Trial Balance</Link>
        <span>/</span>
        <span className="text-gray-600">Ledger</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Ledger</h1>
      <p className="text-gray-500 mb-6 text-sm">Select an account to view its ledger transactions.</p>

      {loading && <p className="text-gray-400">Loading accounts…</p>}
      {error && <p className="text-red-600 text-sm mb-4 p-2 bg-red-50 rounded border border-red-200">{error}</p>}

      {!loading && !error && TYPES.map((type) =>
        grouped[type].length > 0 ? (
          <div key={type} className="mb-6">
            <h2 className={`text-xs font-semibold uppercase tracking-widest mb-2 ${TYPE_COLORS[type]}`}>{type}</h2>
            <div className="grid md:grid-cols-3 gap-3">
              {grouped[type].map((a) => (
                <Link
                  key={a.id}
                  href={`/ledger/${a.id}`}
                  className="bg-white rounded-lg shadow p-3 hover:shadow-md transition-shadow"
                >
                  <p className="font-mono text-xs text-gray-400">{a.code}</p>
                  <p className="font-medium">{a.name}</p>
                  {a.subtype && <p className="text-xs text-gray-400 mt-0.5">{a.subtype}</p>}
                </Link>
              ))}
            </div>
          </div>
        ) : null
      )}
      {!loading && accounts.length === 0 && <p className="text-gray-400">No accounts yet.</p>}
    </div>
  );
}
