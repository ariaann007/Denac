import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const entries = await prisma.scheduledEntry.findMany({
    include: { lines: { include: { account: true } } },
    orderBy: { nextDueDate: "asc" },
  });
  return Response.json(entries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, reference, description, intervalType, intervalValue, dayOfMonth, nextDueDate, lines } = body;

  if (!name || !reference || !description || !intervalType || !nextDueDate || !lines?.length) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const entry = await prisma.scheduledEntry.create({
    data: {
      name,
      reference,
      description,
      intervalType,
      intervalValue: intervalValue ?? 1,
      dayOfMonth: dayOfMonth ?? null,
      nextDueDate: new Date(nextDueDate),
      lines: {
        create: lines.map((l: { accountId: string; debit: number; credit: number }) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
        })),
      },
    },
    include: { lines: { include: { account: true } } },
  });

  return Response.json(entry, { status: 201 });
}
