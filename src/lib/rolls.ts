import { createClient } from "@/lib/supabase/client";
import type { RollResult } from "@/lib/dnd";

/** Registra uma rolagem no log compartilhado da campanha. */
export async function logRoll(
  campaignId: string,
  userId: string,
  result: RollResult,
  isPrivate = false
) {
  const sb = createClient();
  await sb.from("dice_rolls").insert({
    campaign_id: campaignId,
    user_id: userId,
    formula: result.formula,
    result: result.total,
    detail: result.detail,
    is_private: isPrivate,
  });
}
