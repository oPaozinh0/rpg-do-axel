-- =============================================================
-- Entrar numa campanha por código de convite.
-- A RLS de "campaigns" só deixa ver quem já é membro, então
-- usamos uma função SECURITY DEFINER para resolver o código e
-- inserir o membro com segurança.
-- =============================================================
create or replace function public.join_campaign_by_code(code text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select id into cid
  from public.campaigns
  where invite_code = lower(trim(code));

  if cid is null then
    raise exception 'CODIGO_INVALIDO';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (cid, auth.uid(), 'player')
  on conflict (campaign_id, user_id) do nothing;

  return cid;
end;
$$;

grant execute on function public.join_campaign_by_code(text) to authenticated;
