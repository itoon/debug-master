// LiveRoom: one Durable Object per live race room (idFromName(code)).
// Hibernatable WebSockets; the room is persisted under storage key `room` so an eviction or
// restart keeps it. Room rules live in ./room-logic (pure); this class owns sockets, storage,
// alarms and broadcasting. Adapted from codeventure-signal-lost-main/worker/race-room.ts.
import { DurableObject } from 'cloudflare:workers'
import {
  BROADCAST_INTERVAL_MS,
  CLOSE_FULL,
  CLOSE_KICKED,
  CLOSE_STALE,
  HOST_KEY_RE,
  MAX_MSG_BYTES,
  normalizeRoomCode,
  type Role,
  type ServerMessage,
} from '../../app/utils/live/protocol'
import {
  advanceClock,
  applyHostCommand,
  claimHost,
  createRoom,
  hashHostKey,
  isIdleExpired,
  isSocketFresh,
  joinPlayer,
  leavePlayer,
  migrateRoom,
  nextAlarmAt,
  pidForPublicId,
  snapshot,
  type StoredRoom,
} from './room-logic'
import { SaveScheduler } from './save-scheduler'
import { applyGameplayEvent, scoringMessage } from './scoring'
import { parseClientMessage } from './validate'

/** Structural changes write immediately; gameplay uses an isolated durable candidate. */
type Persist = 'none' | 'now'

interface Attachment {
  role: Role
  /** Secret player pid bound by a successful `hello`; only then does the socket count as connected. */
  pid?: string
  /** Host socket that presented the room's host key. */
  host?: boolean
  /** Epoch ms of the last message on this socket (or of the upgrade); see isSocketFresh. */
  seen?: number
}

const ROLES: readonly Role[] = ['player', 'host', 'screen']
const isRole = (v: unknown): v is Role => typeof v === 'string' && (ROLES as readonly string[]).includes(v)

export class LiveRoom extends DurableObject<Env> {
  private room: StoredRoom = createRoom('', Date.now())
  /** Serialize across storage awaits, including hosts, reconnects and alarms. */
  private pending: Promise<unknown> = Promise.resolve()

