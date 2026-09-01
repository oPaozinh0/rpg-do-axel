-- =============================================================
-- Recursos dinâmicos: condições de combate e névoa de guerra.
-- =============================================================

-- Condições de status no token (ex: envenenado, atordoado).
alter table public.tokens
  add column conditions text[] not null default '{}';

-- Névoa de guerra por mapa.
-- revealed guarda as células reveladas como strings "cx,cy".
alter table public.maps
  add column fog_enabled boolean not null default false;
alter table public.maps
  add column revealed jsonb not null default '[]'::jsonb;
