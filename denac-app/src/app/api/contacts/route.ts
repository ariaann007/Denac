import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    include: {
      lines: { include: { journalEntry: true } }
    },
    orderBy: { name: "asc" },
  });

  const result = contacts.map((c) => {
    const totalDebit = c.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = c.lines.reduce((s, l) => s + l.credit, 0);
    const balance = totalDebit - totalCredit;
    const status = balance > 0.005 ? "DEBTOR" : balance < -0.005 ? "CREDITOR" : "NEUTRAL";
    return { ...c, totalDebit, totalCredit, balance, status };
  });

  return Response.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, phone, notes } = body;
  if (!name?.trim()) return Response.json({ error: "Name is required" }, { status: 400 });
  const contact = await prisma.contact.create({
    data: { name: name.trim(), email: email || null, phone: phone || null, notes: notes || null },
  });
  return Response.json(contact, { status: 201 });
}
