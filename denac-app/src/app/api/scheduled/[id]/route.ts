import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, reference, description, frequency, dayOfMonth, nextDueDate, isActive, lines } = body;

  const entry = await prisma.scheduledEntry.update({
    where: { id },
    data: {
      name,
      reference,
      description,
      frequency,
      dayOfMonth,
      nextDueDate: new Date(nextDueDate),
      isActive,
      lines: lines
        ? {
            deleteMany: {},
            create: lines.map((l: { accountId: string; debit: number; credit: number }) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
            })),
          }
        : undefined,
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
  await prisma.scheduledEntry.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
