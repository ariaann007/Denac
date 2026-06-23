"use client";
import { useEffect, useState } from "react";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  description: string | null;
  isActive: boolean;
};

const TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];
const SUBTYPES: Record<string, string[]> = {
  ASSET: ["BANK", "CASH", "DEBTOR", ""],
  LIABILITY: ["CREDITOR", ""],
  EQUITY: [""],
  INCOME: [""],
  EXPENSE: [""],
};

const TYPE_COLORS: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-800",
  LIABILITY: "bg-red-100 text-red-800",
  EQUITY: "bg-purple-100 text-purple-800",
  INCOME: "bg-green-100 text-green-800",
  EXPENSE: "bg-orange-100 text-orange-800",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "ASSET", subtype: "", description: "" });
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => { setAccounts(data); setLoading(false); });
  };

  useEffect(load, []);

  const openNew = () => {
    setEditing(null);
    setForm({ code: "", name: "", type: "ASSET", subtype: "", description: "" });
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

  const grouped = TYPES.reduce((acc, t) => {
    acc[t] = accounts.filter((a) => a.type === t);
    return acc;
  }, {} as Record<string, Account[]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Chart of Accounts</h1>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <button onClick={seed} disabled={seeding} className="btn-secondary">
              {seeding ? "Seeding…" : "Load Defaults"}
            </button>
          )}
          <button onClick={openNew} className="btn-primary">+ Add Account</button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        TYPES.map((type) => (
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
                          <button onClick={() => openEdit(a)} className="text-indigo-600 hover:underline text-xs">
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ))
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit Account" : "New Account"}</h2>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <div className="space-y-3">
              <Field label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="e.g. 1100" />
              <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Barclays Bank" />
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
