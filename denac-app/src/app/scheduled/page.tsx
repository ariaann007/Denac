"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Account = { id: string; code: string; name: string };
type SLine = { accountId: string; debit: string; credit: string };

type Occurrence = {
  entryId: string; entryName: string; reference: string;
  date: string; week: string; amount: number;
  lines: { accountId: string; accountName: string; accountType: string; debit: number; credit: number }[];
};
type WeekBucket = { weekStart: string; total: number; occurrences: Occurrence[] };
type Warning = { date: string; entryName: string; accountName: string; required: number; available: number; shortfall: number };
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
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<{ posted: string[]; count: number } | null>(null);
  const [forecast, setForecast] = useState<{ weeks: WeekBucket[]; warnings: Warning[] } | null>(null);
  const [showForecast, setShowForecast] = useState(true);

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
      fetch("/api/scheduled/upcoming").then((r) => r.json()),
    ]).then(([s, a, f]) => { setEntries(s); setAccounts(a); setForecast(f); });
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

  const postDue = async () => {
    setPosting(true);
    setPostResult(null);
    const res = await fetch("/api/cron/process-scheduled", { method: "POST" });
    const data = await res.json();
    setPostResult(data);
    setPosting(false);
    load(); // refresh dates
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
        <div className="flex gap-2">
          <button
            onClick={postDue}
            disabled={posting}
            className="btn-secondary disabled:opacity-50 flex items-center gap-1.5"
          >
            {posting ? (
              <><span className="animate-spin inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full"></span> Posting…</>
            ) : (
              "▶ Post Due Entries"
            )}
          </button>
          <button onClick={openCreate} className="btn-primary">+ New Schedule</button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        Set up recurring journal entries for direct debits, standing orders and regular payments. They post automatically each day at 6am, or click <strong>Post Due Entries</strong> to post now.
      </p>

      {postResult && (
        <div className={`rounded-lg px-4 py-3 mb-4 text-sm flex items-start gap-2 ${postResult.count > 0 ? "bg-green-50 border border-green-200 text-green-800" : "bg-gray-50 border border-gray-200 text-gray-600"}`}>
          {postResult.count > 0 ? (
            <>
              <span className="text-lg leading-none">✓</span>
              <div>
                <p className="font-semibold">{postResult.count} entr{postResult.count === 1 ? "y" : "ies"} posted to the journal</p>
                <p className="text-xs mt-0.5 font-mono">{postResult.posted.join(", ")}</p>
                <p className="text-xs mt-1 text-green-700">These now appear in the Journal, Ledger and Trial Balance.</p>
              </div>
            </>
          ) : (
            <>
              <span>ℹ</span>
              <p>No entries are due today — nothing to post.</p>
            </>
          )}
          <button onClick={() => setPostResult(null)} className="ml-auto text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>
      )}

      {/* Cash Flow Forecast */}
      {forecast && (forecast.weeks.length > 0 || forecast.warnings.length > 0) && (
        <div className="bg-white rounded-xl shadow mb-6 overflow-hidden">
          <button
            onClick={() => setShowForecast(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📊</span>
              <span className="font-semibold text-gray-800">8-Week Cash Flow Forecast</span>
              {forecast.warnings.length > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {forecast.warnings.length} balance warning{forecast.warnings.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <span className="text-gray-400 text-sm">{showForecast ? "▲ Hide" : "▼ Show"}</span>
          </button>

          {showForecast && (
            <div className="border-t border-gray-100">
              {/* Balance warnings */}
              {forecast.warnings.length > 0 && (
                <div className="bg-red-50 border-b border-red-100 px-5 py-3 space-y-2">
                  <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5">⚠ Insufficient balance warnings</p>
                  {forecast.warnings.map((w, i) => (
                    <div key={i} className="text-sm text-red-700 bg-white border border-red-200 rounded px-3 py-2 flex items-center justify-between gap-4">
                      <div>
                        <span className="font-medium">{w.entryName}</span>
                        <span className="text-red-400 mx-1.5">·</span>
                        <span>{new Date(w.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <span className="text-red-400 mx-1.5">·</span>
                        <span className="text-gray-600">{w.accountName}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-gray-500">Available: <span className="font-mono">{fmt(w.available)}</span></div>
                        <div className="text-xs font-semibold text-red-700">Shortfall: <span className="font-mono">-{fmt(w.shortfall)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Weekly totals */}
              {forecast.weeks.length > 0 ? (
                <div className="px-5 py-4">
                  <div className="grid grid-cols-1 gap-2">
                    {forecast.weeks.map((week) => {
                      const wStart = new Date(week.weekStart + "T00:00:00");
                      const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6);
                      const hasWarning = forecast.warnings.some(w => w.date >= week.weekStart && w.date <= wEnd.toISOString().split("T")[0]);
                      return (
                        <div key={week.weekStart} className={`rounded-lg border px-4 py-3 ${hasWarning ? "border-red-200 bg-red-50" : "border-gray-100 bg-gray-50"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-700">
                              {wStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                              {" – "}
                              {wEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                            <span className={`font-mono font-bold text-sm ${hasWarning ? "text-red-700" : "text-gray-800"}`}>
                              {fmt(week.total)}
                              {hasWarning && <span className="ml-2 text-xs font-normal text-red-600">⚠ low balance</span>}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {week.occurrences.map((occ, i) => (
                              <div key={i} className="flex items-center justify-between text-xs text-gray-500">
                                <span>
                                  {new Date(occ.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                                  <span className="mx-1.5 text-gray-300">·</span>
                                  {occ.entryName}
                                </span>
                                <span className="font-mono text-gray-700">{fmt(occ.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Forecast based on scheduled entry due dates for the next 8 weeks. Balances are checked against current account balances.
                  </p>
                </div>
              ) : (
                <div className="px-5 py-6 text-center text-sm text-gray-400">No payments scheduled in the next 8 weeks.</div>
              )}
            </div>
          )}
        </div>
      )}

      {(() => {
        const dueCount = entries.filter(e => e.isActive && new Date(e.nextDueDate) <= new Date()).length;
        return dueCount > 0 && !postResult ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3 text-sm text-amber-800">
            <span className="text-lg">⚠</span>
            <div className="flex-1">
              <strong>{dueCount} payment{dueCount > 1 ? "s" : ""} due</strong> and not yet posted.
              Click <strong>Post Due Entries</strong> to post them to the journal now.
            </div>
          </div>
        ) : null;
      })()}

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
