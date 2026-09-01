import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Campaign, Role } from "@/lib/types";

export interface CampaignContext {
  campaign: Campaign;
  userId: string;
  role: Role;
  isMaster: boolean;
}

/**
 * Carrega a campanha e o papel do usuário atual.
 * Redireciona se não for membro ou a campanha não existir.
 */
export async function getCampaignContext(
  campaignId: string
): Promise<CampaignContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) redirect("/campanhas");

  const { data: membership } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) redirect("/campanhas");

  const role = membership.role as Role;
  return {
    campaign: campaign as Campaign,
    userId: user.id,
    role,
    isMaster: role === "master",
  };
}
