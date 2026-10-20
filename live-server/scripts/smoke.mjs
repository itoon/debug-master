// End-to-end smoke test against a running `wrangler dev` (default ws://127.0.0.1:8787).
// Usage: pnpm --dir live-server smoke   (LIVE_URL=http(s)://host:port or ws(s)://… to point elsewhere)
// Uses the WebSocket built into Node 22. Exits 1 on the first failed assertion.

const BASE = (process.env.LIVE_URL ?? 'ws://127.0.0.1:8787').replace(/^http/, 'ws').replace(/\/$/, '')
const ROOM = `SMOKE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
const CLOSE_KICKED = 4001

const sockets = []

function fail(message) {
  console.error(`smoke FAILED: ${message}`)
  for (const c of sockets) c.ws.close()
  process.exit(1)
}

function check(cond, message) {
  if (!cond) fail(message)
  console.log(`  ok  ${message}`)
}

function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Buffer.from(bytes).toString('base64url') // 32 chars of [A-Za-z0-9_-]
}

function connect(role, key) {
  const qs = `role=${role}${key ? `&key=${encodeURIComponent(key)}` : ''}`
  const ws = new WebSocket(`${BASE}/rooms/${ROOM}/ws?${qs}`)
  const client = { ws, messages: [], waiters: [], closed: null }
  sockets.push(client)

  const settle = () => {
    for (const w of [...client.waiters]) {
      const hit = w.find()
      if (hit !== undefined) {
        client.waiters.splice(client.waiters.indexOf(w), 1)
        clearTimeout(w.timer)
        w.resolve(hit)
      }
    }
  }
  ws.addEventListener('message', (ev) => {
    client.messages.push(JSON.parse(String(ev.data)))
    settle()
  })
  ws.addEventListener('close', (ev) => {
    client.closed = { code: ev.code, reason: ev.reason }
    settle()
  })

  /** Resolves with the first message (from `since` on) matching `pred`, or fails after `ms`. */
  client.waitFor = (label, pred, ms = 3000, since = 0) =>
    new Promise((resolve) => {
      const find = () => client.messages.slice(since).find(pred)
      const hit = find()
      if (hit !== undefined) return resolve(hit)
      const w = { find, resolve }
      w.timer = setTimeout(() => fail(`${role}: timed out after ${ms} ms waiting for ${label}`), ms)
      client.waiters.push(w)
    })
  /** Waits for a `state` message received after this call that matches `pred`. */
  client.waitState = (label, pred, ms = 3000) => {
    const since = client.messages.length
    return client.waitFor(label, (m) => m.type === 'state' && pred(m.state), ms, since).then((m) => m.state)
  }
  client.waitClose = (ms = 3000) =>
    new Promise((resolve) => {
      if (client.closed) return resolve(client.closed)
      const w = { find: () => client.closed ?? undefined, resolve }
      w.timer = setTimeout(() => fail(`${role}: socket did not close within ${ms} ms`), ms)
      client.waiters.push(w)
    })
  client.send = (msg) => ws.send(JSON.stringify(msg))
  client.open = () =>
    new Promise((resolve) => {
      if (ws.readyState === WebSocket.OPEN) return resolve()
      ws.addEventListener('open', () => resolve(), { once: true })
      ws.addEventListener('error', () => fail(`${role}: could not connect to ${BASE} (is wrangler dev running?)`), {
        once: true,
      })
    })
  return client
}

function player(pid, name) {
  return { type: 'hello', pid, name, avatarId: 'none', age: 12 }
}

async function main() {
  console.log(`smoke: room ${ROOM} on ${BASE}`)
  // Whatever hangs (a socket that never opens, a missed waiter), never run longer than this.
  setTimeout(() => fail('overall timeout'), 30_000).unref()

  // 1. host key A claims the room; host key B cannot control it.
  const hostA = connect('host', randomKey())
  await hostA.open()
  hostA.send({ type: 'hello' })
  const a = await hostA.waitFor('host reply', (m) => m.type === 'host')
  check(a.host === true, 'host with key A gets host:true')

  const hostB = connect('host', randomKey())
  await hostB.open()
  hostB.send({ type: 'hello' })
  const b = await hostB.waitFor('host reply', (m) => m.type === 'host')
  check(b.host === false, 'host with key B gets host:false')
  hostB.send({ type: 'start' })
  const err = await hostB.waitFor('not_host error', (m) => m.type === 'error')
  check(err.error === 'not_host', 'host B start -> not_host')

  // 2. screen sees the lobby.
  const screen = connect('screen')
  await screen.open()
  screen.send({ type: 'hello' })
  const s0 = await screen.waitFor('first state', (m) => m.type === 'state')
  check(s0.state.phase === 'lobby', 'screen gets state with phase lobby')

  // 3. two players join the lobby.
  const p1 = connect('player')
  const p2 = connect('player')
  await Promise.all([p1.open(), p2.open()])
  p1.send(player('smoke-p1', 'P1'))
  p2.send(player('smoke-p2', 'P2'))
  const y1 = await p1.waitFor('you', (m) => m.type === 'you')
  const y2 = await p2.waitFor('you', (m) => m.type === 'you')
  check(y1.status === 'playing' && typeof y1.id === 'string' && y1.id !== 'smoke-p1', 'P1 gets you status:playing with a public id')
  check(y2.status === 'playing' && typeof y2.id === 'string' && y2.id !== y1.id, 'P2 gets you status:playing with its own public id')
  const lobby = (await screen.waitFor('both players', (m) => m.type === 'state' && m.state.players.length === 2)).state
  const json = JSON.stringify(lobby)
  check(!json.includes('smoke-p1') && !json.includes('smoke-p2'), 'state never carries the secret pids')
  check(lobby.players.some((p) => p.id === y1.id) && lobby.players.some((p) => p.id === y2.id), 'state lists players by public id')

  // 4. setDuration + start -> countdown, then running when the alarm fires.
  hostA.send({ type: 'setDuration', durationSec: 60 })
  await screen.waitState('durationSec 60', (s) => s.durationSec === 60)
  const countdown = screen.waitState('countdown', (s) => s.phase === 'countdown', 1000)
  hostA.send({ type: 'start' })
  const sc = await countdown
  check(sc.phase === 'countdown' && sc.endAt - sc.startAt === 60_000, 'start -> countdown within 1 s')
  const sr = await screen.waitState('running', (s) => s.phase === 'running', 4000)
  check(sr.phase === 'running', 'countdown -> running within 4 s')

  // 5. Actual canonical level 1: ready + three right inputs. No client totals.
  const private1 = await p1.waitFor('private session', m => m.type === 'scoring' && m.session)
  const private2 = await p2.waitFor('private session', m => m.type === 'scoring' && m.session)
  const event = (snapshot, sequence, action, at, direction) => ({ type: 'gameplay', protocolVersion: 1,
    roundId: sc.roundId, sessionId: snapshot.session.id, sequence, levelId: 1, action, at, ...(direction ? { direction } : {}) })
  const readyAt = Date.now()
  const play = async (client, snapshot, mistakes = 0) => {
    let sequence = 0
    const send = async (action, at, direction) => {
      const msg = event(snapshot, ++sequence, action, at, direction)
      const since = client.messages.length
      client.send(msg)
      const ack = await client.waitFor('canonical ack', m => m.type === 'scoring' && m.acknowledgedSequence === sequence, 3000, since)
      check(!ack.error, `canonical ${action} ${sequence} accepted`)
      return { msg, ack }
    }
    await send('ready', readyAt)
    for (let i = 0; i < mistakes; i++) await send('direction', readyAt, 'up')
    await send('direction', readyAt, 'right')
    await send('direction', readyAt, 'right')
    return send('direction', readyAt, 'right')
  }
  const complete1 = await play(p1, private1)
  const complete2 = await play(p2, private2, 1)
  const score1 = complete1.ack.session.totalScore
  check(score1 === 2000 && complete1.ack.receipt.stars === 3, 'Worker calculates zero-second perfect score 2000')
  check(complete2.ack.session.totalScore === 1500 && complete2.ack.receipt.stars === 2, 'one mistake yields two stars and 1500')
  const sp = (await screen.waitFor('ordered standings', m => m.type === 'state' && m.state.players.find(p => p.id === y2.id)?.score === 1500)).state
  check(sp.players[0].id === y1.id && sp.players[0].score === score1, 'public standings agree with canonical private scores')
  const duplicateSince = p1.messages.length
  p1.send(complete1.msg)
  const duplicate = await p1.waitFor('duplicate ack', m => m.type === 'scoring', 3000, duplicateSince)
  check(duplicate.session.totalScore === score1 && duplicate.receipt.delta === 0, 'duplicate final input awards no second delta')
  p1.ws.close()
  const resumed = connect('player'); await resumed.open(); resumed.send(player('smoke-p1', 'P1'))
  const restored = await resumed.waitFor('private resume', m => m.type === 'scoring' && m.session)
  check(restored.acknowledgedSequence === 4 && restored.nextExpectedSequence === 5 && restored.session.totalScore === score1, 'reconnect restores exact accepted sequence and score')
  const replaySince = resumed.messages.length
  resumed.send(complete1.msg)
  const replayed = await resumed.waitFor('lost ack replay', m => m.type === 'scoring', 3000, replaySince)
  check(replayed.receipt.delta === 0, 'lost-ack replay after reconnect is idempotent')
  check(!screen.messages.some(m => m.type === 'scoring') && !hostA.messages.some(m => m.type === 'scoring'), 'private canonical state never reaches screen or host')

  // 6. a late joiner is queued.
  const p3 = connect('player')
  await p3.open()
  p3.send(player('smoke-p3', 'P3'))
  const y3 = await p3.waitFor('you', (m) => m.type === 'you')
  check(y3.status === 'queued', 'P3 gets you status:queued')

  // 6b. replaying P1's public id as a pid creates a new (queued) player and leaves P1 untouched.
  const thief = connect('player')
  await thief.open()
  thief.send(player(y1.id, 'Thief'))
  const yt = await thief.waitFor('you', (m) => m.type === 'you')
  check(yt.status === 'queued' && yt.id !== y1.id, 'a hello with P1 public id gets a new queued seat')
  thief.send({ type: 'leave' })
  const afterThief = await screen.waitState('thief gone', (s) => !s.players.some((p) => p.id === yt.id))
  const p1row = afterThief.players.find((p) => p.id === y1.id)
  check(p1row?.score === score1 && p1row.name === 'P1' && p1row.connected, 'P1 seat, name and score unchanged')

  // 7. endEarly -> finished, newRound -> lobby round 2 with P3 seated in lane 2.
  hostA.send({ type: 'endEarly' })
  const sf = await screen.waitState('finished', (s) => s.phase === 'finished')
  check(sf.phase === 'finished', 'endEarly -> finished')
  // End Early's shortened deadline is authoritative even though session.deadline stays frozen.
  const lateSince = resumed.messages.length
  resumed.send({ ...complete1.msg, sequence: 5, action: 'ready', levelId: 2, at: sf.endAt + 1, direction: undefined })
  const late = await resumed.waitFor('deadline rejection', m => m.type === 'scoring', 3000, lateSince)
  check(late.error === 'round_closed' && late.acknowledgedSequence === 4, `post-deadline event rejected during grace (${late.error}, ack ${late.acknowledgedSequence})`)
  await new Promise(resolve => setTimeout(resolve, 2100))
  const closedSince = resumed.messages.length
  resumed.send({ ...complete1.msg, sequence: 5, action: 'ready', levelId: 2, at: sf.endAt, direction: undefined })
  const closedAck = await resumed.waitFor('grace rejection', m => m.type === 'scoring', 3000, closedSince)
  check(closedAck.error === 'round_closed', 'new pre-deadline event arriving beyond grace is rejected')
  hostA.send({ type: 'newRound' })
  const sl = await screen.waitState('lobby round 2', (s) => s.phase === 'lobby')
  const p3row = sl.players.find((p) => p.id === y3.id)
  check(sl.roundId === 2, 'newRound -> lobby with roundId 2')
  check(p3row?.status === 'playing' && p3row.lane === 2, 'P3 is playing in lane 2')

  check(sl.players.every(p => p.score === 0 && p.levelsCompleted === 0), 'new-round standings never reuse prior-round best')
  const oldSince = resumed.messages.length
  resumed.send(complete1.msg)
  const old = await resumed.waitFor('old round rejection', m => m.type === 'scoring', 3000, oldSince)
  check((old.error === 'wrong_round' || old.error === 'not_playing'), 'old events cannot score in a new round')

  // 8. kick P2.
  hostA.send({ type: 'kick', playerId: y2.id })
  await p2.waitFor('kicked', (m) => m.type === 'kicked')
  check(true, 'P2 gets kicked')
  const closed = await p2.waitClose()
  check(closed.code === CLOSE_KICKED, `P2 socket closed with ${CLOSE_KICKED}`)

  for (const c of sockets) c.ws.close()
  console.log('smoke ok')
  process.exit(0)
}

main().catch((e) => fail(e?.stack ?? String(e)))
