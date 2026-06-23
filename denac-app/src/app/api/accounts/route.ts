import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const accounts = await prisma.account.findMany({
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });
  return Response.json(accounts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { code, name, type, subtype, description } = body;

  if (!code || !name || !type) {
    return Response.json({ error: "code, name, and type are required" }, { status: 400 });
  }

  const account = await prisma.account.create({
    data: { code, name, type, subtype, description },
  });
  return Response.json(account, { status: 201 });
}
