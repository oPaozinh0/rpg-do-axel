-- =============================================================
-- RPG do Axel — Schema inicial
-- Gerenciador de RPG de mesa (D&D 5e) com mapas, fichas,
-- gestão do mestre e rolagem de dados em tempo real.
-- =============================================================

-- Garante que os roles do Supabase tenham privilégios nas tabelas
-- futuras do schema public (RLS continua restringindo o acesso).
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

-- -------------------------------------------------------------
-- PERFIS (estende auth.users)
-- -------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Aventureiro',
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cria o perfil automaticamente quando um usuário se registra.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------
-- CAMPANHAS
-- O criador da campanha é o mestre (Axel).
-- -------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  master_id uuid not null references public.profiles (id) on delete cascade,
  invite_code text not null unique default encode(gen_random_bytes(4), 'hex'),
  created_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;

-- Membros da campanha (jogadores + mestre).
create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'player' check (role in ('master', 'player')),
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

alter table public.campaign_members enable row level security;

-- Função auxiliar: o usuário é membro da campanha?
create function public.is_campaign_member(cid uuid)
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id = cid and m.user_id = auth.uid()
  );
$$;

-- Função auxiliar: o usuário é o mestre da campanha?
create function public.is_campaign_master(cid uuid)
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = cid and c.master_id = auth.uid()
  );
$$;

-- Adiciona o mestre como membro automaticamente ao criar a campanha.
create function public.handle_new_campaign()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.campaign_members (campaign_id, user_id, role)
  values (new.id, new.master_id, 'master');
  return new;
end;
$$;

create trigger on_campaign_created
  after insert on public.campaigns
  for each row execute function public.handle_new_campaign();

-- -------------------------------------------------------------
-- FICHAS DE PERSONAGEM (D&D 5e)
-- Campos estruturados principais + JSONB para flexibilidade.
-- -------------------------------------------------------------
-- Espelha a ficha oficial de D&D 5e (PT-BR): identidade, atributos,
-- testes de resistência, perícias, combate, magias e história.
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- Cabeçalho
  name text not null default 'Novo Personagem',
  player_name text,
  class text,
  level int not null default 1,
  background text,
  race text,
  alignment text,
  experience_points int not null default 0,
  -- Atributos
  strength int not null default 10,
  dexterity int not null default 10,
  constitution int not null default 10,
  intelligence int not null default 10,
  wisdom int not null default 10,
  charisma int not null default 10,
  inspiration boolean not null default false,
  proficiency_bonus int not null default 2,
  -- Testes de resistência: { "strength": true, ... } (proficiência)
  saving_throws jsonb not null default '{}'::jsonb,
  -- Perícias: { "athletics": { "proficient": true, "expertise": false }, ... }
  skills jsonb not null default '{}'::jsonb,
  -- Combate
  armor_class int not null default 10,
  initiative int not null default 0,
  speed int not null default 9,
  max_hp int not null default 10,
  current_hp int not null default 10,
  temp_hp int not null default 0,
  hit_dice text,
  death_save_successes int not null default 0,
  death_save_failures int not null default 0,
  -- Ataques: [{ name, bonus, damage }]
  attacks jsonb not null default '[]'::jsonb,
  -- Equipamento e moedas
  equipment text,
  cp int not null default 0,
  sp int not null default 0,
  ep int not null default 0,
  gp int not null default 0,
  pp int not null default 0,
  -- Proficiências, características e inventário detalhado
  other_proficiencies text,
  features jsonb not null default '[]'::jsonb,
  inventory jsonb not null default '[]'::jsonb,
  -- Personalidade
  personality_traits text,
  ideals text,
  bonds text,
  flaws text,
  -- Página 2: aparência e história
  age text,
  height text,
  weight text,
  eyes text,
  skin text,
  hair text,
  appearance text,
  backstory text,
  allies text,
  treasure text,
  -- Magia (página 3)
  spellcasting_class text,
  spellcasting_ability text,
  spell_save_dc int,
  spell_attack_bonus int,
  -- Magias: [{ name, level, prepared, description }]
  spells jsonb not null default '[]'::jsonb,
  -- Espaços de magia: { "1": { total, used }, ... }
  spell_slots jsonb not null default '{}'::jsonb,
  notes text,
  avatar_url text,
  is_npc boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.characters enable row level security;
