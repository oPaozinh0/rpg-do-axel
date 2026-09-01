// Utilitários de regras de D&D 5e.

export type AbilityKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

export const ABILITIES: { key: AbilityKey; label: string; short: string }[] = [
  { key: "strength", label: "Força", short: "FOR" },
  { key: "dexterity", label: "Destreza", short: "DES" },
  { key: "constitution", label: "Constituição", short: "CON" },
  { key: "intelligence", label: "Inteligência", short: "INT" },
  { key: "wisdom", label: "Sabedoria", short: "SAB" },
  { key: "charisma", label: "Carisma", short: "CAR" },
];

// Perícias do 5e e o atributo associado.
export const SKILLS: { key: string; label: string; ability: AbilityKey }[] = [
  { key: "acrobatics", label: "Acrobacia", ability: "dexterity" },
  { key: "animal_handling", label: "Adestrar Animais", ability: "wisdom" },
  { key: "arcana", label: "Arcanismo", ability: "intelligence" },
  { key: "athletics", label: "Atletismo", ability: "strength" },
  { key: "deception", label: "Enganação", ability: "charisma" },
  { key: "history", label: "História", ability: "intelligence" },
  { key: "insight", label: "Intuição", ability: "wisdom" },
  { key: "intimidation", label: "Intimidação", ability: "charisma" },
  { key: "investigation", label: "Investigação", ability: "intelligence" },
  { key: "medicine", label: "Medicina", ability: "wisdom" },
  { key: "nature", label: "Natureza", ability: "intelligence" },
  { key: "perception", label: "Percepção", ability: "wisdom" },
  { key: "performance", label: "Atuação", ability: "charisma" },
  { key: "persuasion", label: "Persuasão", ability: "charisma" },
  { key: "religion", label: "Religião", ability: "intelligence" },
  { key: "sleight_of_hand", label: "Prestidigitação", ability: "dexterity" },
  { key: "stealth", label: "Furtividade", ability: "dexterity" },
  { key: "survival", label: "Sobrevivência", ability: "wisdom" },
];

/** Modificador de atributo do 5e: floor((valor - 10) / 2). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Formata um modificador com sinal: +3, -1, +0. */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Bônus de proficiência padrão por nível (5e). */
export function proficiencyByLevel(level: number): number {
  return Math.ceil(level / 4) + 1;
}

export const DND_CLASSES = [
  "Bárbaro",
  "Bardo",
  "Bruxo",
  "Clérigo",
  "Druida",
  "Feiticeiro",
  "Guerreiro",
  "Ladino",
  "Mago",
  "Monge",
  "Paladino",
  "Patrulheiro",
];

export const DND_RACES = [
  "Humano",
  "Elfo",
  "Anão",
  "Halfling",
  "Draconato",
  "Gnomo",
  "Meio-Elfo",
  "Meio-Orc",
  "Tiefling",
  "Tabaxi",
];

// ----------------------------------------------------------------
// Rolagem de dados — parser de fórmulas tipo "2d6+3", "d20", "1d8-1"
// ----------------------------------------------------------------

export interface RollResult {
  formula: string;
  total: number;
  detail: string;
  rolls: number[];
}

/**
 * Rola uma fórmula de dados. Suporta múltiplos termos: "2d6 + 1d4 + 3".
 * Retorna null se a fórmula for inválida.
 */
export function rollDice(formula: string): RollResult | null {
  const clean = formula.replace(/\s+/g, "").toLowerCase();
  if (!clean) return null;

  // Quebra em termos preservando os sinais (+/-).
  const termRegex = /([+-]?)(\d*d\d+|\d+)/g;
  const matches = [...clean.matchAll(termRegex)];
  if (matches.length === 0) return null;

  // Valida que a string inteira foi consumida.
  const consumed = matches.map((m) => m[0]).join("");
  if (consumed !== clean) return null;

  let total = 0;
  const parts: string[] = [];
  const allRolls: number[] = [];

  for (const m of matches) {
    const sign = m[1] === "-" ? -1 : 1;
    const term = m[2];

    if (term.includes("d")) {
      const [countStr, sidesStr] = term.split("d");
      const count = countStr === "" ? 1 : parseInt(countStr, 10);
      const sides = parseInt(sidesStr, 10);
      if (count < 1 || count > 100 || sides < 1 || sides > 1000) return null;

      const rolls: number[] = [];
      for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        rolls.push(r);
        allRolls.push(r);
        total += sign * r;
      }
      parts.push(`${sign < 0 ? "-" : ""}${count}d${sides}[${rolls.join(",")}]`);
    } else {
      const value = parseInt(term, 10);
      total += sign * value;
      parts.push(`${sign < 0 ? "-" : "+"}${value}`);
    }
  }

  return {
    formula,
    total,
    detail: parts.join(" "),
    rolls: allRolls,
  };
}

export type RollMode = "normal" | "advantage" | "disadvantage";

/**
 * Rola um teste de d20 com modificador, aplicando vantagem/desvantagem.
 * Retorna o resultado pronto para o log de dados.
 */
export function rollD20(
  label: string,
  modifier: number,
  mode: RollMode = "normal"
): RollResult {
  const d1 = Math.floor(Math.random() * 20) + 1;
  const d2 = Math.floor(Math.random() * 20) + 1;
  let die = d1;
  let dicePart = `d20[${d1}]`;

  if (mode === "advantage") {
    die = Math.max(d1, d2);
    dicePart = `2d20kh[${d1},${d2}]`;
  } else if (mode === "disadvantage") {
    die = Math.min(d1, d2);
    dicePart = `2d20kl[${d1},${d2}]`;
  }

  const total = die + modifier;
  const modStr = modifier !== 0 ? ` ${formatModifier(modifier)}` : "";
  const modeStr =
    mode === "advantage"
      ? " (vantagem)"
      : mode === "disadvantage"
        ? " (desvantagem)"
        : "";

  return {
    formula: `${label}${modeStr}`,
    total,
    detail: `${dicePart}${modStr} = ${total}`,
    rolls: [die],
  };
}

// Condições de status do D&D 5e.
export const CONDITIONS: { key: string; label: string; icon: string }[] = [
  { key: "blinded", label: "Cego", icon: "🙈" },
  { key: "charmed", label: "Enfeitiçado", icon: "💗" },
  { key: "deafened", label: "Surdo", icon: "🔇" },
  { key: "frightened", label: "Amedrontado", icon: "😱" },
  { key: "grappled", label: "Agarrado", icon: "🤝" },
  { key: "incapacitated", label: "Incapacitado", icon: "💢" },
  { key: "invisible", label: "Invisível", icon: "👻" },
  { key: "paralyzed", label: "Paralisado", icon: "🧊" },
  { key: "petrified", label: "Petrificado", icon: "🗿" },
  { key: "poisoned", label: "Envenenado", icon: "🤢" },
  { key: "prone", label: "Caído", icon: "⬇️" },
  { key: "restrained", label: "Impedido", icon: "⛓️" },
  { key: "stunned", label: "Atordoado", icon: "💫" },
  { key: "unconscious", label: "Inconsciente", icon: "😵" },
  { key: "exhaustion", label: "Exaustão", icon: "🥵" },
];
