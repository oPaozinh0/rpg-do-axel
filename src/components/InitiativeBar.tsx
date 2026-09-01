"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InitiativeEntry } from "@/lib/types";

/** Mostra a ordem de iniciativa e o turno atual, ao vivo, para todos. */
export function InitiativeBar({ campaignId }: { campaignId: string }) {
  const supabase = useRef(createClient());
  const [entries, setEntries] = useState<InitiativeEntry[]>([]);

  useEffect(() => {
    const sb = supabase.current;
    sb.from("initiative_entries")
      .select("*")
      .eq("campaign_id", campaignId)
      .then(({ data }) => setEntries((data ?? []) as InitiativeEntry[]));

    const channel = sb
      .channel(`initiative:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "initiative_entries",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          setEntries((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((e) => e.id !== (payload.old as InitiativeEntry).id);
            }
            const row = payload.new as InitiativeEntry;
            return prev.some((e) => e.id === row.id)
              ? prev.map((e) => (e.id === row.id ? row : e))
              : [...prev, row];
          });
        }
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [campaignId]);

  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => b.initiative - a.initiative);

  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-lg border border-border bg-surface p-2">
      <span className="shrink-0 text-xs font-bold uppercase text-muted">
        ⚔️ Iniciativa
      </span>
      {sorted.map((e) => (
        <div
          key={e.id}
          className={`flex shrink-0 items-center gap-2 rounded px-2 py-1 text-sm ${
            e.is_active
              ? "bg-primary text-primary-foreground"
              : "bg-surface-2 text-foreground"
          }`}
        >
          <span className="font-mono font-bold">{e.initiative}</span>
          <span className="max-w-[120px] truncate">{e.name}</span>
          {e.current_hp != null && (
            <span className="text-xs opacity-80">❤️{e.current_hp}</span>
          )}
        </div>
      ))}
    </div>
  );
}
