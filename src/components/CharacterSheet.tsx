"use client";

import { useState } from "react";
import { useAutoSave, SaveStatus } from "@/hooks/useAutoSave";
import {
  ABILITIES,
  SKILLS,
  AbilityKey,
  abilityModifier,
  formatModifier,
  proficiencyByLevel,
  rollD20,
  rollDice,
  RollMode,
  DND_CLASSES,
  DND_RACES,
} from "@/lib/dnd";
import type { Character, Attack, Feature, Spell, SpellSlot } from "@/lib/types";
import type { RollResult } from "@/lib/dnd";
import { logRoll } from "@/lib/rolls";
import { TextField, NumberField, TextArea, Field } from "@/components/fields";
import { deleteCharacter } from "@/app/(app)/campanhas/[id]/personagens/actions";

const TABS = [
  "Atributos",
  "Combate",
  "Magias",
  "Equipamento",
  "História",
] as const;
type Tab = (typeof TABS)[number];

function StatusBadge({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, string> = {
    idle: "",
    saving: "Salvando…",
    saved: "✓ Salvo",
    error: "⚠ Erro ao salvar",
  };
  if (!map[status]) return null;
  return (
    <span
      className={`text-xs ${status === "error" ? "text-danger" : "text-muted"}`}
    >
      {map[status]}
    </span>
  );
}

export function CharacterSheet({
  character,
  canEdit,
  userId,
}: {
  character: Character;
  canEdit: boolean;
  userId: string;
}) {
  const { data: c, update, status } = useAutoSave<Character>(
    "characters",
    character,
    canEdit
  );
  const [tab, setTab] = useState<Tab>("Atributos");
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  const dis = !canEdit;

  // Rola um teste de d20 (atributo, TR, perícia, ataque) e envia ao log.
  function roll(label: string, modifier: number) {
    const r = rollD20(`${c.name}: ${label}`, modifier, rollMode);
    setLastRoll(r);
    logRoll(c.campaign_id, userId, r);
  }

  // Rola uma fórmula livre (dano, cura) e envia ao log — sem vantagem.
  function rollFormula(label: string, formula: string) {
    const res = rollDice(formula);
    if (!res) return;
    const r: RollResult = { ...res, formula: `${c.name}: ${label}` };
    setLastRoll(r);
    logRoll(c.campaign_id, userId, r);
  }

  const roller = { roll, rollFormula };

  const perceptionValue =
    abilityModifier(c.wisdom) +
    (c.skills?.perception?.proficient ? c.proficiency_bonus : 0);
  const passivePerception = 10 + perceptionValue;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <input
            className="input !text-xl font-bold"
            value={c.name}
            disabled={dis}
            onChange={(e) => update({ name: e.target.value })}
          />
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            {canEdit && (
              <button
                className="btn-ghost text-xs text-danger"
                onClick={() => {
                  if (confirm(`Apagar "${c.name}"? Isso não pode ser desfeito.`))
                    deleteCharacter(c.campaign_id, c.id);
                }}
              >
                Apagar
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Classe">
            <input
              className="input"
              list="dnd-classes"
              value={c.class ?? ""}
              disabled={dis}
              onChange={(e) => update({ class: e.target.value })}
            />
            <datalist id="dnd-classes">
              {DND_CLASSES.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </Field>
          <NumberField
            label="Nível"
            value={c.level}
            disabled={dis}
            min={1}
            max={20}
            onChange={(level) =>
              update({ level, proficiency_bonus: proficiencyByLevel(level) })
            }
          />
          <Field label="Raça">
            <input
              className="input"
              list="dnd-races"
              value={c.race ?? ""}
              disabled={dis}
              onChange={(e) => update({ race: e.target.value })}
            />
            <datalist id="dnd-races">
              {DND_RACES.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </Field>
          <TextField
            label="Antecedente"
            value={c.background}
            disabled={dis}
            onChange={(v) => update({ background: v })}
          />
          <TextField
            label="Tendência"
            value={c.alignment}
            disabled={dis}
            placeholder="Leal e Bom"
            onChange={(v) => update({ alignment: v })}
          />
          <TextField
            label="Nome do jogador"
            value={c.player_name}
            disabled={dis}
            onChange={(v) => update({ player_name: v })}
          />
          <NumberField
            label="XP"
            value={c.experience_points}
            disabled={dis}
            onChange={(v) => update({ experience_points: v })}
          />
        </div>
      </div>

      {/* Modo de rolagem + último resultado */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-2">
        <span className="text-xs font-semibold uppercase text-muted">
          Rolar com:
        </span>
        <div className="flex gap-1">
          {(
            [
              ["normal", "Normal"],
              ["advantage", "Vantagem"],
              ["disadvantage", "Desvantagem"],
            ] as [RollMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setRollMode(mode)}
              className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                rollMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {lastRoll && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-2xl font-bold text-primary">
              {lastRoll.total}
            </span>
            <span className="text-xs text-muted">{lastRoll.detail}</span>
          </div>
        )}
        <span className="text-xs text-muted">
          💡 Clique nos valores azuis para rolar
        </span>
      </div>

      {/* Abas internas */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Atributos" && (
        <AttributesTab
          c={c}
          update={update}
          dis={dis}
          roller={roller}
          passivePerception={passivePerception}
        />
      )}
      {tab === "Combate" && (
        <CombatTab c={c} update={update} dis={dis} roller={roller} />
      )}
      {tab === "Magias" && (
        <SpellsTab c={c} update={update} dis={dis} roller={roller} />
      )}
      {tab === "Equipamento" && (
        <EquipmentTab c={c} update={update} dis={dis} roller={roller} />
      )}
      {tab === "História" && (
        <StoryTab c={c} update={update} dis={dis} roller={roller} />
      )}

      {!canEdit && (
        <p className="text-xs text-muted">
          👁️ Modo somente leitura — só o dono da ficha ou o mestre podem editar.
        </p>
      )}
    </div>
  );
}

type Roller = {
  roll: (label: string, modifier: number) => void;
  rollFormula: (label: string, formula: string) => void;
};

type TabProps = {
  c: Character;
  update: (p: Partial<Character>) => void;
  dis: boolean;
  roller: Roller;
};

/** Botão que mostra um valor e rola ao clicar. */
function RollButton({
  value,
  onClick,
  title,
}: {
  value: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title ?? "Rolar"}
      className="rounded bg-surface-2 px-2 py-0.5 font-mono font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
    >
      {value}
    </button>
  );
}

// ---------------- Atributos & Perícias ----------------
function AttributesTab({
  c,
  update,
  dis,
  roller,
  passivePerception,
}: TabProps & { passivePerception: number }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Atributos */}
      <div className="space-y-3">
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-primary">Atributos</h3>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input
                type="checkbox"
                checked={c.inspiration}
                disabled={dis}
                onChange={(e) => update({ inspiration: e.target.checked })}
              />
              Inspiração
            </label>
          </div>
          {ABILITIES.map(({ key, label }) => {
            const score = c[key] as number;
            const mod = abilityModifier(score);
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-28 text-sm">{label}</div>
                <input
                  type="number"
                  className="input w-16 text-center"
                  value={score}
                  disabled={dis}
                  onChange={(e) =>
                    update({ [key]: parseInt(e.target.value, 10) || 0 } as Partial<Character>)
                  }
                />
                <RollButton
                  value={formatModifier(mod)}
                  title={`Teste de ${label}`}
                  onClick={() => roller.roll(`Teste de ${label}`, mod)}
                />
              </div>
            );
          })}
          <div className="flex items-center gap-3 border-t border-border pt-2">
            <div className="w-28 text-sm font-semibold">Bônus Prof.</div>
            <div className="w-16 text-center font-mono text-primary">
              {formatModifier(c.proficiency_bonus)}
            </div>
          </div>
        </div>
      </div>

      {/* Testes de resistência */}
      <div className="card space-y-2">
        <h3 className="font-semibold text-primary">Testes de Resistência</h3>
        {ABILITIES.map(({ key, label }) => {
          const proficient = !!c.saving_throws?.[key];
          const value =
            abilityModifier(c[key] as number) +
            (proficient ? c.proficiency_bonus : 0);
          return (
            <div key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={proficient}
                disabled={dis}
                onChange={(e) =>
                  update({
                    saving_throws: {
                      ...c.saving_throws,
                      [key]: e.target.checked,
                    },
                  })
                }
              />
              <RollButton
                value={formatModifier(value)}
                title={`TR de ${label}`}
                onClick={() => roller.roll(`TR de ${label}`, value)}
              />
              <span>{label}</span>
            </div>
          );
        })}
        <div className="mt-2 rounded bg-surface-2 p-2 text-center text-sm">
          Percepção Passiva:{" "}
          <span className="font-mono text-primary">{passivePerception}</span>
        </div>
      </div>

      {/* Perícias */}
      <div className="card space-y-1.5">
        <h3 className="font-semibold text-primary">Perícias</h3>
        {SKILLS.map(({ key, label, ability }) => {
          const skill = c.skills?.[key] ?? { proficient: false };
          const value =
            abilityModifier(c[ability] as number) +
            (skill.proficient ? c.proficiency_bonus : 0) +
            (skill.expertise ? c.proficiency_bonus : 0);
          const abShort = ABILITIES.find((a) => a.key === ability)?.short;
          return (
            <div key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={skill.proficient}
                disabled={dis}
                onChange={(e) =>
                  update({
                    skills: {
                      ...c.skills,
                      [key]: { ...skill, proficient: e.target.checked },
                    },
                  })
                }
              />
              <RollButton
                value={formatModifier(value)}
                title={`Rolar ${label}`}
                onClick={() => roller.roll(label, value)}
              />
              <span className="flex-1">{label}</span>
              <span className="text-xs text-muted">{abShort}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Extrai a fórmula de dados de um texto de dano ("1d8+3 cortante" -> "1d8+3").
function extractDamageFormula(damage: string): string | null {
  const m = damage.match(/\d*d\d+([+-]\d+)*|\d+/);
  return m ? m[0] : null;
}

// ---------------- Combate & Ataques ----------------
function CombatTab({ c, update, dis, roller }: TabProps) {
  const attacks = c.attacks ?? [];
  function setAttack(i: number, patch: Partial<Attack>) {
    const next = attacks.map((a, idx) => (idx === i ? { ...a, ...patch } : a));
    update({ attacks: next });
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <button
          className="btn-secondary text-sm"
          onClick={() =>
            roller.roll("Iniciativa", abilityModifier(c.dexterity))
          }
        >
          🎲 Rolar Iniciativa ({formatModifier(abilityModifier(c.dexterity))})
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <NumberField
          label="Classe de Armadura"
          value={c.armor_class}
          disabled={dis}
          onChange={(v) => update({ armor_class: v })}
        />
        <NumberField
          label="Iniciativa"
          value={c.initiative}
          disabled={dis}
          onChange={(v) => update({ initiative: v })}
        />
        <NumberField
          label="Deslocamento"
          value={c.speed}
          disabled={dis}
          onChange={(v) => update({ speed: v })}
        />
        <NumberField
          label="PV Máximo"
          value={c.max_hp}
          disabled={dis}
          onChange={(v) => update({ max_hp: v })}
        />
        <NumberField
          label="PV Atual"
          value={c.current_hp}
          disabled={dis}
          onChange={(v) => update({ current_hp: v })}
        />
        <NumberField
          label="PV Temporário"
          value={c.temp_hp}
          disabled={dis}
          onChange={(v) => update({ temp_hp: v })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          label="Dados de Vida"
          value={c.hit_dice}
          disabled={dis}
          placeholder="ex: 5d8"
          onChange={(v) => update({ hit_dice: v })}
        />
        <NumberField
          label="Testes contra a Morte — Sucessos"
          value={c.death_save_successes}
          disabled={dis}
          min={0}
          max={3}
          onChange={(v) => update({ death_save_successes: v })}
        />
        <NumberField
          label="Testes contra a Morte — Fracassos"
          value={c.death_save_failures}
          disabled={dis}
          min={0}
          max={3}
          onChange={(v) => update({ death_save_failures: v })}
        />
      </div>

      {/* Ataques */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-primary">Ataques e Magias</h3>
          {!dis && (
            <button
              className="btn-secondary text-xs"
              onClick={() =>
                update({
                  attacks: [...attacks, { name: "", bonus: "", damage: "" }],
                })
              }
            >
              + Ataque
            </button>
          )}
        </div>
        {attacks.length === 0 && (
          <p className="text-sm text-muted">Nenhum ataque cadastrado.</p>
        )}
        {attacks.map((a, i) => {
          const atkBonus = parseInt(a.bonus.replace(/[^\d-]/g, ""), 10) || 0;
          const dmgFormula = extractDamageFormula(a.damage);
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                className="input flex-1"
                placeholder="Nome"
                value={a.name}
                disabled={dis}
                onChange={(e) => setAttack(i, { name: e.target.value })}
              />
              <input
                className="input w-20"
                placeholder="Bônus"
                value={a.bonus}
                disabled={dis}
                onChange={(e) => setAttack(i, { bonus: e.target.value })}
              />
              <input
                className="input w-32"
                placeholder="Dano / Tipo"
                value={a.damage}
                disabled={dis}
                onChange={(e) => setAttack(i, { damage: e.target.value })}
              />
              <button
                className="btn-secondary px-2 text-xs"
                title="Rolar ataque"
                onClick={() =>
                  roller.roll(`Ataque: ${a.name || "—"}`, atkBonus)
                }
              >
                ⚔️
              </button>
              <button
                className="btn-secondary px-2 text-xs disabled:opacity-30"
                title="Rolar dano"
                disabled={!dmgFormula}
                onClick={() =>
                  dmgFormula &&
                  roller.rollFormula(`Dano: ${a.name || "—"}`, dmgFormula)
                }
              >
                💥
              </button>
              {!dis && (
                <button
                  className="btn-ghost px-2 text-danger"
                  onClick={() =>
                    update({ attacks: attacks.filter((_, idx) => idx !== i) })
                  }
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Características e habilidades */}
      <FeaturesEditor c={c} update={update} dis={dis} />
    </div>
  );
}

function FeaturesEditor({
  c,
  update,
  dis,
}: Omit<TabProps, "roller">) {
  const features = c.features ?? [];
  function setFeature(i: number, patch: Partial<Feature>) {
    update({
      features: features.map((f, idx) => (idx === i ? { ...f, ...patch } : f)),
    });
  }
  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary">Características e Habilidades</h3>
        {!dis && (
          <button
            className="btn-secondary text-xs"
            onClick={() =>
              update({ features: [...features, { name: "", description: "" }] })
            }
          >
            + Habilidade
          </button>
        )}
      </div>
      {features.length === 0 && (
        <p className="text-sm text-muted">Nenhuma habilidade cadastrada.</p>
      )}
      {features.map((f, i) => (
        <div key={i} className="space-y-1 rounded border border-border p-2">
          <div className="flex items-center gap-2">
            <input
              className="input flex-1 font-semibold"
              placeholder="Nome da habilidade"
              value={f.name}
              disabled={dis}
              onChange={(e) => setFeature(i, { name: e.target.value })}
            />
            {!dis && (
              <button
                className="btn-ghost px-2 text-danger"
                onClick={() =>
                  update({ features: features.filter((_, idx) => idx !== i) })
                }
              >
                ✕
              </button>
            )}
          </div>
          <textarea
            className="input resize-y"
            rows={2}
            placeholder="Descrição"
            value={f.description ?? ""}
            disabled={dis}
            onChange={(e) => setFeature(i, { description: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------- Magias ----------------
function SpellsTab({ c, update, dis }: TabProps) {
  const spells = c.spells ?? [];
  const slots = c.spell_slots ?? {};
  function setSpell(i: number, patch: Partial<Spell>) {
    update({
      spells: spells.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    });
  }
  function setSlot(level: string, patch: Partial<SpellSlot>) {
    const cur = slots[level] ?? { total: 0, used: 0 };
    update({ spell_slots: { ...slots, [level]: { ...cur, ...patch } } });
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TextField
          label="Classe Conjuradora"
          value={c.spellcasting_class}
          disabled={dis}
          onChange={(v) => update({ spellcasting_class: v })}
        />
        <TextField
          label="Habilidade-Chave"
          value={c.spellcasting_ability}
          disabled={dis}
          placeholder="INT / SAB / CAR"
          onChange={(v) => update({ spellcasting_ability: v })}
        />
        <NumberField
          label="CD do TR de Magia"
          value={c.spell_save_dc ?? 0}
          disabled={dis}
          onChange={(v) => update({ spell_save_dc: v })}
        />
        <NumberField
          label="Bônus de Ataque Mágico"
          value={c.spell_attack_bonus ?? 0}
          disabled={dis}
          onChange={(v) => update({ spell_attack_bonus: v })}
        />
      </div>

      {/* Espaços de magia */}
      <div className="card">
        <h3 className="mb-2 font-semibold text-primary">Espaços de Magia</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {Array.from({ length: 9 }, (_, idx) => String(idx + 1)).map((lvl) => {
            const slot = slots[lvl] ?? { total: 0, used: 0 };
            return (
              <div key={lvl} className="rounded border border-border p-2 text-center">
                <div className="text-xs font-bold text-muted">Nível {lvl}</div>
                <input
                  type="number"
                  className="input mt-1 text-center"
                  title="Total"
                  value={slot.total}
                  disabled={dis}
                  onChange={(e) =>
                    setSlot(lvl, { total: parseInt(e.target.value, 10) || 0 })
                  }
                />
                <input
                  type="number"
                  className="input mt-1 text-center"
                  title="Usados"
                  value={slot.used}
                  disabled={dis}
                  onChange={(e) =>
                    setSlot(lvl, { used: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-muted">Cada coluna: total / usados.</p>
      </div>

      {/* Lista de magias */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-primary">Magias Conhecidas</h3>
          {!dis && (
            <button
              className="btn-secondary text-xs"
              onClick={() =>
                update({
                  spells: [
                    ...spells,
                    { name: "", level: 0, prepared: false, description: "" },
                  ],
                })
              }
            >
              + Magia
            </button>
          )}
        </div>
        {spells.length === 0 && (
          <p className="text-sm text-muted">Nenhuma magia cadastrada.</p>
        )}
        {spells
          .map((s, i) => ({ s, i }))
          .sort((a, b) => a.s.level - b.s.level)
          .map(({ s, i }) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                className="input w-16 text-center"
                title="Nível (0 = truque)"
                value={s.level}
                disabled={dis}
                min={0}
                max={9}
                onChange={(e) =>
                  setSpell(i, { level: parseInt(e.target.value, 10) || 0 })
                }
              />
              <input
                className="input flex-1"
                placeholder="Nome da magia"
                value={s.name}
                disabled={dis}
                onChange={(e) => setSpell(i, { name: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={!!s.prepared}
                  disabled={dis}
                  onChange={(e) => setSpell(i, { prepared: e.target.checked })}
                />
                Prep.
              </label>
              {!dis && (
                <button
                  className="btn-ghost px-2 text-danger"
                  onClick={() =>
                    update({ spells: spells.filter((_, idx) => idx !== i) })
                  }
                >
                  ✕
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

// ---------------- Equipamento ----------------
function EquipmentTab({ c, update, dis }: TabProps) {
  const coins: { key: keyof Character; label: string }[] = [
    { key: "cp", label: "PC (cobre)" },
    { key: "sp", label: "PP (prata)" },
    { key: "ep", label: "PE (electro)" },
    { key: "gp", label: "PO (ouro)" },
    { key: "pp", label: "PL (platina)" },
  ];
  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="mb-2 font-semibold text-primary">Moedas</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {coins.map(({ key, label }) => (
            <NumberField
              key={key}
              label={label}
              value={c[key] as number}
              disabled={dis}
              onChange={(v) => update({ [key]: v } as Partial<Character>)}
            />
          ))}
        </div>
      </div>
      <TextArea
        label="Equipamento"
        value={c.equipment}
        disabled={dis}
        rows={6}
        placeholder="Armas, armaduras, itens..."
        onChange={(v) => update({ equipment: v })}
      />
      <TextArea
        label="Idiomas e Outras Proficiências"
        value={c.other_proficiencies}
        disabled={dis}
        rows={4}
        onChange={(v) => update({ other_proficiencies: v })}
      />
    </div>
  );
}

// ---------------- História ----------------
function StoryTab({ c, update, dis }: TabProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextArea
          label="Traços de Personalidade"
          value={c.personality_traits}
          disabled={dis}
          onChange={(v) => update({ personality_traits: v })}
        />
        <TextArea
          label="Ideais"
          value={c.ideals}
          disabled={dis}
          onChange={(v) => update({ ideals: v })}
        />
        <TextArea
          label="Ligações"
          value={c.bonds}
          disabled={dis}
          onChange={(v) => update({ bonds: v })}
        />
        <TextArea
          label="Defeitos"
          value={c.flaws}
          disabled={dis}
          onChange={(v) => update({ flaws: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <TextField label="Idade" value={c.age} disabled={dis} onChange={(v) => update({ age: v })} />
        <TextField label="Altura" value={c.height} disabled={dis} onChange={(v) => update({ height: v })} />
        <TextField label="Peso" value={c.weight} disabled={dis} onChange={(v) => update({ weight: v })} />
        <TextField label="Olhos" value={c.eyes} disabled={dis} onChange={(v) => update({ eyes: v })} />
        <TextField label="Pele" value={c.skin} disabled={dis} onChange={(v) => update({ skin: v })} />
        <TextField label="Cabelos" value={c.hair} disabled={dis} onChange={(v) => update({ hair: v })} />
      </div>

      <TextArea label="Aparência do Personagem" value={c.appearance} disabled={dis} onChange={(v) => update({ appearance: v })} />
      <TextArea label="História do Personagem" value={c.backstory} disabled={dis} rows={6} onChange={(v) => update({ backstory: v })} />
      <TextArea label="Aliados e Organizações" value={c.allies} disabled={dis} onChange={(v) => update({ allies: v })} />
      <TextArea label="Tesouro" value={c.treasure} disabled={dis} onChange={(v) => update({ treasure: v })} />
    </div>
  );
}
