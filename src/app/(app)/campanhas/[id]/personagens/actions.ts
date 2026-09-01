"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createCharacter(campaignId: string, isNpc = false) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("characters")
    .insert({
      campaign_id: campaignId,
      owner_id: user.id,
      name: isNpc ? "Novo NPC" : "Novo Personagem",
      is_npc: isNpc,
    })
    .select("id")
    .single();

  if (error) {
    redirect(
      `/campanhas/${campaignId}/personagens?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath(`/campanhas/${campaignId}/personagens`);
  redirect(`/campanhas/${campaignId}/personagens/${data!.id}`);
}

export async function deleteCharacter(campaignId: string, characterId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("characters")
    .delete()
    .eq("id", characterId);

  if (error) {
    redirect(
      `/campanhas/${campaignId}/personagens?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath(`/campanhas/${campaignId}/personagens`);
  redirect(`/campanhas/${campaignId}/personagens`);
}
