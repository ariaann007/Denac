import { prisma } from "@/lib/db";

export async function GET() {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    include: { lines: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  const rows = accounts.map((account) => {
    const totalDebit = account.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = account.lines.reduce((s, l) => s + l.credit, 0);

    let debitBalance = 0;
    let creditBalance = 0;

    const isDebitNormal = account.type === "ASSET" || account.type === "EXPENSE";
    const net = totalDebit - totalCredit;

    if (isDebitNormal) {
      if (net >= 0) debitBalance = net;
      else creditBalance = -net;
    } else {
      if (net <= 0) creditBalance = -net;
      else debitBalance = net;
    }

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      totalDebit,
      totalCredit,
      debitBalance,
      creditBalance,
    };
  });

  const totals = {
    totalDebit: rows.reduce((s, r) => s + r.totalDebit, 0),
    totalCredit: rows.reduce((s, r) => s + r.totalCredit, 0),
    debitBalance: rows.reduce((s, r) => s + r.debitBalance, 0),
    creditBalance: rows.reduce((s, r) => s + r.creditBalance, 0),
  };

  return Response.json({ rows, totals });
}
