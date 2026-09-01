"use client";

import { useState } from "react";

export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponível — ignora
    }
  }

  return (
    <button
      onClick={copy}
      className="btn-secondary text-xs"
      title="Clique para copiar o código de convite"
    >
      <span className="text-muted">Convite:</span>
      <span className="font-mono text-primary">{code}</span>
      <span>{copied ? "✓ copiado" : "📋"}</span>
    </button>
  );
}
