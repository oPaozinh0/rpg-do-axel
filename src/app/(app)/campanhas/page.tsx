import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createCampaign, joinCampaign } from "./actions";
import type { Campaign } from "@/lib/types";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Campanhas onde sou membro (RLS já filtra por membro/mestre).
  const { data: memberships } = await supabase
    .from("campaign_members")
    .select("role, campaigns(*)")
    .eq("user_id", user!.id);

  const campaigns = (memberships ?? [])
    .map((m) => ({
      role: m.role as "master" | "player",
      campaign: m.campaigns as unknown as Campaign,
    }))
    .filter((m) => m.campaign);

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Suas Campanhas
        </h1>
        <p className="text-sm text-muted">
          Crie uma mesa como mestre ou entre numa com o código de convite.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Lista de campanhas */}
      {campaigns.length === 0 ? (
        <div className="card text-center text-muted">
          Você ainda não participa de nenhuma campanha.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map(({ campaign, role }) => (
            <Link
              key={campaign.id}
              href={`/campanhas/${campaign.id}`}
              className="card transition-colors hover:border-primary"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-foreground">
                  {campaign.name}
                </h2>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    role === "master"
                      ? "bg-primary/20 text-primary"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  {role === "master" ? "Mestre" : "Jogador"}
                </span>
              </div>
              {campaign.description && (
                <p className="mt-2 line-clamp-3 text-sm text-muted">
                  {campaign.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Ações: criar / entrar */}
      <div className="grid gap-4 md:grid-cols-2">
        <form action={createCampaign} className="card space-y-3">
          <h3 className="font-semibold text-primary">Criar campanha (como mestre)</h3>
          <div>
            <label className="label" htmlFor="name">
              Nome da campanha
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="A Maldição de Strahd"
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              Descrição (opcional)
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Uma aventura sombria em Barovia..."
              className="input resize-none"
            />
          </div>
          <button className="btn-primary w-full">Criar mesa</button>
        </form>

        <form action={joinCampaign} className="card space-y-3">
          <h3 className="font-semibold text-foreground">Entrar numa campanha</h3>
          <div>
            <label className="label" htmlFor="invite_code">
              Código de convite
            </label>
            <input
              id="invite_code"
              name="invite_code"
              required
              placeholder="ex: a1b2c3d4"
              className="input font-mono"
            />
          </div>
          <p className="text-xs text-muted">
            Peça o código ao mestre da mesa (o Axel!).
          </p>
          <button className="btn-secondary w-full">Entrar</button>
        </form>
      </div>
    </div>
  );
}
