"use client";

import { useState, useTransition } from "react";
import { createCharacter } from "@/app/(app)/campanhas/[id]/personagens/actions";

export function NewCharacterButton({ campaignId }: { campaignId: string }) {
  const [pending, startTransition] = useTransition();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() => setShowMenu((s) => !s)}
      >
        + Novo
      </button>
      {showMenu && (
        <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          <button
            className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
            onClick={() => {
              setShowMenu(false);
              startTransition(() => createCharacter(campaignId, false));
            }}
          >
            🛡️ Personagem
          </button>
          <button
            className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
            onClick={() => {
              setShowMenu(false);
              startTransition(() => createCharacter(campaignId, true));
            }}
          >
            👹 NPC
          </button>
        </div>
      )}
    </div>
  );
}
