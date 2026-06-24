import { prisma } from "@/lib/db";

export async function GET() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);

  // Count entries already created this month
  const count = await prisma.journalEntry.count({
    where: { date: { gte: monthStart, lt: monthEnd } },
  });

  const ym = `${year}${String(month + 1).padStart(2, "0")}`;
  const seq = String(count + 1).padStart(3, "0");
  const reference = `JNL-${ym}-${seq}`;

  return Response.json({ reference });
}
