"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Character, GameMap, Token } from "@/lib/types";
import { CONDITIONS } from "@/lib/dnd";
import { InitiativeBar } from "@/components/InitiativeBar";

const TOKEN_COLORS = [
  "#b91c1c",
  "#1d4ed8",
  "#15803d",
  "#a21caf",
  "#c2410c",
  "#0e7490",
  "#7c3aed",
  "#4d7c0f",
];

// Gera uma cor estável (HSL) a partir do id do usuário.
function colorFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h}, 70%, 55%)`;
}

interface CursorState {
  x: number;
  y: number;
  name: string;
  color: string;
  ts: number;
}
interface PingState {
  id: string;
  x: number;
  y: number;
  color: string;
}
interface PresenceUser {
  userId: string;
  name: string;
  color: string;
}

export function MapBoard({
  campaignId,
  userId,
  userName,
  isMaster,
  maps,
  activeMapId,
  initialTokens,
  characters,
}: {
  campaignId: string;
  userId: string;
  userName: string;
  isMaster: boolean;
  maps: GameMap[];
  activeMapId: string | null;
  initialTokens: Token[];
  characters: Character[];
}) {
  const myColor = colorFromId(userId);
  const supabase = useRef(createClient());
  const [mapList, setMapList] = useState<GameMap[]>(maps);
  const [currentMapId, setCurrentMapId] = useState<string | null>(activeMapId);
  const [tokens, setTokens] = useState<Token[]>(initialTokens);
  const [uploading, setUploading] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [fogTool, setFogTool] = useState<"off" | "reveal" | "hide">("off");
  const [rulerOn, setRulerOn] = useState(false);
  const [cursors, setCursors] = useState<Record<string, CursorState>>({});
  const [pings, setPings] = useState<PingState[]>([]);
  const [online, setOnline] = useState<PresenceUser[]>([]);
  const [ruler, setRuler] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const currentMap = mapList.find((m) => m.id === currentMapId) ?? null;
  const selectedToken =
    tokens.find((t) => t.id === selectedTokenId) ?? null;

  // ---- Realtime: tokens do mapa atual ----
  useEffect(() => {
    if (!currentMapId) return;
    const sb = supabase.current;

    // Recarrega tokens ao trocar de mapa.
    sb.from("tokens")
      .select("*")
      .eq("map_id", currentMapId)
      .then(({ data }) => setTokens((data ?? []) as Token[]));

    const channel = sb
      .channel(`tokens:${currentMapId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tokens",
          filter: `map_id=eq.${currentMapId}`,
        },
        (payload) => {
          setTokens((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((t) => t.id !== (payload.old as Token).id);
            }
            const row = payload.new as Token;
            const exists = prev.some((t) => t.id === row.id);
            // Ignora eco do token que estou arrastando.
            if (row.id === draggingId.current) return prev;
            return exists
              ? prev.map((t) => (t.id === row.id ? row : t))
              : [...prev, row];
          });
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [currentMapId]);

  // ---- Realtime: mudança de mapa ativo (mestre troca o mapa de todos) ----
  useEffect(() => {
    const sb = supabase.current;
    const channel = sb
      .channel(`maps:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "maps",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as GameMap).id;
            setMapList((prev) => prev.filter((m) => m.id !== oldId));
            return;
          }
          const row = payload.new as GameMap;
          setMapList((prev) => {
            const exists = prev.some((m) => m.id === row.id);
            return exists
              ? prev.map((m) => (m.id === row.id ? row : m))
              : [...prev, row];
          });
          // Jogadores seguem o mapa marcado como ativo pelo mestre.
          if (row.is_active && !isMaster) setCurrentMapId(row.id);
        }
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [campaignId, isMaster]);

  // ---- Sala em tempo real: presença, cursores e pings ----
  const roomChannel = useRef<RealtimeChannel | null>(null);
  useEffect(() => {
    const sb = supabase.current;
    const channel = sb.channel(`room:${campaignId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        if (payload.userId === userId) return;
        setCursors((prev) => ({
          ...prev,
          [payload.userId]: {
            x: payload.x,
            y: payload.y,
            name: payload.name,
            color: payload.color,
            ts: Date.now(),
          },
        }));
      })
      .on("broadcast", { event: "ping" }, ({ payload }) => {
        const id: string = payload.id;
        setPings((prev) => [
          ...prev,
          { id, x: payload.x, y: payload.y, color: payload.color },
        ]);
        setTimeout(
          () => setPings((prev) => prev.filter((p) => p.id !== id)),
          1600
        );
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users = Object.keys(state).map((key) => {
          const meta = state[key][0];
          return { userId: meta.userId, name: meta.name, color: meta.color };
        });
        setOnline(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, name: userName, color: myColor });
        }
      });

    roomChannel.current = channel;
    return () => {
      sb.removeChannel(channel);
      roomChannel.current = null;
    };
  }, [campaignId, userId, userName, myColor]);

  // Remove cursores parados há mais de 5s.
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - 5000;
      setCursors((prev) => {
        const next: Record<string, CursorState> = {};
        for (const [k, v] of Object.entries(prev))
          if (v.ts > cutoff) next[k] = v;
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ---- Drag / clique de tokens ----
  const draggingId = useRef<string | null>(null);
  const lastSent = useRef(0);
  const moved = useRef(false);

  function canMove(token: Token) {
    return (
      isMaster ||
      characters.some(
        (c) => c.id === token.character_id && c.owner_id === userId
      )
    );
  }

  const persistPosition = useCallback((id: string, x: number, y: number) => {
    supabase.current.from("tokens").update({ x, y }).eq("id", id).then();
  }, []);

  const onPointerDownToken = (e: React.PointerEvent, token: Token) => {
    e.preventDefault();
    moved.current = false;
    if (!canMove(token)) {
      // Não pode mover, mas pode inspecionar — trata como clique.
      draggingId.current = token.id;
      return;
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingId.current = token.id;
  };

  // Converte coordenadas de tela em coordenadas do mapa.
  const boardCoords = useCallback((clientX: number, clientY: number) => {
    const el = boardRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: clientX - rect.left + el.scrollLeft,
      y: clientY - rect.top + el.scrollTop,
    };
  }, []);

  const lastCursorSent = useRef(0);
  const measuringRuler = useRef(false);

  const onPointerMove = (e: React.PointerEvent) => {
    const { x: mx, y: my } = boardCoords(e.clientX, e.clientY);

    // Cursor ao vivo (throttle ~50ms).
    const now = Date.now();
    if (roomChannel.current && now - lastCursorSent.current > 50) {
      lastCursorSent.current = now;
      roomChannel.current.send({
        type: "broadcast",
        event: "cursor",
        payload: { userId, name: userName, color: myColor, x: mx, y: my },
      });
    }

    // Régua de medição.
    if (measuringRuler.current) {
      setRuler((r) => (r ? { ...r, x2: mx, y2: my } : r));
      return;
    }

    if (paintingFog.current) {
      paintFogAt(e.clientX, e.clientY);
      return;
    }
    const id = draggingId.current;
    if (!id || !boardRef.current || !currentMap) return;
    const t = tokens.find((tk) => tk.id === id);
    if (!t || !canMove(t)) return;
    moved.current = true;
    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + boardRef.current.scrollLeft;
    const y = e.clientY - rect.top + boardRef.current.scrollTop;
    setTokens((prev) => prev.map((tk) => (tk.id === id ? { ...tk, x, y } : tk)));
    if (now - lastSent.current > 60) {
      lastSent.current = now;
      persistPosition(id, x, y);
    }
  };

  const onPointerUp = () => {
    if (measuringRuler.current) {
      measuringRuler.current = false;
      setRuler(null);
      return;
    }
    if (paintingFog.current) {
      paintingFog.current = false;
      return;
    }
    const id = draggingId.current;
    if (!id) return;
    draggingId.current = null;

    // Clique sem arraste → abre o painel do token.
    if (!moved.current) {
      setSelectedTokenId(id);
      return;
    }

    const t = tokens.find((tk) => tk.id === id);
    if (t) {
      let { x, y } = t;
      if (currentMap?.grid_enabled) {
        const g = currentMap.grid_size;
        x = Math.round(x / g) * g;
        y = Math.round(y / g) * g;
        setTokens((prev) => prev.map((tk) => (tk.id === id ? { ...tk, x, y } : tk)));
      }
      persistPosition(id, x, y);
    }
  };

  // ---- Edição de token (HP, condições, visibilidade) ----
  async function updateToken(id: string, patch: Partial<Token>) {
    setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await supabase.current
      .from("tokens")
      .update(patch as never)
      .eq("id", id);
  }

  function applyHpDelta(token: Token, delta: number) {
    const max = token.max_hp ?? 0;
    const cur = token.current_hp ?? max;
    let next = cur + delta;
    if (max > 0) next = Math.min(next, max);
    next = Math.max(next, 0);
    updateToken(token.id, { current_hp: next });
  }

  function toggleCondition(token: Token, key: string) {
    const has = token.conditions?.includes(key);
    const next = has
      ? token.conditions.filter((c) => c !== key)
      : [...(token.conditions ?? []), key];
    updateToken(token.id, { conditions: next });
  }

  // ---- Névoa de guerra ----
  const paintingFog = useRef(false);
  const fogTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function persistRevealed(mapId: string, revealed: string[]) {
    if (fogTimer.current) clearTimeout(fogTimer.current);
    fogTimer.current = setTimeout(() => {
      supabase.current
        .from("maps")
        .update({ revealed } as never)
        .eq("id", mapId)
        .then();
    }, 300);
  }

  function paintFogAt(clientX: number, clientY: number) {
    if (!currentMap || !boardRef.current || fogTool === "off") return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = clientX - rect.left + boardRef.current.scrollLeft;
    const y = clientY - rect.top + boardRef.current.scrollTop;
    const g = currentMap.grid_size;
    const key = `${Math.floor(x / g)},${Math.floor(y / g)}`;
    const set = new Set(currentMap.revealed ?? []);
    if (fogTool === "reveal") set.add(key);
    else set.delete(key);
    const next = [...set];
    setMapList((prev) =>
      prev.map((m) => (m.id === currentMap.id ? { ...m, revealed: next } : m))
    );
    persistRevealed(currentMap.id, next);
  }

  function revealAll(reveal: boolean) {
    if (!currentMap) return;
    let next: string[] = [];
    if (reveal) {
      const cols = Math.ceil(currentMap.width / currentMap.grid_size);
      const rows = Math.ceil(currentMap.height / currentMap.grid_size);
      for (let cx = 0; cx < cols; cx++)
        for (let cy = 0; cy < rows; cy++) next.push(`${cx},${cy}`);
    }
    setMapList((prev) =>
      prev.map((m) => (m.id === currentMap.id ? { ...m, revealed: next } : m))
    );
    supabase.current
      .from("maps")
      .update({ revealed: next } as never)
      .eq("id", currentMap.id)
      .then();
  }

  // ---- Ações do mestre ----
  async function uploadMap(file: File) {
    setUploading(true);
    try {
      const sb = supabase.current;
      const ext = file.name.split(".").pop();
      const path = `${campaignId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("maps")
        .upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = sb.storage.from("maps").getPublicUrl(path);

      const { data, error } = await sb
        .from("maps")
        .insert({
          campaign_id: campaignId,
          name: file.name.replace(/\.[^.]+$/, ""),
          image_url: pub.publicUrl,
          is_active: mapList.length === 0,
        })
        .select("*")
        .single();
      if (error) throw error;
      const newMap = data as GameMap;
      setMapList((prev) => [...prev, newMap]);
      setCurrentMapId(newMap.id);
    } catch (err) {
      alert("Erro ao enviar mapa: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function activateMap(mapId: string) {
    const sb = supabase.current;
    setCurrentMapId(mapId);
    // Desativa os demais e ativa este (jogadores seguem via realtime).
    await sb
      .from("maps")
      .update({ is_active: false })
      .eq("campaign_id", campaignId)
      .neq("id", mapId);
    await sb.from("maps").update({ is_active: true }).eq("id", mapId);
    setMapList((prev) =>
      prev.map((m) => ({ ...m, is_active: m.id === mapId }))
    );
  }

  async function deleteMap(mapId: string) {
    if (!confirm("Apagar este mapa?")) return;
    await supabase.current.from("maps").delete().eq("id", mapId);
    setMapList((prev) => prev.filter((m) => m.id !== mapId));
    if (currentMapId === mapId) setCurrentMapId(null);
  }

  async function updateMapField(patch: Partial<GameMap>) {
    if (!currentMap) return;
    setMapList((prev) =>
      prev.map((m) => (m.id === currentMap.id ? { ...m, ...patch } : m))
    );
    await supabase.current
      .from("maps")
      .update(patch as never)
      .eq("id", currentMap.id);
  }

  async function addToken(opts: {
    label: string;
    color: string;
    character_id?: string;
    image_url?: string | null;
    max_hp?: number | null;
    current_hp?: number | null;
  }) {
    if (!currentMap) return;
    const { data, error } = await supabase.current
      .from("tokens")
      .insert({
        map_id: currentMap.id,
        label: opts.label,
        color: opts.color,
        character_id: opts.character_id ?? null,
        image_url: opts.image_url ?? null,
        max_hp: opts.max_hp ?? null,
        current_hp: opts.current_hp ?? null,
        x: 40,
        y: 40,
      })
      .select("*")
      .single();
    if (!error && data) setTokens((prev) => [...prev, data as Token]);
  }

  async function removeToken(id: string) {
    await supabase.current.from("tokens").delete().eq("id", id);
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }

  const grid = currentMap?.grid_size ?? 50;

  return (
    <div className="space-y-3">
      <InitiativeBar campaignId={campaignId} />
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      {/* Tabuleiro */}
      <div>
        {/* Barra de presença e ferramentas */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {online.map((u) => (
              <span
                key={u.userId}
                title={u.name}
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-surface"
                style={{ backgroundColor: u.color }}
              >
                {u.name.slice(0, 2).toUpperCase()}
              </span>
            ))}
            <span className="ml-1 text-xs text-muted">
              {online.length} online
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              className={`rounded px-2 py-1 text-xs font-semibold ${
                rulerOn
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-muted hover:text-foreground"
              }`}
              onClick={() => setRulerOn((v) => !v)}
              title="Medir distância arrastando no mapa"
            >
              📏 Régua
            </button>
            <span className="text-xs text-muted">Alt+clique = ping</span>
          </div>
        </div>

        {currentMap ? (
          <div
            ref={boardRef}
            className="relative max-h-[75vh] overflow-auto rounded-lg border border-border bg-black"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <div
              className="relative"
              style={{
                width: currentMap.width,
                height: currentMap.height,
                backgroundImage: currentMap.image_url
                  ? `url(${currentMap.image_url})`
                  : undefined,
                backgroundSize: "100% 100%",
                cursor: fogTool !== "off" ? "crosshair" : undefined,
              }}
              onPointerDown={(e) => {
                const { x, y } = boardCoords(e.clientX, e.clientY);
                // Alt+clique = ping para todos.
                if (e.altKey) {
                  e.preventDefault();
                  const id = crypto.randomUUID();
                  setPings((prev) => [...prev, { id, x, y, color: myColor }]);
                  setTimeout(
                    () => setPings((prev) => prev.filter((p) => p.id !== id)),
                    1600
                  );
                  roomChannel.current?.send({
                    type: "broadcast",
                    event: "ping",
                    payload: { id, x, y, color: myColor },
                  });
                  return;
                }
                // Régua de medição.
                if (rulerOn) {
                  e.preventDefault();
                  measuringRuler.current = true;
                  setRuler({ x1: x, y1: y, x2: x, y2: y });
                  return;
                }
                // Pincel de névoa (mestre).
                if (isMaster && fogTool !== "off") {
                  e.preventDefault();
                  paintingFog.current = true;
                  paintFogAt(e.clientX, e.clientY);
                }
              }}
            >
              {/* Grid */}
              {currentMap.grid_enabled && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)",
                    backgroundSize: `${grid}px ${grid}px`,
                  }}
                />
              )}
              {/* Tokens */}
              {tokens
                .filter((t) => isMaster || !t.is_hidden)
                .map((t) => {
                  const size = (t.size || 1) * grid;
                  return (
                    <div
                      key={t.id}
                      onPointerDown={(e) => onPointerDownToken(e, t)}
                      className="absolute flex select-none flex-col items-center justify-center rounded-full border-2 text-center shadow-lg"
                      style={{
                        left: t.x,
                        top: t.y,
                        width: size,
                        height: size,
                        borderColor: t.is_hidden ? "#666" : "#fff",
                        backgroundColor: t.color,
                        opacity: t.is_hidden ? 0.5 : 1,
                        cursor: "grab",
                        touchAction: "none",
                        backgroundImage: t.image_url
                          ? `url(${t.image_url})`
                          : undefined,
                        backgroundSize: "cover",
                      }}
                      title={t.label}
                    >
                      {!t.image_url && (
                        <span className="text-xs font-bold text-white drop-shadow">
                          {t.label.slice(0, 3)}
                        </span>
                      )}
                      {t.max_hp != null && (
                        <span className="absolute -bottom-4 rounded bg-black/70 px-1 text-[10px] text-white">
                          {t.current_hp}/{t.max_hp}
                        </span>
                      )}
                      {t.conditions?.length > 0 && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1 text-[11px] leading-none">
                          {t.conditions
                            .map(
                              (k) =>
                                CONDITIONS.find((cc) => cc.key === k)?.icon
                            )
                            .filter(Boolean)
                            .join("")}
                        </span>
                      )}
                    </div>
                  );
                })}

              {/* Névoa de guerra */}
              {currentMap.fog_enabled && (
                <FogOverlay map={currentMap} isMaster={isMaster} />
              )}

              {/* Cursores dos outros jogadores */}
              {Object.entries(cursors).map(([uid, cur]) => (
                <div
                  key={uid}
                  className="pointer-events-none absolute z-30 flex items-center gap-1"
                  style={{ left: cur.x, top: cur.y }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <path
                      d="M0 0 L0 12 L3.5 9 L6 14 L8 13 L5.5 8 L10 8 Z"
                      fill={cur.color}
                      stroke="#000"
                      strokeWidth="0.5"
                    />
                  </svg>
                  <span
                    className="rounded px-1 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: cur.color }}
                  >
                    {cur.name}
                  </span>
                </div>
              ))}

              {/* Pings */}
              {pings.map((p) => (
                <div
                  key={p.id}
                  className="pointer-events-none absolute z-30"
                  style={{ left: p.x - 20, top: p.y - 20 }}
                >
                  <span
                    className="block h-10 w-10 animate-ping rounded-full"
                    style={{ backgroundColor: p.color, opacity: 0.7 }}
                  />
                </div>
              ))}

              {/* Régua de medição */}
              {ruler && currentMap && (
                <RulerOverlay ruler={ruler} grid={currentMap.grid_size} />
              )}
            </div>
          </div>
        ) : (
          <div className="card flex h-64 items-center justify-center text-muted">
            {isMaster
              ? "Envie um mapa para começar →"
              : "O mestre ainda não abriu um mapa."}
          </div>
        )}
      </div>

      {/* Painel lateral */}
      <div className="space-y-4">
        {isMaster && (
          <div className="card space-y-3">
            <h3 className="font-semibold text-primary">Mapas</h3>
            <label className="btn-secondary w-full cursor-pointer text-sm">
              {uploading ? "Enviando…" : "📤 Enviar mapa"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMap(f);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="space-y-1">
              {mapList.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-sm ${
                    m.id === currentMapId ? "bg-surface-2" : ""
                  }`}
                >
                  <button
                    className="flex-1 truncate text-left hover:text-primary"
                    onClick={() => setCurrentMapId(m.id)}
                  >
                    {m.is_active && "🟢 "}
                    {m.name}
                  </button>
                  <button
                    className="text-xs text-muted hover:text-primary"
                    title="Tornar ativo para todos"
                    onClick={() => activateMap(m.id)}
                  >
                    ▶
                  </button>
                  <button
                    className="text-xs text-danger"
                    onClick={() => deleteMap(m.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isMaster && currentMap && (
          <div className="card space-y-2">
            <h3 className="font-semibold text-primary">Configurar mapa</h3>
            <label className="flex items-center justify-between text-sm">
              Grid
              <input
                type="checkbox"
                checked={currentMap.grid_enabled}
                onChange={(e) =>
                  updateMapField({ grid_enabled: e.target.checked })
                }
              />
            </label>
            <label className="block text-sm">
              Tamanho da célula: {currentMap.grid_size}px
              <input
                type="range"
                min={20}
                max={120}
                value={currentMap.grid_size}
                className="w-full"
                onChange={(e) =>
                  updateMapField({ grid_size: parseInt(e.target.value, 10) })
                }
              />
            </label>

            {/* Névoa de guerra */}
            <div className="border-t border-border pt-2">
              <label className="flex items-center justify-between text-sm">
                🌫️ Névoa de guerra
                <input
                  type="checkbox"
                  checked={currentMap.fog_enabled}
                  onChange={(e) => {
                    updateMapField({ fog_enabled: e.target.checked });
                    if (!e.target.checked) setFogTool("off");
                  }}
                />
              </label>
              {currentMap.fog_enabled && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-1">
                    <button
                      className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${
                        fogTool === "reveal"
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-2 text-muted"
                      }`}
                      onClick={() =>
                        setFogTool(fogTool === "reveal" ? "off" : "reveal")
                      }
                    >
                      ✏️ Revelar
                    </button>
                    <button
                      className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${
                        fogTool === "hide"
                          ? "bg-accent text-white"
                          : "bg-surface-2 text-muted"
                      }`}
                      onClick={() =>
                        setFogTool(fogTool === "hide" ? "off" : "hide")
                      }
                    >
                      🩹 Ocultar
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="btn-secondary flex-1 text-xs"
                      onClick={() => revealAll(true)}
                    >
                      Revelar tudo
                    </button>
                    <button
                      className="btn-secondary flex-1 text-xs"
                      onClick={() => revealAll(false)}
                    >
                      Ocultar tudo
                    </button>
                  </div>
                  {fogTool !== "off" && (
                    <p className="text-xs text-primary">
                      Pincel ativo — clique/arraste no mapa.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {currentMap && (
          <div className="card space-y-2">
            <h3 className="font-semibold text-primary">Tokens</h3>
            {isMaster && (
              <>
                <p className="text-xs text-muted">Adicionar de personagens:</p>
                <div className="max-h-40 space-y-1 overflow-auto">
                  {characters.map((c, i) => (
                    <button
                      key={c.id}
                      className="block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-surface-2"
                      onClick={() =>
                        addToken({
                          label: c.name,
                          color: TOKEN_COLORS[i % TOKEN_COLORS.length],
                          character_id: c.id,
                          image_url: c.avatar_url,
                          max_hp: c.max_hp,
                          current_hp: c.current_hp,
                        })
                      }
                    >
                      ＋ {c.name}
                    </button>
                  ))}
                </div>
                <button
                  className="btn-secondary w-full text-xs"
                  onClick={() =>
                    addToken({
                      label: "Inimigo",
                      color: TOKEN_COLORS[0],
                    })
                  }
                >
                  + Token avulso
                </button>
              </>
            )}

            {/* Lista de tokens no mapa */}
            <div className="space-y-1 border-t border-border pt-2">
              {tokens.length === 0 && (
                <p className="text-xs text-muted">Nenhum token no mapa.</p>
              )}
              {tokens.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="flex-1 truncate">{t.label}</span>
                  {isMaster && (
                    <button
                      className="text-xs text-danger"
                      onClick={() => removeToken(t.id)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Painel do token selecionado */}
      {selectedToken && (
        <TokenPanel
          token={selectedToken}
          canEdit={isMaster || canMove(selectedToken)}
          isMaster={isMaster}
          onClose={() => setSelectedTokenId(null)}
          onHpDelta={(d) => applyHpDelta(selectedToken, d)}
          onSetHp={(hp) => updateToken(selectedToken.id, { current_hp: hp })}
          onToggleCondition={(k) => toggleCondition(selectedToken, k)}
          onToggleHidden={() =>
            updateToken(selectedToken.id, {
              is_hidden: !selectedToken.is_hidden,
            })
          }
          onRemove={() => {
            removeToken(selectedToken.id);
            setSelectedTokenId(null);
          }}
        />
      )}
    </div>
  );
}

// ---- Overlay da régua de medição ----
function RulerOverlay({
  ruler,
  grid,
}: {
  ruler: { x1: number; y1: number; x2: number; y2: number };
  grid: number;
}) {
  const dx = ruler.x2 - ruler.x1;
  const dy = ruler.y2 - ruler.y1;
  // Regra 5e: cada quadrado = 1,5m, diagonais contam como 1 (Chebyshev).
  const squares = Math.round(Math.max(Math.abs(dx), Math.abs(dy)) / grid);
  const meters = (squares * 1.5).toFixed(1);
  const midX = (ruler.x1 + ruler.x2) / 2;
  const midY = (ruler.y1 + ruler.y2) / 2;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <line
          x1={ruler.x1}
          y1={ruler.y1}
          x2={ruler.x2}
          y2={ruler.y2}
          stroke="#c9a44c"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      </svg>
      <span
        className="absolute rounded bg-black/80 px-1.5 py-0.5 text-xs font-bold text-primary"
        style={{ left: midX, top: midY }}
      >
        {squares} q • {meters}m
      </span>
    </div>
  );
}

// ---- Overlay da névoa de guerra ----
function FogOverlay({ map, isMaster }: { map: GameMap; isMaster: boolean }) {
  const g = map.grid_size;
  const cols = Math.ceil(map.width / g);
  const rows = Math.ceil(map.height / g);
  const revealed = new Set(map.revealed ?? []);

  const cells: React.ReactNode[] = [];
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      if (revealed.has(`${cx},${cy}`)) continue;
      cells.push(
        <div
          key={`${cx},${cy}`}
          className="absolute"
          style={{
            left: cx * g,
            top: cy * g,
            width: g,
            height: g,
            // Mestre vê através (semi-transparente); jogador vê preto sólido.
            background: isMaster ? "rgba(0,0,0,0.55)" : "#000",
          }}
        />
      );
    }
  }

  // Inerte: os cliques atravessam para o div do mapa (pincel do mestre).
  return <div className="pointer-events-none absolute inset-0">{cells}</div>;
}

// ---- Painel flutuante de combate do token ----
function TokenPanel({
  token,
  canEdit,
  isMaster,
  onClose,
  onHpDelta,
  onSetHp,
  onToggleCondition,
  onToggleHidden,
  onRemove,
}: {
  token: Token;
  canEdit: boolean;
  isMaster: boolean;
  onClose: () => void;
  onHpDelta: (delta: number) => void;
  onSetHp: (hp: number) => void;
  onToggleCondition: (key: string) => void;
  onToggleHidden: () => void;
  onRemove: () => void;
}) {
  const [amount, setAmount] = useState("");
  const amt = parseInt(amount, 10) || 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg rounded-t-xl border border-border bg-surface p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: token.color }}
          />
          <span className="font-semibold">{token.label}</span>
        </div>
        <button className="btn-ghost text-xs" onClick={onClose}>
          Fechar ✕
        </button>
      </div>

      {/* Pontos de vida */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">PV:</span>
        <input
          type="number"
          className="input w-20 text-center"
          value={token.current_hp ?? ""}
          disabled={!canEdit}
          onChange={(e) => onSetHp(parseInt(e.target.value, 10) || 0)}
        />
        <span className="text-sm text-muted">/ {token.max_hp ?? "—"}</span>
        {canEdit && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              className="input w-16 text-center"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button
              className="btn-danger px-2 text-xs"
              onClick={() => {
                onHpDelta(-amt);
                setAmount("");
              }}
            >
              − Dano
            </button>
            <button
              className="btn-primary px-2 text-xs"
              onClick={() => {
                onHpDelta(amt);
                setAmount("");
              }}
            >
              + Cura
            </button>
          </div>
        )}
      </div>

      {/* Condições */}
      <div>
        <p className="label">Condições</p>
        <div className="flex flex-wrap gap-1">
          {CONDITIONS.map((cond) => {
            const active = token.conditions?.includes(cond.key);
            return (
              <button
                key={cond.key}
                disabled={!canEdit}
                onClick={() => onToggleCondition(cond.key)}
                title={cond.label}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  active
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-muted hover:text-foreground"
                }`}
              >
                {cond.icon} {cond.label}
              </button>
            );
          })}
        </div>
      </div>

      {isMaster && (
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <button className="btn-secondary text-xs" onClick={onToggleHidden}>
            {token.is_hidden ? "👁️ Revelar" : "🙈 Esconder"}
          </button>
          <button className="btn-ghost text-xs text-danger" onClick={onRemove}>
            Remover token
          </button>
        </div>
      )}
    </div>
  );
}
