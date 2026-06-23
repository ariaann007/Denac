import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return Response.json({ error: "Not found" }, { status: 404 });

  const lines = await prisma.journalLine.findMany({
    where: { accountId },
    include: {
      journalEntry: true,
    },
    orderBy: { journalEntry: { date: "asc" } },
  });

  let balance = 0;
  const rows = lines.map((line) => {
    // For ASSET and EXPENSE: debit increases balance; for LIABILITY, EQUITY, INCOME: credit increases
    const isDebitNormal = account.type === "ASSET" || account.type === "EXPENSE";
    if (isDebitNormal) {
      balance += line.debit - line.credit;
    } else {
      balance += line.credit - line.debit;
    }
    return {
      id: line.id,
      date: line.journalEntry.date,
      reference: line.journalEntry.reference,
      description: line.description || line.journalEntry.description,
      debit: line.debit,
      credit: line.credit,
      balance,
    };
  });

  return Response.json({ account, rows, closingBalance: balance });
}
