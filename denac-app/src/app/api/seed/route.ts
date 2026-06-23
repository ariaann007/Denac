import { prisma } from "@/lib/db";

const DEFAULT_ACCOUNTS = [
  { code: "1000", name: "Cash on Hand", type: "ASSET", subtype: "CASH" },
  { code: "1100", name: "Barclays Bank Account", type: "ASSET", subtype: "BANK" },
  { code: "1200", name: "HSBC Bank Account", type: "ASSET", subtype: "BANK" },
  { code: "1300", name: "Petty Cash", type: "ASSET", subtype: "CASH" },
  { code: "1400", name: "Debtors Control", type: "ASSET", subtype: "DEBTOR" },
  { code: "1500", name: "Prepayments", type: "ASSET", subtype: null },
  { code: "2000", name: "Creditors Control", type: "LIABILITY", subtype: "CREDITOR" },
  { code: "2100", name: "Accruals", type: "LIABILITY", subtype: null },
  { code: "2200", name: "VAT Payable", type: "LIABILITY", subtype: null },
  { code: "3000", name: "Owner's Capital", type: "EQUITY", subtype: null },
  { code: "3100", name: "Retained Earnings", type: "EQUITY", subtype: null },
  { code: "4000", name: "Sales Revenue", type: "INCOME", subtype: null },
  { code: "4100", name: "Service Income", type: "INCOME", subtype: null },
  { code: "5000", name: "Cost of Sales", type: "EXPENSE", subtype: null },
  { code: "5100", name: "Salaries & Wages", type: "EXPENSE", subtype: null },
  { code: "5200", name: "Rent & Rates", type: "EXPENSE", subtype: null },
  { code: "5300", name: "Utilities", type: "EXPENSE", subtype: null },
  { code: "5400", name: "Office Supplies", type: "EXPENSE", subtype: null },
  { code: "5500", name: "Bank Charges", type: "EXPENSE", subtype: null },
];

export async function POST() {
  const existing = await prisma.account.count();
  if (existing > 0) {
    return Response.json({ message: "Accounts already seeded" });
  }

  await prisma.account.createMany({ data: DEFAULT_ACCOUNTS });
  return Response.json({ message: "Default chart of accounts created", count: DEFAULT_ACCOUNTS.length });
}