  private serialize<T>(run: () => Promise<T>): Promise<T> {
    const next = this.pending.then(run)
    this.pending = next.catch(() => undefined)
    return next
  }
  /** Alarm time last written to storage (null = none), so unchanged alarms are not rewritten. */
  private alarmAt: number | null = null
  private lastBroadcast = 0
  private trailing: ReturnType<typeof setTimeout> | null = null
  private readonly saver = new SaveScheduler(() => this.ctx.storage.put('room', this.room))

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Client heartbeat, answered by the runtime without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
    void ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<StoredRoom>('room')
      if (saved) this.room = migrateRoom(saved)
      this.alarmAt = await ctx.storage.getAlarm()
    })
  }

  // ---- connection -----------------------------------------------------------

  fetch(request: Request): Promise<Response> {
    return this.serialize(() => this.handleFetch(request))
  }

  private async handleFetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }
    const url = new URL(request.url)
    let code: string | null = null
    try {
      code = normalizeRoomCode(decodeURIComponent(url.pathname.split('/')[2] ?? ''))
    } catch {
      /* malformed escape */
    }
    if (!code) return new Response('bad room code', { status: 400 })
    const role = url.searchParams.get('role')
    if (!isRole(role)) return new Response('bad role', { status: 400 })

    const now = Date.now()
    const before = { code: this.room.code, hostKeyHash: this.room.hostKeyHash }
    this.room.code = code
    const advanced = advanceClock(this.room, now)

    const att: Attachment = { role, seen: now }
    if (role === 'host') {
      const key = url.searchParams.get('key')
      // Hash first, then claim synchronously, so two racing hosts cannot both reserve the room.
      const keyHash = key && HOST_KEY_RE.test(key) ? await hashHostKey(key) : null
      att.host = claimHost(this.room, keyHash)
    }
    const roomChanged = advanced || before.code !== this.room.code || before.hostKeyHash !== this.room.hostKeyHash

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
    this.ctx.acceptWebSocket(server, [role])
    server.serializeAttachment(att)

    this.room.lastActivity = now
    await this.commit(true, roomChanged ? 'now' : 'none')
    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const receivedAt = Date.now()
    return this.serialize(() => this.handleMessage(ws, message, receivedAt))
  }

  private async handleMessage(ws: WebSocket, message: string | ArrayBuffer, now: number): Promise<void> {
    const att = this.attachment(ws)
    if (!att) return
    att.seen = now // any message proves the socket is alive (isSocketFresh)
    ws.serializeAttachment(att)
    const msg = parseClientMessage(message, att.role)
    if (!msg) {
      // Older clients submit cumulative progress. They must reload to use authoritative input events.
      if (typeof message === 'string' && message.length <= MAX_MSG_BYTES) {
        try {
          if (JSON.parse(message)?.type === 'progress') {
            this.send(ws, { type: 'reload', reason: 'unsupported_protocol' })
            return
          }
        } catch { /* malformed */ }
      }
      this.send(ws, { type: 'error', error: 'bad_message' })
      return
    }

    if (msg.type === 'gameplay') {
      if (!att.pid) { this.send(ws, scoringMessage(this.room, '', 'not_playing')); return }
      // Keep the currently published room untouched until storage succeeds. If put fails, a
      // retry applies to the old sequence and must persist again before it can acknowledge.
      const candidate = structuredClone(this.room)
      const advanced = advanceClock(candidate, now)
      const result = applyGameplayEvent(candidate, att.pid, msg, now)
      if (result.changed || advanced) {
        candidate.lastActivity = now
        await this.ctx.storage.put('room', candidate)
        this.room = candidate
      }
      this.send(ws, result.message)
      if (result.message.error === 'unsupported_version') this.send(ws, { type: 'reload', reason: 'unsupported_protocol' })
      await this.scheduleAlarm()
      if (result.changed || advanced) this.broadcast()
      return
    }

    // The clock is authoritative on every event, not only when the alarm fires.
    let changed = advanceClock(this.room, now)
    // Only real room changes are written; rejected or no-op messages cost no storage write.
    let persist: Persist = changed ? 'now' : 'none'

    switch (msg.type) {
      case 'hello': {
        if (!('pid' in msg)) {
          // host / screen hello: answer with the control flag and the current room.
          if (att.role === 'host') this.send(ws, { type: 'host', host: !!att.host })
          this.send(ws, { type: 'state', state: this.snapshot(now) })
          break
        }
        const status = joinPlayer(this.room, msg, this.connectedPids(), now)
        if (status === 'full') {
          // Never bound to a pid, so this socket is never counted as a connected player.
          this.send(ws, { type: 'full' })
          this.close(ws, CLOSE_FULL, 'room full')
          break
        }
        att.pid = msg.pid
        ws.serializeAttachment(att)
        // Answer with the public id only; the secret pid never leaves the hello.
        this.send(ws, { type: 'you', id: this.room.players[msg.pid]!.id, status })
        changed = true
        persist = 'now' // a join, or a profile edit
        break
      }
      case 'leave':
        if (att.pid && leavePlayer(this.room, att.pid)) persist = 'now'
        this.unbind(ws, att)
        this.close(ws, 1000, 'left')
        changed = true // the socket count changed
        break
      default: {
        // Host commands (parseClientMessage only returns them for role=host).
        if (!att.host) {
          this.send(ws, { type: 'error', error: 'not_host' })
          if (!changed) return // rejected command: no effect on the room
          break
        }
        // kick names the public id; resolve the secret pid before the record is removed.
        const victim = msg.type === 'kick' ? pidForPublicId(this.room, msg.playerId) : null
        if (applyHostCommand(this.room, msg, this.connectedPids(), now)) {
          changed = true
          persist = 'now'
        }
        if (victim) changed = this.kickSockets(victim) || changed
        break
      }
    }

    this.room.lastActivity = now
    await this.commit(changed, persist)
    if (msg.type === 'hello' && att.pid && this.room.players[att.pid]?.scoring) {
      this.send(ws, scoringMessage(this.room, att.pid))
    } else if (msg.type === 'start' && changed) {
      // Sessions are initialized at start (countdown), before anyone can become ready.
      for (const socket of this.openSockets(undefined, 'player')) {
        const player = this.attachment(socket)?.pid
        if (player && this.room.players[player]?.scoring) this.send(socket, scoringMessage(this.room, player))
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.serialize(() => this.onSocketGone(ws))
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.serialize(() => this.onSocketGone(ws))
  }

  private async onSocketGone(ws: WebSocket): Promise<void> {
    this.close(ws, 1000, 'bye') // complete the close handshake if the runtime has not
    const now = Date.now()
    const advanced = advanceClock(this.room, now)
    this.room.lastActivity = now
    await this.commit(true, advanced ? 'now' : 'none', ws)
  }

  // ---- alarm: countdown -> running -> finished, then idle cleanup -----------

  alarm(): Promise<void> {
    return this.serialize(() => this.handleAlarm())
  }

  private async handleAlarm(): Promise<void> {
    this.alarmAt = null // the runtime clears an alarm once it fires
    const now = Date.now()
    // Advance first: an abandoned running room still finishes, then falls through to the idle alarm.
    const advanced = advanceClock(this.room, now)
    if (advanced) await this.saver.saveNow()
    // Half-open player sockets: close them so they show as disconnected in every phase.
    const swept = this.closeStaleSockets(now)
    if (advanced || swept) this.broadcast()
    if (isIdleExpired(this.room, this.openSockets().length, now)) {
      this.saver.cancel() // nothing may re-save the room after this
      await this.ctx.storage.deleteAll()
      await this.ctx.storage.deleteAlarm() // deleteAll() does not remove alarms
      // A fresh room is not persisted and needs no alarm: the next connection starts it again.
      this.room = createRoom(this.room.code, now)
      return
    }
    await this.scheduleAlarm()
  }

  // ---- persistence ------------------------------------------------------------

  /**
   * Persist the room as `persist` says (lastActivity alone is not worth a write: the idle alarm is
   * computed from memory), re-arm the alarm, and broadcast when the room (or its sockets) changed.
   */
  private async commit(changed: boolean, persist: Persist, closing?: WebSocket): Promise<void> {
    if (persist === 'now') await this.saver.saveNow()
    await this.scheduleAlarm(closing)
    if (changed) this.broadcast(closing)
  }

  private async scheduleAlarm(closing?: WebSocket): Promise<void> {
    const sockets = {
      open: this.openSockets(closing).length,
      players: this.openSockets(closing, 'player').length,
    }
    const at = nextAlarmAt(this.room, sockets, Date.now(), this.alarmAt)
    if (at === this.alarmAt) return
    // An `at` already in the past fires right away; alarm() then advances the clock, so it cannot loop.
    if (at === null) await this.ctx.storage.deleteAlarm()
    else await this.ctx.storage.setAlarm(at)
    this.alarmAt = at
  }

  // ---- sockets ----------------------------------------------------------------

  private attachment(ws: WebSocket): Attachment | null {
    const att = ws.deserializeAttachment() as Attachment | null
    return att && isRole(att.role) ? att : null
  }

  private openSockets(exclude?: WebSocket, tag?: Role): WebSocket[] {
    return this.ctx.getWebSockets(tag).filter((ws) => ws !== exclude && ws.readyState === WebSocket.OPEN)
  }

  private isFresh(ws: WebSocket, att: Attachment | null, now: number): boolean {
    const auto = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? null
    return isSocketFresh(auto, att?.seen ?? 0, now)
  }

  /** Secret pids bound to open player sockets that were heard from recently. */
  private connectedPids(exclude?: WebSocket): Set<string> {
    const now = Date.now()
    const set = new Set<string>()
    for (const ws of this.openSockets(exclude, 'player')) {
      const att = this.attachment(ws)
      if (att?.pid && this.isFresh(ws, att, now)) set.add(att.pid)
    }
    return set
  }

  /** Closes player sockets that went quiet (CLOSE_STALE: the client reconnects). Returns true if any. */
  private closeStaleSockets(now: number): boolean {
    let any = false
    for (const ws of this.openSockets(undefined, 'player')) {
      if (this.isFresh(ws, this.attachment(ws), now)) continue
      this.close(ws, CLOSE_STALE, 'stale')
      any = true
    }
    return any
  }

  private unbind(ws: WebSocket, att: Attachment): void {
    if (!att.pid) return
    delete att.pid
    ws.serializeAttachment(att)
  }

  /** Tell every socket bound to the secret `pid` it was kicked, then close it with CLOSE_KICKED. */
  private kickSockets(pid: string): boolean {
    let any = false
    for (const ws of this.ctx.getWebSockets('player')) {
      const att = this.attachment(ws)
      if (att?.pid !== pid) continue
      this.send(ws, { type: 'kicked' })
      this.unbind(ws, att)
      this.close(ws, CLOSE_KICKED, 'kicked')
      any = true
    }
    return any
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      /* socket went away */
    }
  }

  private close(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason)
    } catch {
      /* already closed */
    }
  }

  // ---- broadcast (at most one per BROADCAST_INTERVAL_MS, latest state trails) --

  private snapshot(now: number, exclude?: WebSocket) {
    return snapshot(
      this.room,
      this.connectedPids(exclude),
      {
        screens: this.openSockets(exclude, 'screen').length,
        hosts: this.openSockets(exclude, 'host').length,
      },
      now,
    )
  }

  private broadcast(closing?: WebSocket): void {
    if (this.trailing) return // the pending send will carry the latest state
    const wait = this.lastBroadcast + BROADCAST_INTERVAL_MS - Date.now()
    if (wait <= 0) {
      this.sendNow(closing)
    } else {
      this.trailing = setTimeout(() => {
        this.trailing = null
        this.sendNow()
      }, wait)
    }
  }

  private sendNow(closing?: WebSocket): void {
    const now = Date.now()
    this.lastBroadcast = now
    const data = JSON.stringify({ type: 'state', state: this.snapshot(now, closing) } satisfies ServerMessage)
    for (const ws of this.openSockets(closing)) {
      try {
        ws.send(data)
      } catch {
        /* socket went away */
      }
    }
  }
}
