"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  description: string | null;
  isActive: boolean;
};

type AccountWithBalance = Account & {
  debitBalance: number;
  creditBalance: number;
  // Effective status derived purely from balance — ignores initial setup
  effectiveStatus: "DEBTOR" | "CREDITOR" | "NEUTRAL";
};

const TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];
const SUBTYPES: Record<string, string[]> = {
  ASSET:     ["BANK", "CASH", "DEBTOR", ""],
  LIABILITY: ["CREDITOR", ""],
  EQUITY:    [""],
  INCOME:    [""],
  EXPENSE:   [""],
};

const TYPE_COLORS: Record<string, string> = {
  ASSET:     "bg-blue-100 text-blue-800",
  LIABILITY: "bg-red-100 text-red-800",
  EQUITY:    "bg-purple-100 text-purple-800",
  INCOME:    "bg-green-100 text-green-800",
  EXPENSE:   "bg-orange-100 text-orange-800",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, { debitBalance: number; creditBalance: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "ASSET", subtype: "", description: "" });
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/trial-balance").then((r) => r.json()),
    ]).then(([accs, tb]) => {
      setAccounts(accs);
      const bmap: Record<string, { debitBalance: number; creditBalance: number }> = {};
      for (const row of tb.rows) bmap[row.id] = { debitBalance: row.debitBalance, creditBalance: row.creditBalance };
      setBalances(bmap);
      setLoading(false);
    }).catch(() => {
      setError("Failed to load accounts.");
      setLoading(false);
    });
  };

  useEffect(load, []);

  const openNew = (presetSubtype?: string) => {
    setEditing(null);
    const type = presetSubtype === "CREDITOR" ? "LIABILITY" : presetSubtype === "DEBTOR" ? "ASSET" : "ASSET";
    setForm({ code: "", name: "", type, subtype: presetSubtype || "", description: "" });
    setError("");
    setShowForm(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setForm({ code: a.code, name: a.name, type: a.type, subtype: a.subtype || "", description: a.description || "" });
    setError("");
    setShowForm(true);
  };

  const save = async () => {
    setError("");
    const method = editing ? "PUT" : "POST";
    const url = editing ? `/api/accounts/${editing.id}` : "/api/accounts";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, subtype: form.subtype || null }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
      return;
    }
    setShowForm(false);
    load();
  };

  const seed = async () => {
    setSeeding(true);
    await fetch("/api/seed", { method: "POST" });
    setSeeding(false);
    load();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  // Accounts with DEBTOR or CREDITOR subtype — shown in dedicated section
  const personAccounts: AccountWithBalance[] = accounts
    .filter((a) => a.subtype === "DEBTOR" || a.subtype === "CREDITOR")
    .map((a) => {
      const b = balances[a.id] ?? { debitBalance: 0, creditBalance: 0 };
      // Effective status is based purely on actual balance, NOT initial setup
      // debitBalance > 0 means they owe us → DEBTOR
      // creditBalance > 0 means we owe them → CREDITOR
      const effectiveStatus: AccountWithBalance["effectiveStatus"] =
        b.debitBalance > 0.005 ? "DEBTOR"
        : b.creditBalance > 0.005 ? "CREDITOR"
        : "NEUTRAL";
      return { ...a, ...b, effectiveStatus };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalOwedToUs   = personAccounts.filter(a => a.effectiveStatus === "DEBTOR").reduce((s, a) => s + a.debitBalance, 0);
  const totalWeOwe      = personAccounts.filter(a => a.effectiveStatus === "CREDITOR").reduce((s, a) => s + a.creditBalance, 0);

  // Remaining accounts (no DEBTOR/CREDITOR subtype) grouped by type
  const regularAccounts = accounts.filter((a) => a.subtype !== "DEBTOR" && a.subtype !== "CREDITOR");
  const grouped = TYPES.reduce((acc, t) => {
    acc[t] = regularAccounts.filter((a) => a.type === t);
    return acc;
  }, {} as Record<string, Account[]>);

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
        <Link href="/journal" className="hover:underline text-purple-600">Journal</Link>
        <span>/</span>
        <Link href="/trial-balance" className="hover:underline text-purple-600">Trial Balance</Link>
        <span>/</span>
        <span className="text-gray-600">Chart of Accounts</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Chart of Accounts</h1>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <button onClick={seed} disabled={seeding} className="btn-secondary">
              {seeding ? "Seeding…" : "Load Defaults"}
            </button>
          )}
          <button onClick={() => openNew()} className="btn-primary">+ Add Account</button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <>
          {/* ── Debtors & Creditors section ── */}
          {personAccounts.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Debtors & Creditors</h2>
                <div className="flex gap-2">
                  <button onClick={() => openNew("DEBTOR")}   className="btn-secondary text-xs py-1 px-3">+ Add Debtor</button>
                  <button onClick={() => openNew("CREDITOR")} className="btn-secondary text-xs py-1 px-3">+ Add Creditor</button>
                </div>
              </div>

              {/* Summary totals */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white rounded-lg shadow-sm border-l-4 border-green-400 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-0.5">Owed to us (Debtors)</p>
                  <p className="text-xl font-bold font-mono text-green-600">{fmt(totalOwedToUs)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border-l-4 border-amber-400 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-0.5">We owe (Creditors)</p>
                  <p className="text-xl font-bold font-mono text-amber-600">{fmt(totalWeOwe)}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2 text-left w-48">Note</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {personAccounts.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-gray-500">{a.code}</td>
                        <td className="px-4 py-2.5 font-medium">{a.name}</td>
                        <td className="px-4 py-2.5">
                          {a.effectiveStatus === "DEBTOR" ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Debtor</span>
                          ) : a.effectiveStatus === "CREDITOR" ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Creditor</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Neutral</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">
                          {a.effectiveStatus === "DEBTOR" ? (
                            <span className="text-green-600">{fmt(a.debitBalance)}</span>
                          ) : a.effectiveStatus === "CREDITOR" ? (
                            <span className="text-amber-600">{fmt(a.creditBalance)}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">
                          {a.effectiveStatus === "DEBTOR" && a.subtype === "CREDITOR" && (
                            <span className="italic text-blue-500">Originally creditor — now owes us</span>
                          )}
                          {a.effectiveStatus === "CREDITOR" && a.subtype === "DEBTOR" && (
                            <span className="italic text-orange-500">Originally debtor — we now owe them</span>
                          )}
                          {a.effectiveStatus === "NEUTRAL" && "Settled"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => openEdit(a)} className="text-indigo-600 hover:underline text-xs">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Status is calculated from actual account balance. A creditor with a debit balance is automatically shown as a debtor, and vice versa.
              </p>
            </div>
          )}

          {/* ── Regular accounts grouped by type ── */}
          {TYPES.map((type) => (
            grouped[type].length > 0 && (
              <div key={type} className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">{type}</h2>
                <div className="bg-white rounded-xl shadow overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Code</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Subtype</th>
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {grouped[type].map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono">{a.code}</td>
                          <td className="px-4 py-2 font-medium">{a.name}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[a.type]}`}>
                              {a.type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-500">{a.subtype || "—"}</td>
                          <td className="px-4 py-2 text-gray-500">{a.description || "—"}</td>
                          <td className="px-4 py-2 text-right">
                            <button onClick={() => openEdit(a)} className="text-indigo-600 hover:underline text-xs">Edit</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ))}
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Account" : "New Account"}</h2>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <div className="space-y-3">
              <Field label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="e.g. 2100" />
              <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Rajubhai" />
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, subtype: "" })}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Subtype</label>
                <select className="input" value={form.subtype} onChange={(e) => setForm({ ...form, subtype: e.target.value })}>
                  {(SUBTYPES[form.type] || [""]).map((s) => <option key={s} value={s}>{s || "None"}</option>)}
                </select>
                {(form.subtype === "DEBTOR" || form.subtype === "CREDITOR") && (
                  <p className="text-xs text-gray-400 mt-1">
                    This account will automatically show as Debtor or Creditor based on its running balance.
                  </p>
                )}
              </div>
              <Field label="Description (optional)" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="" />
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
