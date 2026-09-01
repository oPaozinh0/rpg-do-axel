"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createCampaign(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return;

  const { data, error } = await supabase
    .from("campaigns")
    .insert({ name, description: description || null, master_id: user.id })
    .select("id")
    .single();

  if (error) {
    redirect(`/campanhas?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/campanhas");
  redirect(`/campanhas/${data!.id}`);
}

export async function joinCampaign(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const code = String(formData.get("invite_code") ?? "")
    .trim()
    .toLowerCase();
  if (!code) return;

  const { data: campaignId, error } = await supabase.rpc(
    "join_campaign_by_code",
    { code }
  );

  if (error || !campaignId) {
    const msg = error?.message.includes("CODIGO_INVALIDO")
      ? "Código de convite inválido."
      : (error?.message ?? "Não foi possível entrar na campanha.");
    redirect(`/campanhas?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/campanhas");
  redirect(`/campanhas/${campaignId}`);
}
