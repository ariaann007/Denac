"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/accounts", label: "Chart of Accounts" },
  { href: "/journal", label: "Journal" },
  { href: "/ledger", label: "Ledger" },
  { href: "/trial-balance", label: "Trial Balance" },
  { href: "/scheduled", label: "Scheduled" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="bg-purple-700 text-white shadow">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14">
        <span className="font-bold text-lg mr-6">Denac Accounts</span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              pathname === l.href
                ? "bg-amber-400 text-purple-900"
                : "hover:bg-purple-600"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
