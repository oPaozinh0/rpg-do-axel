import { createClient } from "@/lib/supabase/server";
import { getCampaignContext } from "@/lib/campaign";
import { MapBoard } from "@/components/MapBoard";
import type { Character, GameMap, Token } from "@/lib/types";

export default async function MapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, isMaster } = await getCampaignContext(id);
  const supabase = await createClient();

  const { data: maps } = await supabase
    .from("maps")
    .select("*")
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  const mapList = (maps ?? []) as GameMap[];
  const activeMap =
    mapList.find((m) => m.is_active) ?? mapList[0] ?? null;

  let tokens: Token[] = [];
  if (activeMap) {
    const { data } = await supabase
      .from("tokens")
      .select("*")
      .eq("map_id", activeMap.id);
    tokens = (data ?? []) as Token[];
  }

  const { data: chars } = await supabase
    .from("characters")
    .select("*")
    .eq("campaign_id", id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  return (
    <MapBoard
      campaignId={id}
      userId={userId}
      userName={profile?.display_name ?? "Jogador"}
      isMaster={isMaster}
      maps={mapList}
      activeMapId={activeMap?.id ?? null}
      initialTokens={tokens}
      characters={(chars ?? []) as Character[]}
    />
  );
}