create index characters_campaign_idx on public.characters (campaign_id);

-- -------------------------------------------------------------
-- MAPAS
-- -------------------------------------------------------------
create table public.maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null default 'Mapa',
  image_url text,
  grid_size int not null default 50,
  grid_enabled boolean not null default true,
  width int not null default 1000,
  height int not null default 1000,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.maps enable row level security;
create index maps_campaign_idx on public.maps (campaign_id);

-- Tokens posicionados no mapa.
create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps (id) on delete cascade,
  character_id uuid references public.characters (id) on delete set null,
  label text not null default 'Token',
  image_url text,
  color text not null default '#b91c1c',
  x double precision not null default 0,
  y double precision not null default 0,
  size int not null default 1,
  current_hp int,
  max_hp int,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tokens enable row level security;
create index tokens_map_idx on public.tokens (map_id);

-- -------------------------------------------------------------
-- GESTÃO DO MESTRE: notas e iniciativa
-- -------------------------------------------------------------
create table public.campaign_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null default 'Nota',
  body text,
  is_secret boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaign_notes enable row level security;

create table public.initiative_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  initiative int not null default 0,
  current_hp int,
  max_hp int,
  is_active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.initiative_entries enable row level security;

-- -------------------------------------------------------------
-- ROLAGENS DE DADOS (log compartilhado)
-- -------------------------------------------------------------
create table public.dice_rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  formula text not null,
  result int not null,
  detail text,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.dice_rolls enable row level security;
create index dice_rolls_campaign_idx on public.dice_rolls (campaign_id, created_at desc);

-- =============================================================
-- POLÍTICAS RLS
-- =============================================================

-- PROFILES: cada um vê/edita o próprio; todos podem ler perfis (nomes).
create policy "perfis legíveis" on public.profiles
  for select using (true);
create policy "edita o próprio perfil" on public.profiles
  for update using (auth.uid() = id);

-- CAMPAIGNS
create policy "membros veem a campanha" on public.campaigns
  for select using (public.is_campaign_member(id) or master_id = auth.uid());
create policy "qualquer um cria campanha" on public.campaigns
  for insert with check (master_id = auth.uid());
create policy "mestre edita a campanha" on public.campaigns
  for update using (master_id = auth.uid());
create policy "mestre apaga a campanha" on public.campaigns
  for delete using (master_id = auth.uid());

-- CAMPAIGN_MEMBERS
create policy "membros veem outros membros" on public.campaign_members
  for select using (public.is_campaign_member(campaign_id));
create policy "entra na campanha" on public.campaign_members
  for insert with check (user_id = auth.uid() or public.is_campaign_master(campaign_id));
create policy "sai da campanha" on public.campaign_members
  for delete using (user_id = auth.uid() or public.is_campaign_master(campaign_id));

-- CHARACTERS
create policy "membros veem personagens" on public.characters
  for select using (public.is_campaign_member(campaign_id));
create policy "cria o próprio personagem" on public.characters
  for insert with check (
    public.is_campaign_member(campaign_id)
    and (owner_id = auth.uid() or public.is_campaign_master(campaign_id))
  );
create policy "edita o próprio personagem ou mestre" on public.characters
  for update using (owner_id = auth.uid() or public.is_campaign_master(campaign_id));
create policy "apaga o próprio personagem ou mestre" on public.characters
  for delete using (owner_id = auth.uid() or public.is_campaign_master(campaign_id));

