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
type Line = { accountId: string; debit: string; credit: string };

const emptyLine = (): Line => ({ accountId: "", debit: "", credit: "" });

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      fetch("/api/journals").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([j, a]) => {
      setEntries(j);
      setAccounts(a);
    });
  };

  useEffect(load, []);

  const openForm = () => {
    setDate(today());
    setReference("");
    setDescription("");
    setLines([emptyLine(), emptyLine()]);
    setError("");
    setShowForm(true);
  };

  const updateLine = (i: number, field: keyof Line, value: string) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (i: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  };

  const totalDebits = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const diff = Math.abs(totalDebits - totalCredits);
  const balanced = diff < 0.005 && totalDebits > 0;

  const save = async () => {
    setError("");
    if (!date) { setError("Date is required"); return; }
    if (!reference.trim()) { setError("Reference is required"); return; }
    if (!description.trim()) { setError("Description is required"); return; }

    const filledLines = lines.filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (filledLines.length < 2) { setError("At least 2 lines with amounts are required"); return; }
    if (!balanced) { setError(`Entry is unbalanced — debits (£${totalDebits.toFixed(2)}) ≠ credits (£${totalCredits.toFixed(2)})`); return; }

    setSaving(true);
    const payload = {
      date,
      reference: reference.trim(),
      description: description.trim(),
      lines: filledLines.map((l) => ({
        accountId: l.accountId,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: description.trim(),
      })),
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
    n === 0 ? "" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

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
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-right">Debits</th>
                <th className="px-4 py-2 text-right">Lines</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => {
                const totalDr = entry.lines.reduce((s, l) => s + l.debit, 0);
                return (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(entry.date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{entry.reference}</td>
                    <td className="px-4 py-3">{entry.description}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{fmt(totalDr)}</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">{entry.lines.length}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteEntry(entry.id)} className="text-red-400 hover:text-red-600 text-xs">
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
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-10">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-3xl mx-4">
            <h2 className="text-xl font-bold mb-1">Create Journal Entry</h2>

            {error && (
              <p className="text-red-600 text-sm mb-4 p-2 bg-red-50 rounded border border-red-200">{error}</p>
            )}

            {/* Header fields */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Reference Number</label>
                <input className="input font-mono" placeholder="e.g. JNL-001" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div>
                <label className="label">Narration / Description</label>
                <input className="input" placeholder="e.g. Purchase of office computers" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            {/* Lines table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Account Select</th>
                    <th className="px-3 py-2 text-right w-36">Debit (£)</th>
                    <th className="px-3 py-2 text-right w-36">Credit (£)</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line, i) => (
                    <tr key={i} className="bg-white">
                      <td className="px-3 py-2">
                        <select
                          className="input py-1.5 text-sm"
                          value={line.accountId}
                          onChange={(e) => updateLine(i, "accountId", e.target.value)}
                        >
                          <option value="">-- Choose Account --</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="input py-1.5 text-sm text-right font-mono"
                          placeholder="0.00"
                          value={line.debit}
                          onChange={(e) => updateLine(i, "debit", e.target.value)}
                          onFocus={() => { if (!line.debit) updateLine(i, "credit", ""); }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="input py-1.5 text-sm text-right font-mono"
                          placeholder="0.00"
                          value={line.credit}
                          onChange={(e) => updateLine(i, "credit", e.target.value)}
                          onFocus={() => { if (!line.credit) updateLine(i, "debit", ""); }}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => removeLine(i)}
                          className="text-gray-300 hover:text-red-400 text-lg leading-none"
                          title="Remove line"
                        >
                          −
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals row */}
              <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 flex items-center gap-3 text-sm">
                <button onClick={addLine} className="btn-secondary py-1 px-3 text-xs">+ Add Line</button>
                <div className="ml-auto flex items-center gap-6">
                  <span className="font-medium">Debits: <span className="font-mono">£{totalDebits.toFixed(2)}</span></span>
                  <span className="font-medium">Credits: <span className="font-mono">£{totalCredits.toFixed(2)}</span></span>
                  {totalDebits === 0 && totalCredits === 0 ? null : balanced ? (
                    <span className="text-green-600 text-xs font-medium bg-green-50 border border-green-200 rounded px-2 py-1">✓ Balanced</span>
                  ) : (
                    <span className="text-red-600 text-xs font-medium bg-red-50 border border-red-200 rounded px-2 py-1">
                      ⊗ Unbalanced (Diff: £{diff.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? "Saving…" : "Post Journal Entry"}
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
