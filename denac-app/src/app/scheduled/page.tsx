"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Account = { id: string; code: string; name: string };
type SLine = { accountId: string; debit: string; credit: string };
type ScheduledEntry = {
  id: string;
  name: string;
  reference: string;
  description: string;
  intervalType: string;
  intervalValue: number;
  dayOfMonth: number | null;
  nextDueDate: string;
  isActive: boolean;
  lines: { id: string; accountId: string; debit: number; credit: number; account: Account }[];
};

const emptyLine = (): SLine => ({ accountId: "", debit: "", credit: "" });

function intervalLabel(e: ScheduledEntry): string {
  const v = e.intervalValue;
  switch (e.intervalType) {
    case "DAYS":   return `Every ${v} day${v !== 1 ? "s" : ""}`;
    case "WEEKS":  return `Every ${v} week${v !== 1 ? "s" : ""}`;
    case "MONTHS":
      if (e.dayOfMonth) return `Every ${v} month${v !== 1 ? "s" : ""} on the ${ordinal(e.dayOfMonth)}`;
      return `Every ${v} month${v !== 1 ? "s" : ""} (rolling)`;
    case "YEARS":  return `Every ${v} year${v !== 1 ? "s" : ""}`;
    default:       return e.intervalType;
  }
}

function ordinal(n: number) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

