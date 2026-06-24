import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, email, phone, notes } = await request.json();
  const contact = await prisma.contact.update({
    where: { id },
    data: { name: name.trim(), email: email || null, phone: phone || null, notes: notes || null },
  });
  return Response.json(contact);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
