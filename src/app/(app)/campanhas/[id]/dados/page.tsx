import { createClient } from "@/lib/supabase/server";
import { getCampaignContext } from "@/lib/campaign";
import { DiceRoller } from "@/components/DiceRoller";
import type { DiceRoll, CampaignMember } from "@/lib/types";

export default async function DicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, isMaster } = await getCampaignContext(id);
  const supabase = await createClient();

  const { data: rolls } = await supabase
    .from("dice_rolls")
    .select("*")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: members } = await supabase
    .from("campaign_members")
    .select("user_id, role, profiles(id, display_name, avatar_url, created_at)")
    .eq("campaign_id", id);

  const nameMap: Record<string, string> = {};
  for (const m of (members ?? []) as unknown as CampaignMember[]) {
    if (m.profiles) nameMap[m.user_id] = m.profiles.display_name;
  }

  return (
    <DiceRoller
      campaignId={id}
      userId={userId}
      isMaster={isMaster}
      initialRolls={((rolls ?? []) as DiceRoll[]).reverse()}
      nameMap={nameMap}
    />
  );
}
