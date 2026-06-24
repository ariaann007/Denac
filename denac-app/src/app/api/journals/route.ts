import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const entries = await prisma.journalEntry.findMany({
    include: {
      lines: {
        include: { account: true },
      },
    },
    orderBy: { date: "desc" },
  });
  return Response.json(entries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date, reference, description, lines } = body;

  if (!date || !reference || !description || !lines?.length) {
    return Response.json({ error: "date, reference, description, and lines are required" }, { status: 400 });
  }

  const totalDebit = lines.reduce((s: number, l: { debit: number }) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s: number, l: { credit: number }) => s + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return Response.json(
      { error: `Journal is not balanced. Debits: ${totalDebit.toFixed(2)}, Credits: ${totalCredit.toFixed(2)}` },
      { status: 400 }
    );
  }

  const entry = await prisma.journalEntry.create({
    data: {
      date: new Date(date),
      reference,
      description,
      lines: {
        create: lines.map((l: { accountId: string; debit: number; credit: number; description?: string; contactId?: string | null }) => ({
          accountId: l.accountId,
          debit: l.debit || 0,
          credit: l.credit || 0,
          description: l.description,
          contactId: l.contactId || null,
        })),
      },
    },
    include: {
      lines: { include: { account: true } },
    },
  });

  return Response.json(entry, { status: 201 });
}
