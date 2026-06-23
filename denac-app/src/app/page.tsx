export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import Link from "next/link";

async function getStats() {
  const [accountCount, journalCount, accounts] = await Promise.all([
    prisma.account.count(),
    prisma.journalEntry.count(),
    prisma.account.findMany({ include: { lines: true } }),
  ]);

  const bankAccounts = accounts.filter((a) => a.subtype === "BANK" || a.subtype === "CASH");
  const bankBalances = bankAccounts.map((a) => {
    const debit = a.lines.reduce((s, l) => s + l.debit, 0);
    const credit = a.lines.reduce((s, l) => s + l.credit, 0);
    return { id: a.id, name: a.name, balance: debit - credit };
  });

  const totalAssets = accounts
    .filter((a) => a.type === "ASSET")
    .reduce((s, a) => {
      const d = a.lines.reduce((x, l) => x + l.debit, 0);
      const c = a.lines.reduce((x, l) => x + l.credit, 0);
      return s + (d - c);
    }, 0);

  const totalLiabilities = accounts
    .filter((a) => a.type === "LIABILITY")
    .reduce((s, a) => {
      const d = a.lines.reduce((x, l) => x + l.debit, 0);
      const c = a.lines.reduce((x, l) => x + l.credit, 0);
      return s + (c - d);
    }, 0);

  const debtorAccounts = accounts.filter((a) => a.subtype === "DEBTOR");
  const creditorAccounts = accounts.filter((a) => a.subtype === "CREDITOR");

  const debtorBalance = debtorAccounts.reduce((s, a) => {
    const d = a.lines.reduce((x, l) => x + l.debit, 0);
    const c = a.lines.reduce((x, l) => x + l.credit, 0);
    return s + (d - c);
  }, 0);

  const creditorBalance = creditorAccounts.reduce((s, a) => {
    const d = a.lines.reduce((x, l) => x + l.debit, 0);
    const c = a.lines.reduce((x, l) => x + l.credit, 0);
    return s + (c - d);
  }, 0);

  return { accountCount, journalCount, bankBalances, totalAssets, totalLiabilities, debtorBalance, creditorBalance };
}

export default async function Dashboard() {
  const stats = await getStats();
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Accounts" value={String(stats.accountCount)} />
        <StatCard label="Journal Entries" value={String(stats.journalCount)} />
        <StatCard label="Total Assets" value={fmt(stats.totalAssets)} />
        <StatCard label="Total Liabilities" value={fmt(stats.totalLiabilities)} />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-lg mb-3">Bank &amp; Cash Accounts</h2>
          {stats.bankBalances.length === 0 ? (
            <p className="text-gray-400 text-sm">No bank or cash accounts yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {stats.bankBalances.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2">
                      <Link href={`/ledger/${b.id}`} className="text-indigo-700 hover:underline">
                        {b.name}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-mono font-medium">{fmt(b.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-lg mb-3">Debtors &amp; Creditors</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Debtors (owed to you)</span>
              <span className="font-mono font-semibold text-green-700">{fmt(stats.debtorBalance)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Creditors (you owe)</span>
              <span className="font-mono font-semibold text-red-700">{fmt(stats.creditorBalance)}</span>
            </div>
          </div>
        </div>
      </div>

      {stats.accountCount === 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <strong>Get started:</strong> You have no accounts yet. Visit{" "}
          <Link href="/accounts" className="text-indigo-700 underline">
            Chart of Accounts
          </Link>{" "}
          to add accounts, or use the seed button to load defaults.
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <QuickLink href="/journal" label="New Journal Entry" desc="Record a double-entry transaction" />
        <QuickLink href="/accounts" label="Manage Accounts" desc="Add or edit accounts in your chart" />
        <QuickLink href="/trial-balance" label="Trial Balance" desc="Check debits equal credits" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function QuickLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link href={href} className="bg-white rounded-xl shadow p-4 hover:shadow-md transition-shadow block">
      <p className="font-semibold text-indigo-700">{label}</p>
      <p className="text-gray-500 mt-1">{desc}</p>
    </Link>
  );
}
