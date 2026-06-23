import { prisma } from "@/lib/db";

function nextDate(
  current: Date,
  intervalType: string,
  intervalValue: number,
  dayOfMonth: number | null
): Date {
  const d = new Date(current);
  if (intervalType === "DAYS") {
    d.setDate(d.getDate() + intervalValue);
  } else if (intervalType === "WEEKS") {
    d.setDate(d.getDate() + intervalValue * 7);
  } else if (intervalType === "MONTHS") {
    d.setMonth(d.getMonth() + intervalValue);
    if (dayOfMonth !== null) {
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(dayOfMonth, maxDay));
    }
  } else if (intervalType === "YEARS") {
    d.setFullYear(d.getFullYear() + intervalValue);
    if (dayOfMonth !== null) {
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(dayOfMonth, maxDay));
    }
  }
  return d;
}

export async function GET() {
  const [entries, accounts] = await Promise.all([
    prisma.scheduledEntry.findMany({
      where: { isActive: true },
      include: { lines: { include: { account: true } } },
    }),
    prisma.account.findMany({
      where: { isActive: true },
      include: { lines: true },
    }),
  ]);

  // Build current balance map for every account
  const balanceMap: Record<string, number> = {};
  for (const acc of accounts) {
    const totalDebit = acc.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = acc.lines.reduce((s, l) => s + l.credit, 0);
    const isDebitNormal = acc.type === "ASSET" || acc.type === "EXPENSE";
    balanceMap[acc.id] = isDebitNormal ? totalDebit - totalCredit : totalCredit - totalDebit;
  }

  // Project occurrences for the next 8 weeks (56 days)
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 56);

  // Week bucket helper: ISO week start (Monday)
  function weekStart(d: Date): string {
    const day = new Date(d);
    const dow = day.getDay();
    const diff = (dow === 0 ? -6 : 1) - dow; // shift to Monday
    day.setDate(day.getDate() + diff);
    return day.toISOString().split("T")[0];
  }

  type Occurrence = {
    entryId: string;
    entryName: string;
    reference: string;
    date: string;
    week: string;
    amount: number; // total debit side (always positive)
    lines: { accountId: string; accountName: string; accountType: string; debit: number; credit: number }[];
  };

  const occurrences: Occurrence[] = [];

  for (const entry of entries) {
    let due = new Date(entry.nextDueDate);
    due.setHours(0, 0, 0, 0);

    // Walk forward collecting all occurrences within the horizon
    // Start from nextDueDate; if it's already past, start there (overdue)
    for (let iter = 0; iter < 100; iter++) {
      if (due > horizon) break;
      occurrences.push({
        entryId: entry.id,
        entryName: entry.name,
        reference: entry.reference,
        date: due.toISOString().split("T")[0],
        week: weekStart(due),
        amount: entry.lines.reduce((s, l) => s + l.debit, 0),
        lines: entry.lines.map((l) => ({
          accountId: l.accountId,
          accountName: l.account.name,
          accountType: l.account.type,
          debit: l.debit,
          credit: l.credit,
        })),
      });
      due = nextDate(due, entry.intervalType, entry.intervalValue, entry.dayOfMonth);
    }
  }

  occurrences.sort((a, b) => a.date.localeCompare(b.date));

  // Group by week
  const weekMap: Record<string, { weekStart: string; total: number; occurrences: Occurrence[] }> = {};
  for (const occ of occurrences) {
    if (!weekMap[occ.week]) weekMap[occ.week] = { weekStart: occ.week, total: 0, occurrences: [] };
    weekMap[occ.week].total += occ.amount;
    weekMap[occ.week].occurrences.push(occ);
  }
  const weeks = Object.values(weekMap).sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Balance warnings: for each upcoming occurrence, find ASSET accounts being credited
  // (money leaving the business) and check if balance covers it
  // Simulate running balance as payments are made
  const runningBalance: Record<string, number> = { ...balanceMap };
  const warnings: {
    date: string;
    entryName: string;
    accountName: string;
    required: number;
    available: number;
    shortfall: number;
  }[] = [];

  for (const occ of occurrences) {
    for (const line of occ.lines) {
      if (line.credit > 0 && line.accountType === "ASSET") {
        const avail = runningBalance[line.accountId] ?? 0;
        if (avail < line.credit) {
          warnings.push({
            date: occ.date,
            entryName: occ.entryName,
            accountName: line.accountName,
            required: line.credit,
            available: Math.max(avail, 0),
            shortfall: line.credit - Math.max(avail, 0),
          });
        }
      }
      // Update running balance after this payment
      if (line.accountType === "ASSET" || line.accountType === "EXPENSE") {
        runningBalance[line.accountId] = (runningBalance[line.accountId] ?? 0) + line.debit - line.credit;
      } else {
        runningBalance[line.accountId] = (runningBalance[line.accountId] ?? 0) + line.credit - line.debit;
      }
    }
  }

  return Response.json({ weeks, warnings, occurrences });
}
