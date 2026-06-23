import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: { lines: { include: { account: true } } },
  });
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(entry);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { date, reference, description, lines } = body;

  if (!date || !reference || !description || !lines?.length) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const totalDebit  = lines.reduce((s: number, l: { debit: number }) => s + l.debit, 0);
  const totalCredit = lines.reduce((s: number, l: { credit: number }) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    return Response.json({ error: "Entry is not balanced" }, { status: 400 });
  }

  const entry = await prisma.journalEntry.update({
    where: { id },
    data: {
      date: new Date(date),
      reference,
      description,
      lines: {
        deleteMany: {},
        create: lines.map((l: { accountId: string; debit: number; credit: number; description?: string }) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description ?? description,
        })),
      },
    },
    include: { lines: { include: { account: true } } },
  });

  return Response.json(entry);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.journalEntry.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
