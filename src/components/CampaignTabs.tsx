"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  href: string;
  label: string;
  masterOnly?: boolean;
}

export function CampaignTabs({
  campaignId,
  isMaster,
}: {
  campaignId: string;
  isMaster: boolean;
}) {
  const pathname = usePathname();
  const base = `/campanhas/${campaignId}`;

  const tabs: Tab[] = [
    { href: `${base}/mapa`, label: "🗺️ Mapa" },
    { href: `${base}/personagens`, label: "🛡️ Fichas" },
    { href: `${base}/dados`, label: "🎲 Dados" },
    { href: `${base}/mestre`, label: "📖 Mestre", masterOnly: true },
  ];

  const visible = tabs.filter((t) => !t.masterOnly || isMaster);

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border">
      {visible.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
