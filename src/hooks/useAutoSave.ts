"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Mantém o estado de uma linha e salva alterações no Supabase com debounce.
 * Retorna o estado atual, um setter por patch e o status do salvamento.
 */
export function useAutoSave<T extends { id: string }>(
  table: string,
  initial: T,
  canEdit: boolean,
  delay = 700
) {
  const [data, setData] = useState<T>(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const pending = useRef<Partial<T>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useRef(createClient());

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    setStatus("saving");
    const { error } = await supabase.current
      .from(table)
      .update(patch as never)
      .eq("id", data.id);
    setStatus(error ? "error" : "saved");
    if (!error) setTimeout(() => setStatus("idle"), 1200);
  }, [table, data.id]);

  const update = useCallback(
    (patch: Partial<T>) => {
      if (!canEdit) return;
      setData((d) => ({ ...d, ...patch }));
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [canEdit, delay, flush]
  );

  // Salva pendências ao desmontar.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { data, update, status, setData };
}
