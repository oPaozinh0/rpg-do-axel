// Tipos do domínio do RPG do Axel.

export type Role = "master" | "player";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  master_id: string;
  invite_code: string;
  created_at: string;
}

export interface CampaignMember {
  campaign_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  profiles?: Profile;
}

export interface Skill {
  proficient: boolean;
  expertise?: boolean;
}

export interface Spell {
  name: string;
  level: number;
  prepared?: boolean;
  description?: string;
}

export interface InventoryItem {
  name: string;
  quantity: number;
  weight?: number;
  notes?: string;
}

export interface Feature {
  name: string;
  description?: string;
}

export interface Attack {
  name: string;
  bonus: string;
  damage: string;
}

export interface SpellSlot {
  total: number;
  used: number;
}

export interface Character {
  id: string;
  campaign_id: string;
  owner_id: string;
  // Cabeçalho
  name: string;
  player_name: string | null;
  class: string | null;
  level: number;
  background: string | null;
  race: string | null;
  alignment: string | null;
  experience_points: number;
  // Atributos
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  inspiration: boolean;
  proficiency_bonus: number;
  saving_throws: Record<string, boolean>;
  skills: Record<string, Skill>;
  // Combate
  armor_class: number;
  initiative: number;
  speed: number;
  max_hp: number;
  current_hp: number;
  temp_hp: number;
  hit_dice: string | null;
  death_save_successes: number;
  death_save_failures: number;
  attacks: Attack[];
  // Equipamento e moedas
  equipment: string | null;
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
  other_proficiencies: string | null;
  features: Feature[];
  inventory: InventoryItem[];
  // Personalidade
  personality_traits: string | null;
  ideals: string | null;
  bonds: string | null;
  flaws: string | null;
  // Aparência e história
  age: string | null;
  height: string | null;
  weight: string | null;
  eyes: string | null;
  skin: string | null;
  hair: string | null;
  appearance: string | null;
  backstory: string | null;
  allies: string | null;
  treasure: string | null;
  // Magia
  spellcasting_class: string | null;
  spellcasting_ability: string | null;
  spell_save_dc: number | null;
  spell_attack_bonus: number | null;
  spells: Spell[];
  spell_slots: Record<string, SpellSlot>;
  notes: string | null;
  avatar_url: string | null;
  is_npc: boolean;
  created_at: string;
  updated_at: string;
}

export interface GameMap {
  id: string;
  campaign_id: string;
  name: string;
  image_url: string | null;
  grid_size: number;
  grid_enabled: boolean;
  width: number;
  height: number;
  is_active: boolean;
  fog_enabled: boolean;
  revealed: string[];
  created_at: string;
}

export interface Token {
  id: string;
  map_id: string;
  character_id: string | null;
  label: string;
  image_url: string | null;
  color: string;
  x: number;
  y: number;
  size: number;
  current_hp: number | null;
  max_hp: number | null;
  is_hidden: boolean;
  conditions: string[];
  created_at: string;
}

export interface CampaignNote {
  id: string;
  campaign_id: string;
  title: string;
  body: string | null;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
}

export interface InitiativeEntry {
  id: string;
  campaign_id: string;
  name: string;
  initiative: number;
  current_hp: number | null;
  max_hp: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface DiceRoll {
  id: string;
  campaign_id: string;
  user_id: string;
  formula: string;
  result: number;
  detail: string | null;
  is_private: boolean;
  created_at: string;
  profiles?: Profile;
}
