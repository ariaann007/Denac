"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Account = { id: string; code: string; name: string; type: string; subtype: string | null };
type Entry = {
  id: string;
  date: string;
  reference: string;
  description: string;
  lines: { id: string; debit: number; credit: number; account: Account; description: string | null }[];
};

const emptyVoucher = () => ({
  date: today(),
  reference: "",
  accountToBePaid: "",   // DR side
  paidFrom: "",          // CR side
  particular: "",        // narration / description
  amount: "",
});

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [voucher, setVoucher] = useState(emptyVoucher());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      fetch("/api/journals").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([j, a]) => {
      setEntries(j);
      setAccounts(a);
    }).catch((err) => {
      console.error("Failed to load data:", err);
      setError("Failed to load data. Please refresh the page.");
    });
  };

  useEffect(load, []);

  // Bank/cash accounts go in "Paid From"; all accounts available for "Account to be Paid"
  const fundAccounts = accounts.filter(
    (a) => a.subtype === "BANK" || a.subtype === "CASH"
  );

  const openForm = () => {
    setVoucher(emptyVoucher());
    setError("");
    setShowForm(true);
  };

  const save = async () => {
    setError("");
    const amount = parseFloat(voucher.amount);
    if (!voucher.date) { setError("Date is required"); return; }
    if (!voucher.reference) { setError("Reference is required"); return; }
    if (!voucher.accountToBePaid) { setError("Account to be paid is required"); return; }
    if (!voucher.paidFrom) { setError("Paid from account is required"); return; }
    if (!voucher.particular) { setError("Particular / description is required"); return; }
    if (!amount || amount <= 0) { setError("Enter a valid amount"); return; }

    setSaving(true);
    const payload = {
      date: voucher.date,
      reference: voucher.reference,
      description: voucher.particular,
      lines: [
        // DR: account to be paid
        { accountId: voucher.accountToBePaid, debit: amount, credit: 0, description: voucher.particular },
        // CR: paid from
        { accountId: voucher.paidFrom, debit: 0, credit: amount, description: voucher.particular },
      ],
    };

    const res = await fetch("/api/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
      return;
    }
    setShowForm(false);
    load();
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this journal entry?")) return;
    await fetch(`/api/journals/${id}`, { method: "DELETE" });
    load();
  };

  const fmt = (n: number) =>
    n === 0
      ? ""
      : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  // Derive a friendly summary from an entry: find which line is the DR side
  const summarise = (entry: Entry) => {
    const dr = entry.lines.find((l) => l.debit > 0);
    const cr = entry.lines.find((l) => l.credit > 0);
    return { dr, cr, amount: dr?.debit ?? 0 };
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
        <Link href="/trial-balance" className="hover:underline text-purple-600">Trial Balance</Link>
        <span>/</span>
        <Link href="/ledger" className="hover:underline text-purple-600">Ledger</Link>
        <span>/</span>
        <span className="text-gray-600">Journal</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Journal Entries</h1>
        <button onClick={openForm} className="btn-primary">+ New Entry</button>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-400 text-sm">No journal entries yet. Click <strong>New Entry</strong> to start.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Ref</th>
                <th className="px-4 py-2 text-left">Particular</th>
                <th className="px-4 py-2 text-left">Account Paid</th>
                <th className="px-4 py-2 text-left">Paid From</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => {
                const { dr, cr, amount } = summarise(entry);
                return (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(entry.date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{entry.reference}</td>
                    <td className="px-4 py-3">{entry.description}</td>
                    <td className="px-4 py-3">
                      {dr ? (
                        <Link href={`/ledger/${dr.account.id}`} className="text-purple-700 hover:underline">
                          {dr.account.name}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {cr ? (
                        <Link href={`/ledger/${cr.account.id}`} className="text-purple-700 hover:underline">
                          {cr.account.name}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{fmt(amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-10">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-lg font-semibold mb-1">New Journal Entry</h2>
            <p className="text-xs text-gray-500 mb-5">
              The double-entry (Dr/Cr) is created automatically.
            </p>

            {error && (
              <p className="text-red-600 text-sm mb-4 p-2 bg-red-50 rounded border border-red-200">
                {error}
              </p>
            )}

            <div className="space-y-4">
              {/* Date & Reference on same row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input
                    type="date"
                    className="input"
                    value={voucher.date}
                    onChange={(e) => setVoucher({ ...voucher, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Reference No.</label>
                  <input
                    className="input"
                    placeholder="e.g. JNL-001"
                    value={voucher.reference}
                    onChange={(e) => setVoucher({ ...voucher, reference: e.target.value })}
                  />
                </div>
              </div>

              {/* Account to be Paid */}
              <div>
                <label className="label">Account to be Paid (Debit)</label>
                <select
                  className="input"
                  value={voucher.accountToBePaid}
                  onChange={(e) => setVoucher({ ...voucher, accountToBePaid: e.target.value })}
                >
                  <option value="">— Select account —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  The expense, asset, or person being paid / charged.
                </p>
              </div>

              {/* Particular */}
              <div>
                <label className="label">Particular</label>
                <input
                  className="input"
                  placeholder="e.g. Office rent for June 2026"
                  value={voucher.particular}
                  onChange={(e) => setVoucher({ ...voucher, particular: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">
                  What is this payment / transaction for?
                </p>
              </div>

              {/* Paid From */}
              <div>
                <label className="label">Paid From (Credit)</label>
                <select
                  className="input"
                  value={voucher.paidFrom}
                  onChange={(e) => setVoucher({ ...voucher, paidFrom: e.target.value })}
                >
                  <option value="">— Select account —</option>
                  {fundAccounts.length > 0 && (
                    <optgroup label="Bank & Cash">
                      {fundAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="All Accounts">
                    {accounts
                      .filter((a) => !fundAccounts.find((f) => f.id === a.id))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Which bank or cash account is the payment coming from?
                </p>
              </div>

              {/* Amount */}
              <div>
                <label className="label">Amount (£)</label>
                <input
                  className="input font-mono text-right"
                  placeholder="0.00"
                  value={voucher.amount}
                  onChange={(e) => setVoucher({ ...voucher, amount: e.target.value })}
                />
              </div>

              {/* Preview of double-entry */}
              {voucher.accountToBePaid && voucher.paidFrom && parseFloat(voucher.amount) > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs">
                  <p className="font-semibold text-purple-700 mb-2">Double-entry preview</p>
                  <table className="w-full">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left font-normal">Account</th>
                        <th className="text-right font-normal">Dr</th>
                        <th className="text-right font-normal">Cr</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-0.5">
                          {accounts.find((a) => a.id === voucher.accountToBePaid)?.name}
                        </td>
                        <td className="text-right font-mono">
                          {parseFloat(voucher.amount).toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                      <tr>
                        <td className="py-0.5 pl-4 text-gray-500">
                          {accounts.find((a) => a.id === voucher.paidFrom)?.name}
                        </td>
                        <td></td>
                        <td className="text-right font-mono">
                          {parseFloat(voucher.amount).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? "Saving…" : "Post Journal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function today() {
  return new Date().toISOString().split("T")[0];
}
