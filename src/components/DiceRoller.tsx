"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { rollDice } from "@/lib/dnd";
import type { DiceRoll } from "@/lib/types";

const QUICK = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

export function DiceRoller({
  campaignId,
  userId,
  isMaster,
  initialRolls,
  nameMap,
}: {
  campaignId: string;
  userId: string;
  isMaster: boolean;
  initialRolls: DiceRoll[];
  nameMap: Record<string, string>;
}) {
  const supabase = useRef(createClient());
  const [rolls, setRolls] = useState<DiceRoll[]>(initialRolls);
  const [formula, setFormula] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sb = supabase.current;
    const channel = sb
      .channel(`dice:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dice_rolls",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const row = payload.new as DiceRoll;
          // RLS já filtra no fetch, mas o realtime entrega tudo —
          // esconde rolagens privadas de terceiros aqui também.
          if (row.is_private && row.user_id !== userId && !isMaster) return;
          setRolls((prev) =>
            prev.some((r) => r.id === row.id) ? prev : [...prev, row]
          );
        }
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [campaignId, userId, isMaster]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [rolls]);

  async function roll(f: string) {
    const result = rollDice(f);
    if (!result) {
      alert("Fórmula inválida. Ex: d20, 2d6+3, 1d8-1");
      return;
    }
    const { data } = await supabase.current
      .from("dice_rolls")
      .insert({
        campaign_id: campaignId,
        user_id: userId,
        formula: result.formula,
        result: result.total,
        detail: result.detail,
        is_private: isPrivate,
      })
      .select("*")
      .single();
    // Otimista: adiciona já (o realtime pode ecoar, mas deduplica por id).
    if (data)
      setRolls((prev) =>
        prev.some((r) => r.id === (data as DiceRoll).id)
          ? prev
          : [...prev, data as DiceRoll]
      );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Controles */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-primary">🎲 Rolar Dados</h3>
        <div className="grid grid-cols-4 gap-2">
          {QUICK.map((d) => (
            <button
              key={d}
              className="btn-secondary"
              onClick={() => roll(d)}
            >
              {d}
            </button>
          ))}
          <button className="btn-secondary" onClick={() => roll("2d20")}>
            2d20
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (formula.trim()) {
              roll(formula.trim());
              setFormula("");
            }
          }}
          className="space-y-2"
        >
          <input
            className="input"
            placeholder="Fórmula: 2d6+3, 1d20+5..."
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
          />
          <button className="btn-primary w-full" type="submit">
            Rolar fórmula
          </button>
        </form>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          Rolagem privada {isMaster ? "(só você)" : "(só você e o mestre)"}
        </label>
      </div>

      {/* Log */}
      <div className="card flex flex-col">
        <h3 className="mb-2 font-semibold text-primary">Histórico</h3>
        <div
          ref={logRef}
          className="flex max-h-[60vh] flex-col gap-2 overflow-auto"
        >
          {rolls.length === 0 && (
            <p className="text-sm text-muted">Nenhuma rolagem ainda.</p>
          )}
          {rolls.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded border border-border bg-surface-2 px-3 py-2"
            >
              <div className="text-2xl font-bold text-primary">{r.result}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">
                    {nameMap[r.user_id] ?? "Alguém"}
                  </span>
                  <span className="text-muted">rolou {r.formula}</span>
                  {r.is_private && (
                    <span className="rounded bg-accent/30 px-1 text-[10px] text-foreground">
                      privado
                    </span>
                  )}
                </div>
                <div className="truncate font-mono text-xs text-muted">
                  {r.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
