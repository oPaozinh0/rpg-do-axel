import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCampaignContext } from "@/lib/campaign";
import { CharacterSheet } from "@/components/CharacterSheet";
import type { Character } from "@/lib/types";

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ id: string; charId: string }>;
}) {
  const { id, charId } = await params;
  const { userId, isMaster } = await getCampaignContext(id);
  const supabase = await createClient();

  const { data } = await supabase
    .from("characters")
    .select("*")
    .eq("id", charId)
    .maybeSingle();

  if (!data) notFound();
  const character = data as Character;
  const canEdit = isMaster || character.owner_id === userId;

  return (
    <div className="space-y-3">
      <Link
        href={`/campanhas/${id}/personagens`}
        className="text-xs text-muted hover:text-foreground"
      >
        ← Voltar para personagens
      </Link>
      <CharacterSheet
        character={character}
        canEdit={canEdit}
        userId={userId}
      />
    </div>
  );
}
