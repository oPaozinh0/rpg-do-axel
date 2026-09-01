import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCampaignContext } from "@/lib/campaign";
import { MasterPanel } from "@/components/MasterPanel";
import type { CampaignMember, CampaignNote, InitiativeEntry } from "@/lib/types";

export default async function MasterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { isMaster } = await getCampaignContext(id);
  if (!isMaster) redirect(`/campanhas/${id}/mapa`);

  const supabase = await createClient();

  const { data: notes } = await supabase
    .from("campaign_notes")
    .select("*")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false });

  const { data: initiative } = await supabase
    .from("initiative_entries")
    .select("*")
    .eq("campaign_id", id)
    .order("sort_order", { ascending: true });

  const { data: members } = await supabase
    .from("campaign_members")
    .select("user_id, role, profiles(id, display_name, avatar_url, created_at)")
    .eq("campaign_id", id);

  return (
    <MasterPanel
      campaignId={id}
      initialNotes={(notes ?? []) as CampaignNote[]}
      initialInitiative={(initiative ?? []) as InitiativeEntry[]}
      members={(members ?? []) as unknown as CampaignMember[]}
    />
  );
}
