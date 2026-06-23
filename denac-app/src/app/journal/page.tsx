"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Account = { id: string; code: string; name: string; type: string };
type JournalLine = { accountId: string; debit: string; credit: string; description: string };
type Entry = {
  id: string;
  date: string;
  reference: string;
  description: string;
  lines: { id: string; debit: number; credit: number; account: Account; description: string | null }[];
};

const emptyLine = (): JournalLine => ({ accountId: "", debit: "", credit: "", description: "" });

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: today(), reference: "", description: "" });
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      fetch("/api/journals").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([j, a]) => { setEntries(j); setAccounts(a); });
  };

  useEffect(load, []);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001;

  const save = async () => {
    setError("");
    setSaving(true);
    const payload = {
      ...form,
      lines: lines
        .filter((l) => l.accountId)
        .map((l) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description || undefined,
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
    setLines([emptyLine(), emptyLine()]);
    setForm({ date: today(), reference: "", description: "" });
    load();
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this journal entry?")) return;
    await fetch(`/api/journals/${id}`, { method: "DELETE" });
    load();
  };

  const fmt = (n: number) =>
    n === 0 ? "" : new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2 }).format(n);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Journal Entries</h1>
        <button onClick={() => { setShowForm(true); setError(""); }} className="btn-primary">
          + New Entry
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-400">No journal entries yet.</p>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const totalDr = entry.lines.reduce((s, l) => s + l.debit, 0);
            return (
              <div key={entry.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded mr-2">{entry.reference}</span>
                    <span className="font-medium">{entry.description}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>{new Date(entry.date).toLocaleDateString("en-GB")}</span>
                    <button onClick={() => deleteEntry(entry.id)} className="text-red-500 hover:text-red-700 text-xs">
                      Delete
                    </button>
                  </div>
                </div>
                <table className="w-full text-sm mt-2">
                  <thead className="text-xs text-gray-500">
                    <tr>
                      <th className="text-left pb-1">Account</th>
                      <th className="text-left pb-1">Description</th>
                      <th className="text-right pb-1">Debit</th>
                      <th className="text-right pb-1">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entry.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="py-1">
                          <Link href={`/ledger/${l.account.id}`} className="text-indigo-700 hover:underline">
                            {l.account.code} — {l.account.name}
                          </Link>
                        </td>
                        <td className="py-1 text-gray-500">{l.description || ""}</td>
                        <td className="py-1 text-right font-mono">{fmt(l.debit)}</td>
                        <td className="py-1 text-right font-mono">{fmt(l.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold border-t">
                      <td colSpan={2} className="pt-1 text-xs text-gray-500 uppercase">Total</td>
                      <td className="pt-1 text-right font-mono">{fmt(totalDr)}</td>
                      <td className="pt-1 text-right font-mono">{fmt(totalDr)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-10">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4">
            <h2 className="text-lg font-semibold mb-4">New Journal Entry</h2>
            {error && <p className="text-red-600 text-sm mb-3 p-2 bg-red-50 rounded">{error}</p>}

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="label">Reference</label>
                <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="JNL-001" />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Cash received" />
              </div>
            </div>

            <table className="w-full text-sm mb-3">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left pb-1 w-5/12">Account</th>
                  <th className="text-left pb-1 w-3/12">Description</th>
                  <th className="text-left pb-1 w-2/12">Debit</th>
                  <th className="text-left pb-1 w-2/12">Credit</th>
                  <th className="pb-1 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1 pr-2">
                      <select
                        className="input text-xs"
                        value={line.accountId}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[i] = { ...updated[i], accountId: e.target.value };
                          setLines(updated);
                        }}
                      >
                        <option value="">— Select account —</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        className="input text-xs"
                        placeholder="Note"
                        value={line.description}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[i] = { ...updated[i], description: e.target.value };
                          setLines(updated);
                        }}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        className="input text-xs text-right font-mono"
                        placeholder="0.00"
                        value={line.debit}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[i] = { ...updated[i], debit: e.target.value, credit: e.target.value ? "" : updated[i].credit };
                          setLines(updated);
                        }}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        className="input text-xs text-right font-mono"
                        placeholder="0.00"
                        value={line.credit}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[i] = { ...updated[i], credit: e.target.value, debit: e.target.value ? "" : updated[i].debit };
                          setLines(updated);
                        }}
                      />
                    </td>
                    <td className="py-1">
                      {lines.length > 2 && (
                        <button
                          onClick={() => setLines(lines.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-sm">
                  <td colSpan={2} className="pt-2 text-gray-500 text-xs uppercase">Total</td>
                  <td className="pt-2 font-mono text-right pr-2">{totalDebit.toFixed(2)}</td>
                  <td className="pt-2 font-mono text-right pr-2">{totalCredit.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {!balanced && totalDebit + totalCredit > 0 && (
              <p className="text-red-600 text-xs mb-2">
                ⚠ Not balanced — difference: {Math.abs(totalDebit - totalCredit).toFixed(2)}
              </p>
            )}
            {balanced && totalDebit > 0 && (
              <p className="text-green-600 text-xs mb-2">✓ Balanced</p>
            )}

            <button
              onClick={() => setLines([...lines, emptyLine()])}
              className="text-indigo-600 text-sm hover:underline mb-4 block"
            >
              + Add line
            </button>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving || !balanced} className="btn-primary disabled:opacity-50">
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