export default function ScheduledPage() {
  const [entries, setEntries] = useState<ScheduledEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // form fields
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [intervalType, setIntervalType] = useState("MONTHS");
  const [intervalValue, setIntervalValue] = useState("1");
  const [anchorDay, setAnchorDay] = useState<"fixed" | "rolling">("fixed");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [nextDueDate, setNextDueDate] = useState(today());
  const [lines, setLines] = useState<SLine[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      fetch("/api/scheduled").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([s, a]) => { setEntries(s); setAccounts(a); });
  };

  useEffect(load, []);

  const resetForm = () => {
    setEditingId(null);
    setName(""); setReference(""); setDescription("");
    setIntervalType("MONTHS"); setIntervalValue("1");
    setAnchorDay("fixed"); setDayOfMonth("1");
    setNextDueDate(today());
    setLines([emptyLine(), emptyLine()]);
    setError("");
  };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (e: ScheduledEntry) => {
    setEditingId(e.id);
    setName(e.name); setReference(e.reference); setDescription(e.description);
    setIntervalType(e.intervalType); setIntervalValue(String(e.intervalValue));
    setAnchorDay(e.dayOfMonth !== null ? "fixed" : "rolling");
    setDayOfMonth(e.dayOfMonth !== null ? String(e.dayOfMonth) : "1");
    setNextDueDate(e.nextDueDate.split("T")[0]);
    setLines(e.lines.map((l) => ({
      accountId: l.accountId,
      debit: l.debit > 0 ? String(l.debit) : "",
      credit: l.credit > 0 ? String(l.credit) : "",
    })));
    setError(""); setShowForm(true);
  };

  const updateLine = (i: number, field: keyof SLine, value: string) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const totalDebits  = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebits - totalCredits) < 0.005 && totalDebits > 0;

  const save = async () => {
    setError("");
    if (!name.trim())        { setError("Name is required"); return; }
    if (!reference.trim())   { setError("Reference prefix is required"); return; }
    if (!description.trim()) { setError("Description is required"); return; }
    const iv = parseInt(intervalValue);
    if (!iv || iv < 1)       { setError("Interval must be at least 1"); return; }
    const filledLines = lines.filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (filledLines.length < 2) { setError("At least 2 lines with amounts required"); return; }
    if (!balanced)           { setError("Lines must balance (debits = credits)"); return; }

    setSaving(true);
    const payload = {
      name: name.trim(), reference: reference.trim(), description: description.trim(),
      intervalType, intervalValue: iv,
      dayOfMonth: intervalType === "MONTHS" && anchorDay === "fixed" ? parseInt(dayOfMonth) : null,
      nextDueDate,
      lines: filledLines.map((l) => ({
        accountId: l.accountId,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      })),
    };

    const url = editingId ? `/api/scheduled/${editingId}` : "/api/scheduled";
    const res = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Failed to save"); return; }
    setShowForm(false); load();
  };

  const toggleActive = async (entry: ScheduledEntry) => {
    await fetch(`/api/scheduled/${entry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, isActive: !entry.isActive }),
    });
    load();
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this scheduled entry?")) return;
    await fetch(`/api/scheduled/${id}`, { method: "DELETE" });
    load();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
        <Link href="/journal" className="hover:underline text-purple-600">Journal</Link>
        <span>/</span>
        <span className="text-gray-600">Scheduled Payments</span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Scheduled Payments</h1>
        <button onClick={openCreate} className="btn-primary">+ New Schedule</button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Set up recurring journal entries for direct debits, standing orders and regular payments. They post automatically each day.
      </p>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium mb-1">No scheduled payments yet</p>
          <p className="text-sm">Add recurring entries for rent, payroll, subscriptions, etc.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const totalDr = entry.lines.reduce((s, l) => s + l.debit, 0);
            const dueDate = new Date(entry.nextDueDate);
            const overdue = entry.isActive && dueDate < new Date();
            return (
              <div key={entry.id} className={`bg-white rounded-xl shadow p-4 border-l-4 ${entry.isActive ? (overdue ? "border-red-400" : "border-purple-500") : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{entry.name}</span>
                      <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{entry.reference}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${entry.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {entry.isActive ? "Active" : "Paused"}
                      </span>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{intervalLabel(entry)}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{entry.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className={`font-medium ${overdue ? "text-red-600" : "text-gray-700"}`}>
                        {overdue ? "⚠ Overdue — " : "Next: "}
                        {dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span className="text-gray-400">·</span>
                      <span className="font-mono font-semibold text-gray-800">{fmt(totalDr)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => toggleActive(entry)} className="btn-secondary text-xs py-1 px-3">
                      {entry.isActive ? "Pause" : "Resume"}
                    </button>
                    <button onClick={() => openEdit(entry)} className="text-purple-500 hover:text-purple-700 text-xs px-2">Edit</button>
                    <button onClick={() => deleteEntry(entry.id)} className="text-red-400 hover:text-red-600 text-xs px-2">Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-10">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-3xl mx-4">
            <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Scheduled Payment" : "New Scheduled Payment"}</h2>

            {error && <p className="text-red-600 text-sm mb-4 p-2 bg-red-50 rounded border border-red-200">{error}</p>}

            {/* Name / Reference / Description */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">Name</label>
                <input className="input" placeholder="e.g. Office Rent" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Reference Prefix</label>
                <input className="input font-mono" placeholder="e.g. RENT" value={reference} onChange={(e) => setReference(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Auto-appended with year-month (e.g. RENT-2026-07)</p>
              </div>
              <div className="col-span-2">
                <label className="label">Description</label>
                <input className="input" placeholder="e.g. Monthly office rent payment" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            {/* Interval section */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Repeat Interval</p>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="label">Repeat every</label>
                  <div className="flex gap-2">
                    <input
                      type="number" min="1" max="365"
                      className="input w-24 text-center font-mono"
                      value={intervalValue}
                      onChange={(e) => setIntervalValue(e.target.value)}
                    />
                    <select className="input flex-1" value={intervalType} onChange={(e) => setIntervalType(e.target.value)}>
                      <option value="DAYS">Day(s)</option>
                      <option value="WEEKS">Week(s)</option>
                      <option value="MONTHS">Month(s)</option>
                      <option value="YEARS">Year(s)</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {intervalType === "DAYS"   && `e.g. 28 = every 28 days`}
                    {intervalType === "WEEKS"  && `e.g. 2 = fortnightly`}
                    {intervalType === "MONTHS" && `e.g. 3 = quarterly, 1 = monthly`}
                    {intervalType === "YEARS"  && `e.g. 1 = annually`}
                  </p>
                </div>

                {intervalType === "MONTHS" && (
                  <div>
                    <label className="label">Day of month</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="anchor" value="fixed" checked={anchorDay === "fixed"} onChange={() => setAnchorDay("fixed")} className="accent-purple-600" />
                        <span>Fixed day</span>
                        {anchorDay === "fixed" && (
                          <input type="number" min="1" max="28" className="input w-16 py-1 text-sm text-center font-mono" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
                        )}
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="anchor" value="rolling" checked={anchorDay === "rolling"} onChange={() => setAnchorDay("rolling")} className="accent-purple-600" />
                        <span>Rolling (same day as last posting)</span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {anchorDay === "fixed" ? `Posts on the ${ordinal(parseInt(dayOfMonth) || 1)} of each month` : "Counts forward from the last due date"}
                    </p>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="bg-purple-50 border border-purple-200 rounded px-3 py-2 text-sm text-purple-800 font-medium">
                📅 {buildPreview(intervalType, parseInt(intervalValue) || 1, intervalType === "MONTHS" && anchorDay === "fixed" ? parseInt(dayOfMonth) || 1 : null)}
              </div>

              <div className="mt-3">
                <label className="label">First / Next Due Date</label>
                <input type="date" className="input max-w-xs" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
              </div>
            </div>

            {/* Lines */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Account</th>
                    <th className="px-3 py-2 text-right w-36">Debit (£)</th>
                    <th className="px-3 py-2 text-right w-36">Credit (£)</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <select className="input py-1.5 text-sm" value={line.accountId} onChange={(e) => updateLine(i, "accountId", e.target.value)}>
                          <option value="">-- Choose Account --</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input className="input py-1.5 text-sm text-right font-mono" placeholder="0.00" value={line.debit} onChange={(e) => updateLine(i, "debit", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="input py-1.5 text-sm text-right font-mono" placeholder="0.00" value={line.credit} onChange={(e) => updateLine(i, "credit", e.target.value)} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => lines.length > 2 && setLines((p) => p.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 text-lg">−</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 flex items-center gap-3 text-sm">
                <button onClick={() => setLines((p) => [...p, emptyLine()])} className="btn-secondary py-1 px-3 text-xs">+ Add Line</button>
                <div className="ml-auto flex items-center gap-6">
                  <span className="font-medium">Debits: <span className="font-mono">£{totalDebits.toFixed(2)}</span></span>
                  <span className="font-medium">Credits: <span className="font-mono">£{totalCredits.toFixed(2)}</span></span>
                  {totalDebits > 0 && (balanced
                    ? <span className="text-green-600 text-xs bg-green-50 border border-green-200 rounded px-2 py-1">✓ Balanced</span>
                    : <span className="text-red-600 text-xs bg-red-50 border border-red-200 rounded px-2 py-1">⊗ Unbalanced</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildPreview(intervalType: string, intervalValue: number, dayOfMonth: number | null): string {
  const v = intervalValue;
  switch (intervalType) {
    case "DAYS":
      return v === 1 ? "Posts every day" : `Posts every ${v} days`;
    case "WEEKS":
      return v === 1 ? "Posts every week" : `Posts every ${v} weeks`;
    case "MONTHS":
      if (dayOfMonth) return v === 1 ? `Posts on the ${ordinal(dayOfMonth)} of every month` : `Posts on the ${ordinal(dayOfMonth)} every ${v} months`;
      return v === 1 ? "Posts every month (rolling from last post)" : `Posts every ${v} months (rolling)`;
    case "YEARS":
      return v === 1 ? "Posts once a year" : `Posts every ${v} years`;
    default:
      return "";
  }
}

function today() {
  return new Date().toISOString().split("T")[0];
}
