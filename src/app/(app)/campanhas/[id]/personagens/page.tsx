import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCampaignContext } from "@/lib/campaign";
import { abilityModifier, formatModifier } from "@/lib/dnd";
import type { Character } from "@/lib/types";
import { NewCharacterButton } from "@/components/NewCharacterButton";

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, isMaster } = await getCampaignContext(id);
  const supabase = await createClient();

  const { data } = await supabase
    .from("characters")
    .select("*")
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  const characters = (data ?? []) as Character[];
  const pcs = characters.filter((c) => !c.is_npc);
  const npcs = characters.filter((c) => c.is_npc);

  function CharCard({ c }: { c: Character }) {
    const mine = c.owner_id === userId;
    return (
      <Link
        href={`/campanhas/${id}/personagens/${c.id}`}
        className="card flex items-center gap-3 transition-colors hover:border-primary"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-lg">
          {c.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.avatar_url}
              alt={c.name}
              className="h-full w-full object-cover"
            />
          ) : (
            "🧙"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{c.name}</span>
            {mine && (
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                SEU
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted">
            {[c.race, c.class && `${c.class} ${c.level}`]
              .filter(Boolean)
              .join(" • ") || "Sem classe definida"}
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>
            ❤️ {c.current_hp}/{c.max_hp}
          </div>
          <div>🛡️ CA {c.armor_class}</div>
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Personagens</h2>
        <NewCharacterButton campaignId={id} />
      </div>

      {pcs.length === 0 ? (
        <div className="card text-center text-muted">
          Nenhum personagem ainda. Crie sua ficha!
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pcs.map((c) => (
            <CharCard key={c.id} c={c} />
          ))}
        </div>
      )}

      {(isMaster || npcs.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            NPCs
          </h3>
          {npcs.length === 0 ? (
            <p className="text-sm text-muted">Nenhum NPC criado.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {npcs.map((c) => (
                <CharCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dica de modificadores para referência rápida */}
      <p className="text-xs text-muted">
        Lembrete: modificador = (atributo − 10) ÷ 2 arredondado para baixo. Ex:
        16 → {formatModifier(abilityModifier(16))}, 8 →{" "}
        {formatModifier(abilityModifier(8))}.
      </p>
    </div>
  );
}
