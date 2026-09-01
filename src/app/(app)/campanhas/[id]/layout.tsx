import Link from "next/link";
import { getCampaignContext } from "@/lib/campaign";
import { CampaignTabs } from "@/components/CampaignTabs";
import { InviteCode } from "@/components/InviteCode";

export default async function CampaignLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { campaign, isMaster } = await getCampaignContext(id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/campanhas"
            className="text-xs text-muted hover:text-foreground"
          >
            ← Campanhas
          </Link>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {campaign.name}
          </h1>
        </div>
        {isMaster && <InviteCode code={campaign.invite_code} />}
      </div>

      <CampaignTabs campaignId={id} isMaster={isMaster} />

      <div>{children}</div>
    </div>
  );
}
