import { prisma } from "@/lib/db";

function nextDate(current: Date, intervalType: string, intervalValue: number, dayOfMonth: number | null): Date {
  const d = new Date(current);

  if (intervalType === "DAYS") {
    d.setDate(d.getDate() + intervalValue);
  } else if (intervalType === "WEEKS") {
    d.setDate(d.getDate() + intervalValue * 7);
  } else if (intervalType === "MONTHS") {
    d.setMonth(d.getMonth() + intervalValue);
    if (dayOfMonth !== null) {
      // Anchor to specific day — clamp to last day of month
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
  return processScheduled();
}

export async function POST() {
  return processScheduled();
}

async function processScheduled() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const due = await prisma.scheduledEntry.findMany({
    where: { isActive: true, nextDueDate: { lte: now } },
    include: { lines: true },
  });

  const posted: string[] = [];

  for (const entry of due) {
    const ym = `${entry.nextDueDate.getFullYear()}-${String(entry.nextDueDate.getMonth() + 1).padStart(2, "0")}`;
    const reference = `${entry.reference}-${ym}`;

    await prisma.journalEntry.create({
      data: {
        date: entry.nextDueDate,
        reference,
        description: entry.description,
        lines: {
          create: entry.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: entry.description,
          })),
        },
      },
    });

    const next = nextDate(entry.nextDueDate, entry.intervalType, entry.intervalValue, entry.dayOfMonth);
    await prisma.scheduledEntry.update({
      where: { id: entry.id },
      data: { nextDueDate: next },
    });

    posted.push(reference);
  }

  return Response.json({ posted, count: posted.length });
}
