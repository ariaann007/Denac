import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { code, name, type, subtype, description, isActive } = body;

  const account = await prisma.account.update({
    where: { id },
    data: { code, name, type, subtype, description, isActive },
  });
  return Response.json(account);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.account.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
