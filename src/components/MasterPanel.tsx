"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CampaignMember, CampaignNote, InitiativeEntry } from "@/lib/types";

export function MasterPanel({
  campaignId,
  initialNotes,
  initialInitiative,
  members,
}: {
  campaignId: string;
  initialNotes: CampaignNote[];
  initialInitiative: InitiativeEntry[];
  members: CampaignMember[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <InitiativeTracker
          campaignId={campaignId}
          initial={initialInitiative}
        />
        <NotesManager campaignId={campaignId} initial={initialNotes} />
      </div>
      <MembersList members={members} />
    </div>
  );
}

// ---------------- Iniciativa ----------------
function InitiativeTracker({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: InitiativeEntry[];
}) {
  const supabase = useRef(createClient());
  const [entries, setEntries] = useState<InitiativeEntry[]>(initial);
  const [name, setName] = useState("");
  const [init, setInit] = useState("");

  const sorted = [...entries].sort((a, b) => b.initiative - a.initiative);
  const activeId = entries.find((e) => e.is_active)?.id;

  async function add() {
    if (!name.trim()) return;
    const { data } = await supabase.current
      .from("initiative_entries")
      .insert({
        campaign_id: campaignId,
        name: name.trim(),
        initiative: parseInt(init, 10) || 0,
      })
      .select("*")
      .single();
    if (data) setEntries((p) => [...p, data as InitiativeEntry]);
    setName("");
    setInit("");
  }

  async function patch(id: string, p: Partial<InitiativeEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...p } : e)));
    await supabase.current
      .from("initiative_entries")
      .update(p as never)
      .eq("id", id);
  }

  async function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await supabase.current.from("initiative_entries").delete().eq("id", id);
  }

  async function setActive(id: string) {
    setEntries((prev) =>
      prev.map((e) => ({ ...e, is_active: e.id === id }))
    );
    await supabase.current
      .from("initiative_entries")
      .update({ is_active: false } as never)
      .eq("campaign_id", campaignId);
    await supabase.current
      .from("initiative_entries")
      .update({ is_active: true } as never)
      .eq("id", id);
  }

  function nextTurn() {
    if (sorted.length === 0) return;
    const idx = sorted.findIndex((e) => e.id === activeId);
    const next = sorted[(idx + 1) % sorted.length];
    setActive(next.id);
  }

  async function clearAll() {
    if (!confirm("Limpar toda a iniciativa?")) return;
    setEntries([]);
    await supabase.current
      .from("initiative_entries")
      .delete()
      .eq("campaign_id", campaignId);
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary">⚔️ Iniciativa / Combate</h3>
        <div className="flex gap-2">
          <button className="btn-primary text-xs" onClick={nextTurn}>
            Próximo turno →
          </button>
          {entries.length > 0 && (
            <button className="btn-ghost text-xs" onClick={clearAll}>
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Nome (PJ ou inimigo)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <input
          className="input w-20 text-center"
          placeholder="Init"
          type="number"
          value={init}
          onChange={(e) => setInit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="btn-secondary" onClick={add}>
          +
        </button>
      </div>

      <div className="space-y-1">
        {sorted.length === 0 && (
          <p className="text-sm text-muted">Adicione combatentes à ordem.</p>
        )}
        {sorted.map((e) => (
          <div
            key={e.id}
            className={`flex items-center gap-2 rounded border px-2 py-1.5 ${
              e.id === activeId
                ? "border-primary bg-primary/10"
                : "border-border"
            }`}
          >
            <button
              className="w-8 shrink-0 text-center font-mono font-bold text-primary"
              title="Tornar ativo"
              onClick={() => setActive(e.id)}
            >
              {e.initiative}
            </button>
            <span className="flex-1 truncate text-sm">{e.name}</span>
            <input
              type="number"
              className="input w-16 px-1 py-0.5 text-center text-xs"
              placeholder="PV"
              value={e.current_hp ?? ""}
              onChange={(ev) =>
                patch(e.id, {
                  current_hp: ev.target.value
                    ? parseInt(ev.target.value, 10)
                    : null,
                })
              }
            />
            <button
              className="text-xs text-danger"
              onClick={() => remove(e.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Notas ----------------
function NotesManager({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: CampaignNote[];
}) {
  const supabase = useRef(createClient());
  const [notes, setNotes] = useState<CampaignNote[]>(initial);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  async function add() {
    const { data } = await supabase.current
      .from("campaign_notes")
      .insert({ campaign_id: campaignId, title: "Nova nota", body: "" })
      .select("*")
      .single();
    if (data) setNotes((p) => [data as CampaignNote, ...p]);
  }

  function edit(id: string, p: Partial<CampaignNote>) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...p } : n)));
    if (timers.current[id]) clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      supabase.current
        .from("campaign_notes")
        .update(p as never)
        .eq("id", id)
        .then();
    }, 600);
  }

  async function remove(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await supabase.current.from("campaign_notes").delete().eq("id", id);
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary">📖 Notas do Mestre</h3>
        <button className="btn-secondary text-xs" onClick={add}>
          + Nota
        </button>
      </div>
      <p className="text-xs text-muted">
        🔒 Notas são secretas — só você (mestre) as vê.
      </p>
      <div className="space-y-3">
        {notes.length === 0 && (
          <p className="text-sm text-muted">Nenhuma nota ainda.</p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="space-y-1 rounded border border-border p-2">
            <div className="flex items-center gap-2">
              <input
                className="input flex-1 font-semibold"
                value={n.title}
                onChange={(e) => edit(n.id, { title: e.target.value })}
              />
              <button
                className="text-xs text-danger"
                onClick={() => remove(n.id)}
              >
                ✕
              </button>
            </div>
            <textarea
              className="input resize-y"
              rows={3}
              placeholder="Escreva aqui segredos, ganchos, lembretes..."
              value={n.body ?? ""}
              onChange={(e) => edit(n.id, { body: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Membros ----------------
function MembersList({ members }: { members: CampaignMember[] }) {
  return (
    <div className="card space-y-2">
      <h3 className="font-semibold text-primary">👥 Mesa</h3>
      {members.map((m) => (
        <div key={m.user_id} className="flex items-center gap-2 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2">
            {m.role === "master" ? "👑" : "🧑"}
          </span>
          <span className="flex-1 truncate">
            {m.profiles?.display_name ?? "Jogador"}
          </span>
          <span className="text-xs text-muted">
            {m.role === "master" ? "Mestre" : "Jogador"}
          </span>
        </div>
      ))}
    </div>
  );
}
