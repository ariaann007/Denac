"use client";
import { useEffect, useState } from "react";

type JournalEntry = { id: string; date: string; reference: string; description: string };
type Line = {
  id: string;
  debit: number;
  credit: number;
  description: string | null;
  journalEntry: JournalEntry;
};
type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  lines: Line[];
  totalDebit: number;
  totalCredit: number;
  balance: number;
  status: "DEBTOR" | "CREDITOR" | "NEUTRAL";
};

const emptyForm = () => ({ name: "", email: "", phone: "", notes: "" });

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then(setContacts);
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setShowModal(true);
  };

  const openEdit = (c: Contact) => {
    setEditingId(c.id);
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "", notes: c.notes || "" });
    setError("");
    setShowModal(true);
  };

  const save = async () => {
    setError("");
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    const url = editingId ? `/api/contacts/${editingId}` : "/api/contacts";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
      return;
    }
    setShowModal(false);
    load();
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Delete this contact? This will remove the contact tag from all journal lines.")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    load();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Math.abs(n));

  const statusBadge = (status: Contact["status"]) => {
    if (status === "DEBTOR") return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Debtor</span>;
    if (status === "CREDITOR") return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Creditor</span>;
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Neutral</span>;
  };

  const q = search.toLowerCase().trim();
  const filtered = q
    ? contacts.filter((c) => c.name.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q))
    : contacts;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <button onClick={openCreate} className="btn-primary">+ New Contact</button>
      </div>

      <div className="mb-4">
        <input
          className="input max-w-sm"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">
          {contacts.length === 0 ? "No contacts yet. Click + New Contact to add one." : "No contacts match your search."}
        </p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((c) => {
            const recentLines = [...c.lines]
              .sort((a, b) => new Date(b.journalEntry.date).getTime() - new Date(a.journalEntry.date).getTime())
              .slice(0, 5);
            const isExpanded = expandedId === c.id;

            return (
              <div key={c.id} className="bg-white rounded-xl shadow">
                <div className="p-4 flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{c.name}</span>
                      {statusBadge(c.status)}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-3">
                      {c.email && <span>{c.email}</span>}
                      {c.phone && <span>{c.phone}</span>}
                    </div>
                    {c.notes && <p className="text-xs text-gray-500 mt-1 italic">{c.notes}</p>}
                  </div>

                  {/* Balance */}
                  <div className="text-right flex-shrink-0">
                    <div className={`text-base font-bold font-mono ${c.status === "DEBTOR" ? "text-green-600" : c.status === "CREDITOR" ? "text-amber-600" : "text-gray-400"}`}>
                      {c.status === "DEBTOR" ? "+" : c.status === "CREDITOR" ? "−" : ""}{fmt(c.balance)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {c.status === "DEBTOR" ? "they owe us" : c.status === "CREDITOR" ? "we owe them" : "settled"}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(c)} className="text-purple-500 hover:text-purple-700 text-xs">Edit</button>
                    <button onClick={() => deleteContact(c.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                    {c.lines.length > 0 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        className="text-gray-400 hover:text-gray-600 text-xs"
                      >
                        {isExpanded ? "Hide" : `${c.lines.length} txn${c.lines.length !== 1 ? "s" : ""}`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Recent transactions */}
                {isExpanded && recentLines.length > 0 && (
                  <div className="border-t border-gray-100 px-4 pb-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wide py-2">Recent Transactions (last {recentLines.length})</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-left pb-1">Date</th>
                          <th className="text-left pb-1">Reference</th>
                          <th className="text-left pb-1">Description</th>
                          <th className="text-right pb-1">Debit</th>
                          <th className="text-right pb-1">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {recentLines.map((l) => (
                          <tr key={l.id} className="text-gray-600">
                            <td className="py-1 pr-3 whitespace-nowrap">
                              {new Date(l.journalEntry.date).toLocaleDateString("en-GB")}
                            </td>
                            <td className="py-1 pr-3 font-mono text-gray-400">{l.journalEntry.reference}</td>
                            <td className="py-1 pr-3 text-gray-500">{l.description || l.journalEntry.description}</td>
                            <td className="py-1 text-right font-mono">
                              {l.debit > 0 ? <span className="text-green-600">{fmt(l.debit)}</span> : ""}
                            </td>
                            <td className="py-1 text-right font-mono">
                              {l.credit > 0 ? <span className="text-amber-600">{fmt(l.credit)}</span> : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Contact" : "New Contact"}</h2>

            {error && (
              <p className="text-red-600 text-sm mb-4 p-2 bg-red-50 rounded border border-red-200">{error}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  placeholder="e.g. Acme Ltd"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="e.g. accounts@acme.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  placeholder="e.g. 020 7946 0000"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Any additional notes…"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Contact"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