-- MAPS (mestre gerencia; membros veem)
create policy "membros veem mapas" on public.maps
  for select using (public.is_campaign_member(campaign_id));
create policy "mestre cria mapas" on public.maps
  for insert with check (public.is_campaign_master(campaign_id));
create policy "mestre edita mapas" on public.maps
  for update using (public.is_campaign_master(campaign_id));
create policy "mestre apaga mapas" on public.maps
  for delete using (public.is_campaign_master(campaign_id));

-- TOKENS (membros podem mover; mestre gerencia tudo)
create policy "membros veem tokens" on public.tokens
  for select using (
    exists (select 1 from public.maps m where m.id = map_id and public.is_campaign_member(m.campaign_id))
  );
create policy "membros criam/movem tokens" on public.tokens
  for insert with check (
    exists (select 1 from public.maps m where m.id = map_id and public.is_campaign_member(m.campaign_id))
  );
create policy "membros atualizam tokens" on public.tokens
  for update using (
    exists (select 1 from public.maps m where m.id = map_id and public.is_campaign_member(m.campaign_id))
  );
create policy "membros apagam tokens" on public.tokens
  for delete using (
    exists (select 1 from public.maps m where m.id = map_id and public.is_campaign_member(m.campaign_id))
  );

-- CAMPAIGN_NOTES (apenas mestre)
create policy "mestre vê notas" on public.campaign_notes
  for select using (public.is_campaign_master(campaign_id));
create policy "mestre cria notas" on public.campaign_notes
  for insert with check (public.is_campaign_master(campaign_id));
create policy "mestre edita notas" on public.campaign_notes
  for update using (public.is_campaign_master(campaign_id));
create policy "mestre apaga notas" on public.campaign_notes
  for delete using (public.is_campaign_master(campaign_id));

-- INITIATIVE (membros veem; mestre gerencia)
create policy "membros veem iniciativa" on public.initiative_entries
  for select using (public.is_campaign_member(campaign_id));
create policy "mestre cria iniciativa" on public.initiative_entries
  for insert with check (public.is_campaign_master(campaign_id));
create policy "mestre edita iniciativa" on public.initiative_entries
  for update using (public.is_campaign_master(campaign_id));
create policy "mestre apaga iniciativa" on public.initiative_entries
  for delete using (public.is_campaign_master(campaign_id));

-- DICE_ROLLS (membros veem rolagens não-privadas + as próprias)
create policy "membros veem rolagens" on public.dice_rolls
  for select using (
    public.is_campaign_member(campaign_id)
    and (not is_private or user_id = auth.uid() or public.is_campaign_master(campaign_id))
  );
create policy "membros rolam dados" on public.dice_rolls
  for insert with check (public.is_campaign_member(campaign_id) and user_id = auth.uid());

-- =============================================================
-- GRANTS explícitos nas tabelas já criadas
-- =============================================================
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- =============================================================
-- REALTIME: publica tabelas que sincronizam ao vivo
-- =============================================================
alter publication supabase_realtime add table public.tokens;
alter publication supabase_realtime add table public.maps;
alter publication supabase_realtime add table public.dice_rolls;
alter publication supabase_realtime add table public.initiative_entries;
alter publication supabase_realtime add table public.characters;

-- =============================================================
-- STORAGE: buckets para mapas e avatares
-- =============================================================
insert into storage.buckets (id, name, public)
values ('maps', 'maps', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "leitura pública de mídia" on storage.objects
  for select using (bucket_id in ('maps', 'avatars'));
create policy "usuários autenticados enviam mídia" on storage.objects
  for insert to authenticated with check (bucket_id in ('maps', 'avatars'));
create policy "usuários atualizam própria mídia" on storage.objects
  for update to authenticated using (bucket_id in ('maps', 'avatars'));
create policy "usuários apagam própria mídia" on storage.objects
  for delete to authenticated using (bucket_id in ('maps', 'avatars'));
