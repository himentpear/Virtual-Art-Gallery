import { DurableObject } from 'cloudflare:workers'

export type WardrobeSnapshot = Record<string, string | number | boolean | null>

export interface PlayerSession {
  passId: string
  name: string
  title: string
  x: number
  floorY: number
  facing: 'left' | 'right'
  clipId: string
  activeMode: string
  activeSpotId?: string | null
  wardrobe?: WardrobeSnapshot
  joinedAt: number
}

type ClientMessage =
  | {
      type: 'join'
      player: Omit<PlayerSession, 'joinedAt'>
    }
  | {
      type: 'move'
      x: number
      floorY: number
      facing: 'left' | 'right'
      clipId: string
      activeMode?: string
      activeSpotId?: string | null
    }
  | {
      type: 'wardrobe'
      wardrobe: WardrobeSnapshot
    }
  | {
      type: 'chat'
      text: string
    }
  | {
      type: 'ping'
    }

export class GalleryRoomDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pass_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `)
    })
  }

  async getStats(): Promise<{ onlineCount: number; players: PlayerSession[] }> {
    const players = this.collectPlayers()
    return {
      onlineCount: players.length,
      players,
    }
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return Response.json({ error: 'Expected WebSocket upgrade' }, { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.ctx.acceptWebSocket(server)

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return

    let parsed: ClientMessage
    try {
      parsed = JSON.parse(message) as ClientMessage
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }))
      return
    }

    if (parsed.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
      return
    }

    if (parsed.type === 'join') {
      const session: PlayerSession = {
        ...parsed.player,
        joinedAt: Date.now(),
      }
      ws.serializeAttachment(session)

      const snapshot = this.collectPlayers()
      ws.send(
        JSON.stringify({
          type: 'room_snapshot',
          players: snapshot,
        }),
      )

      this.broadcast(
        {
          type: 'player_joined',
          player: session,
        },
        ws,
      )
      return
    }

    const current = ws.deserializeAttachment() as PlayerSession | null
    if (!current) {
      ws.send(JSON.stringify({ type: 'error', message: 'Join room first' }))
      return
    }

    if (parsed.type === 'move') {
      const updated: PlayerSession = {
        ...current,
        x: parsed.x,
        floorY: parsed.floorY,
        facing: parsed.facing,
        clipId: parsed.clipId,
        activeMode: parsed.activeMode ?? current.activeMode,
        activeSpotId: parsed.activeSpotId ?? null,
      }
      ws.serializeAttachment(updated)
      this.broadcast(
        {
          type: 'player_moved',
          passId: updated.passId,
          x: updated.x,
          floorY: updated.floorY,
          facing: updated.facing,
          clipId: updated.clipId,
          activeMode: updated.activeMode,
          activeSpotId: updated.activeSpotId,
        },
        ws,
      )
      return
    }

    if (parsed.type === 'wardrobe') {
      const updated: PlayerSession = {
        ...current,
        wardrobe: parsed.wardrobe,
      }
      ws.serializeAttachment(updated)
      this.broadcast(
        {
          type: 'player_wardrobe',
          passId: updated.passId,
          wardrobe: parsed.wardrobe,
        },
        ws,
      )
      return
    }

    if (parsed.type === 'chat') {
      const text = parsed.text.trim().slice(0, 120)
      if (!text) return
      this.ctx.storage.sql.exec(
        'INSERT INTO room_events (pass_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)',
        current.passId,
        'chat',
        JSON.stringify({ name: current.name, text }),
        Date.now(),
      )
      this.broadcast({
        type: 'player_chat',
        passId: current.passId,
        name: current.name,
        text,
        ts: Date.now(),
      })
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.notifyLeave(ws)
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.notifyLeave(ws)
  }

  private notifyLeave(ws: WebSocket): void {
    const session = ws.deserializeAttachment() as PlayerSession | null
    if (!session) return
    this.broadcast(
      {
        type: 'player_left',
        passId: session.passId,
      },
      ws,
    )
  }

  private collectPlayers(): PlayerSession[] {
    const players: PlayerSession[] = []
    for (const socket of this.ctx.getWebSockets()) {
      const session = socket.deserializeAttachment() as PlayerSession | null
      if (session) players.push(session)
    }
    return players
  }

  private broadcast(payload: unknown, exclude?: WebSocket): void {
    const encoded = JSON.stringify(payload)
    for (const socket of this.ctx.getWebSockets()) {
      if (exclude && socket === exclude) continue
      try {
        socket.send(encoded)
      } catch {
        // Ignore broken sockets; close/error handler cleans up.
      }
    }
  }
}
