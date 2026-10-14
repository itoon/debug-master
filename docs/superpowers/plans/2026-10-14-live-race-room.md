# Live Race Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มโหมดแข่งสดแบบห้องให้ Debug Master: ผู้เล่นเข้าห้องด้วยรหัสหรือ QR สตาฟฟ์เลือกโหมดและเวลาแล้วกดเริ่ม และจอใหญ่โชว์ลู่วิ่งตามคะแนนแบบ realtime

**Architecture:**
- **Backend:** Cloudflare Worker ใหม่ใน `live-server/` มี Durable Object `LiveRoom` 1 ตัวต่อห้อง และตรรกะห้องอยู่ในฟังก์ชันล้วน (`room-logic.ts`) ที่ทดสอบได้
- **ตัวเกม Nuxt:** ยังเป็น static site บน GitHub Pages เพิ่ม client WebSocket, หน้า `/live/screen`, `/live/host` และโหมด Live ในหน้าเกมเดิม
- **โค้ดที่ใช้ร่วมกัน:** type และค่าคงที่ของ protocol อยู่ที่ `app/utils/live/protocol.ts` ซึ่ง `live-server` import ผ่าน relative path

**Tech Stack:** Nuxt 4 / Vue 3 / TypeScript (pnpm 9, Node 22) · Cloudflare Workers + Durable Objects (wrangler ^4.143.1, SQLite-backed DO) · vitest ^5.0.2 · `uqr` ^0.1.2 (QR SVG)

**Spec:** `docs/superpowers/specs/2026-10-14-live-race-room-design.md` (ทุก task ต้องอ่านคู่กับ spec)

## Global Constraints

- ทุก path ในแผนนับจาก repo `game/` (branch `feat/live-race`)
- `MAX_PLAYERS = 12` คือ (ผู้เล่นที่ยังเชื่อมต่อ + คิว), `COUNTDOWN_MS = 3000`, `GRACE_MS = 2000`, `IDLE_MS = 6 * 60 * 60 * 1000`
- เวลา: ชุดตัวเลือก `[480, 600, 900]` วินาที, กำหนดเองได้ 1–15 นาที (`60..900` วินาที), ค่าเริ่มต้น `480`
- รหัสห้อง `^[A-Z0-9-]{3,16}$` · host key `^[A-Za-z0-9_-]{16,64}$` · pid `^[A-Za-z0-9_-]{6,64}$` · ข้อความยาวไม่เกิน 2048 bytes · ชื่อไม่เกิน 24 UTF-16 units และห้ามตัดกลาง emoji · อายุ 5–18
- broadcast ไม่เกิน 10 ครั้งต่อวินาที (ห่างกันอย่างน้อย 100 ms) · client ส่ง progress ไม่เกิน 4 ครั้งต่อวินาที (250 ms) และส่งค่าล่าสุดเสมอ
- ต่อใหม่ด้วยระยะรอ 0.5 → 1 → 2 → 4 → 8 วินาที (สุ่มคลาด ±20%) หยุดต่อเมื่อปิดด้วย close code `4001` (ถูกเตะ) หรือ `4002` (ห้องเต็ม)
- ข้อความ UI ใหม่ทุกข้อความต้องผ่าน `useGameI18n` / `app/i18n/messages.ts` โดยใช้คีย์ขึ้นต้น `live.`
- ใช้ธีมของเกม (spec ข้อ 5): `--cv-*` ใน `tailwind.css`, `bg.png`, avatar จาก `usePlayerAvatar()`, คะแนนสี `#ffdb58`, กล่อง glass แบบ `.metric`, ทุก animation ต้องมีทางเลือก `prefers-reduced-motion`
- component ห้ามแต่ง style `html`/`body` (ตาม DESIGN.md) และหน้าที่ยาวเกินจอต้องมี container ที่ scroll เอง เพราะ `body` ตั้ง `overflow: hidden`
- ห้ามเปลี่ยนกติกา คะแนน หรือเวลาของโหมดเดิม เมื่อไม่ได้ตั้ง `NUXT_PUBLIC_LIVE_URL` เกมต้องทำงานเหมือนเดิมทุกอย่าง
- ผล Live ห้ามเขียนลง `ScoreRepository` / localStorage ranking
- ตรวจ `game/` ด้วย `pnpm build` + `pnpm test` (vitest ใช้กับ `tests/live/**` เท่านั้น) และตรวจ `live-server/` ด้วย `pnpm --dir live-server test` + `pnpm --dir live-server typecheck`
- `public/tiles/` และ `docs/HANDOFF.md` เป็นงานที่ผู้ใช้ยังไม่ commit ห้ามใส่ใน commit ของแผนนี้ ถ้า `public/tiles/*.png` ยังไม่อยู่ใน git ตอนทำ Task 9 ให้ถามผู้ใช้ก่อน

## Review Focus

1. **นาฬิกาเครื่องบูธเพี้ยนไปหลายนาที:** countdown/เวลาที่เหลือต้องอิงเวลาเซิร์ฟเวอร์ ไม่ใช่ `Date.now()` ตรงๆ → test ใน Task 2 (`remainingSec` เมื่อ offset = +300000)
2. **รีโหลดเครื่องบูธกลางรอบ (pid เดิม):** ต้องกลับมาเป็น `playing` ที่เลนเดิมพร้อมคะแนนเดิม ไม่กลายเป็นคิว → test ใน Task 4
3. **ชื่อซ้ำกันหรือมี emoji:** ผู้เล่นสองคนชื่อเหมือนกันต้องเป็นสองเลน และชื่อที่ยาวพร้อม emoji ต้องไม่ถูกตัดกลางตัว → test ใน Task 3 และ Task 4
4. **progress ค้างจากรอบก่อน (`roundId` เก่า) มาถึงหลังเปิดรอบใหม่:** ต้องไม่ถูกนับ → test ใน Task 5
5. **หน้าคุมอีกเครื่องที่ไม่มี key หรือ key ผิด:** ต้องคุมห้องไม่ได้ และได้ `host:false` → test ใน Task 4 (`isHostKeyHash`) และ smoke ใน Task 6

## ข้อตัดสินใจเพิ่มจาก spec (บันทึกไว้ใน spec แล้ว)

- **เพดานคะแนน:** คะแนนเพิ่มได้เฉพาะตอนผ่านด่าน จึงใช้เพดาน `Δscore ≤ ΔlevelsCompleted × maxLevelPoints(bestCombo)` แทน `× (Δ+1)`
- **ข้อความใหม่:** เซิร์ฟเวอร์ส่ง `{type:'host', host:boolean}` ตอบ host `hello` เพื่อให้หน้าคุมรู้ว่าคุมห้องได้หรือไม่
- **โพเดียม:** ไม่แยกออกจาก `ChallengeRanking` เพราะ CSS แบบ scoped ผูกกับ variant `split`/`space` ถ้าแยกเสี่ยงทำหน้า Home/Session พัง `LiveResults` จึงใช้ค่าสีเหรียญชุดเดียวกัน (`#ffdc53`/`#c1d8ff`/`#efb387` และ gradient หน้าแท่น) ใน CSS ของตัวเอง
- **`BASELINE`:** ใช้ค่าเดียว `TRACK_BASELINE = 5000` ทุกโหมด แล้วค่อยปรับตอนซ้อม

---

## File Structure

```
game/
├─ app/utils/live/
│  ├─ protocol.ts        type ข้อความ/สถานะ + ค่าคงที่ + maxLevelPoints + normalizeRoomCode   (ใช้ทั้งสองฝั่ง)
│  ├─ clock.ts           ปรับนาฬิกาตามเซิร์ฟเวอร์, เวลาที่เหลือ
│  ├─ track.ts           ความยาวลู่, ตำแหน่ง, ขีดบอกคะแนน
│  ├─ playerStage.ts     สถานะหน้าจอของผู้เล่นมาจาก state ห้อง (ฟังก์ชันล้วน)
│  ├─ identity.ts        pid กับ host key ใน localStorage
│  └─ socket.ts          WebSocket ที่ต่อใหม่เองได้ + liveWsUrl (ไม่พึ่ง Vue)
├─ app/composables/useLiveRoom.ts   ห่อ socket ด้วย Vue refs + useLiveConfig
├─ app/components/live/  RaceLanes · LiveBoard · LobbyStage · QueueStrip · LiveResults · LivePlayerPanel
├─ app/pages/live/       screen.vue · host.vue
├─ app/pages/index.vue   (แก้) โหมด Live
├─ app/components/GameHud.vue  (แก้) ช่องอันดับสด
├─ app/i18n/messages.ts  (แก้) คีย์ live.*
├─ nuxt.config.ts        (แก้) runtimeConfig.public.liveUrl
├─ vitest.config.ts · tests/live/*.test.ts     (ใหม่)
├─ .github/workflows/deploy.yml (แก้) NUXT_PUBLIC_LIVE_URL
└─ live-server/
   ├─ package.json · tsconfig.json · wrangler.jsonc · vitest.config.ts · README.md
   ├─ src/validate.ts     แปลงและตรวจข้อความดิบ → ClientMessage
   ├─ src/room-logic.ts   ตรรกะห้อง (ฟังก์ชันล้วน)
   ├─ src/live-room.ts    Durable Object
   ├─ src/index.ts        Worker entry + ตรวจ Origin
   ├─ test/*.test.ts
   └─ scripts/smoke.mjs   ทดสอบรอบจริงกับ wrangler dev
```

---

### Task 1: Protocol ที่ใช้ร่วมกัน + ตั้งค่า vitest ใน game

**Files:**
- Create: `app/utils/live/protocol.ts`, `vitest.config.ts`, `tests/live/protocol.test.ts`
- Modify: `package.json` (devDependency `vitest@^5.0.2`, script `"test": "vitest run"`), `.gitignore` (เพิ่ม `.superpowers/`)

**Interfaces:**
- Produces (`app/utils/live/protocol.ts`, ห้าม import อะไรจาก Nuxt/Vue):
  - `type Phase = 'lobby'|'countdown'|'running'|'finished'` · `type ModeId = 'A'|'B'|'C'` · `type Role = 'player'|'host'|'screen'` · `type PlayerStatus = 'playing'|'queued'`
  - `interface LivePlayer` และ `interface RoomState` ตามฟิลด์ใน spec ข้อ 4 เป๊ะ (รวม `status`, `lane`, `queuedAt`, `hosts`, `screens`)
  - `type PlayerHello = {type:'hello'; pid:string; name:string; avatarId:string; age:number}`
  - `type ProgressMsg = {type:'progress'; roundId:number; score:number; levelsCompleted:number; bestCombo:number; combo:number}`
  - `type HostCommand = {type:'setMode'; mode:ModeId} | {type:'setDuration'; durationSec:number} | {type:'start'} | {type:'endEarly'} | {type:'newRound'} | {type:'kick'; playerId:string}`
  - `type ClientMessage = PlayerHello | ProgressMsg | {type:'leave'} | {type:'hello'} | HostCommand` (`{type:'hello'}` ไม่มี pid ใช้กับ host/screen)
  - `type ServerMessage = {type:'state'; state:RoomState} | {type:'you'; pid:string; status:PlayerStatus} | {type:'host'; host:boolean} | {type:'full'} | {type:'kicked'} | {type:'error'; error:'not_host'|'bad_message'}`
  - ค่าคงที่ทั้งหมดใน Global Constraints (ชื่อ: `MAX_PLAYERS`, `COUNTDOWN_MS`, `GRACE_MS`, `IDLE_MS`, `DURATION_PRESETS_SEC`, `DEFAULT_DURATION_SEC`, `MIN_DURATION_SEC`, `MAX_DURATION_SEC`, `MAX_MSG_BYTES`, `BROADCAST_INTERVAL_MS`, `PROGRESS_INTERVAL_MS`, `NAME_MAX`, `ROOM_CODE_RE`, `HOST_KEY_RE`, `PID_RE`, `CLOSE_KICKED`, `CLOSE_FULL`) และ `MAX_LEVEL_ID = 50`, `MAX_LEVEL_MOVES`
  - `function maxLevelPoints(bestCombo: number): number` = `Math.ceil((180 + MAX_LEVEL_ID * 14 + MAX_LEVEL_MOVES * 36) * 4.5 * (1 + Math.max(0, bestCombo - 1) * 0.16))` (สูตรเดียวกับ `calculateLevelScore` ใน `index.vue` ในกรณีที่แย่ที่สุด)
  - `function normalizeRoomCode(raw: unknown): string | null` (trim + uppercase ถ้าไม่ผ่าน `ROOM_CODE_RE` คืน `null`)

- [ ] **Step 1: ติดตั้ง vitest และสร้าง `vitest.config.ts`** (`test.include: ['tests/**/*.test.ts']`, `environment: 'node'`) แล้วเพิ่ม `"test": "vitest run"` ใน `package.json` และ `.superpowers/` ใน `.gitignore`

Run: `pnpm add -D vitest@^5.0.2`
Expected: `package.json` กับ `pnpm-lock.yaml` อัปเดต (ไม่ต้องแตะ `bun.lock`)

- [ ] **Step 2: เขียน test ที่ fail** `tests/live/protocol.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { challengeSets } from '../../app/data/challenge-groups'
import { homeConfig } from '../../app/data/home-config'
import { solveLevel } from '../../app/utils/programRunner'
import { useProgramParser } from '../../app/composables/useProgramParser'
import { MAX_LEVEL_ID, MAX_LEVEL_MOVES, maxLevelPoints, normalizeRoomCode, DURATION_PRESETS_SEC, MAX_DURATION_SEC } from '../../app/utils/live/protocol'

describe('protocol constants match the game data', () => {
  it('every live mode set fits MAX_LEVEL_ID and MAX_LEVEL_MOVES', () => {
    for (const mode of homeConfig.modes) {
      const set = challengeSets.find((s) => s.id === mode.levelSetId)!
      expect(mode.levelRange[1]).toBeLessThanOrEqual(MAX_LEVEL_ID)
      for (const level of set.levels) {
        const { parseProgram } = useProgramParser(() => level.id)
        expect(level.id).toBeLessThanOrEqual(MAX_LEVEL_ID)
        expect(solveLevel(level, parseProgram(level.code)).moves.length).toBeLessThanOrEqual(MAX_LEVEL_MOVES)
      }
    }
  })
  it('maxLevelPoints mirrors calculateLevelScore at its worst case', () => {
    expect(maxLevelPoints(1)).toBe(Math.ceil((180 + 50 * 14 + MAX_LEVEL_MOVES * 36) * 4.5))
    expect(maxLevelPoints(11)).toBe(Math.ceil((180 + 50 * 14 + MAX_LEVEL_MOVES * 36) * 4.5 * 2.6))
  })
  it('durations stay inside the game 15-minute cap', () => {
    expect(DURATION_PRESETS_SEC).toEqual([480, 600, 900])
    expect(MAX_DURATION_SEC).toBe(900)
  })
  it('normalizes room codes', () => {
    expect(normalizeRoomCode(' codi-1 ')).toBe('CODI-1')
    expect(normalizeRoomCode('ab')).toBeNull()
    expect(normalizeRoomCode('BAD CODE')).toBeNull()
    expect(normalizeRoomCode(42)).toBeNull()
  })
})
```

- [ ] **Step 3: รัน test เพื่อดูว่า fail**

Run: `pnpm test`
Expected: FAIL เพราะ `protocol` หา module ไม่เจอ

- [ ] **Step 4: เขียน `app/utils/live/protocol.ts`** ให้ตรงกับ Interfaces ตั้ง `MAX_LEVEL_MOVES` เป็นค่าสูงสุดที่วัดได้จริงจาก test แล้วปัดขึ้นเป็นเลขที่หาร 5 ลงตัว (วิธีวัด: ใส่ `console.log` ชั่วคราวใน test แล้วลบออกก่อน commit)

- [ ] **Step 5: รัน test ให้ผ่าน และ build**

Run: `pnpm test && pnpm build`
Expected: PASS ทั้ง 4 test และ build exit 0

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts .gitignore app/utils/live/protocol.ts tests/live/protocol.test.ts
git commit -m "feat(live): add shared live protocol and vitest setup"
```

---

### Task 2: นาฬิกาเซิร์ฟเวอร์และการคำนวณลู่วิ่ง

**Files:**
- Create: `app/utils/live/clock.ts`, `app/utils/live/track.ts`, `tests/live/clock.test.ts`, `tests/live/track.test.ts`

**Interfaces:**
- Produces `clock.ts`:
  - `clockOffset(serverNow: number, receivedAt: number): number` (= `serverNow - receivedAt`)
  - `serverTime(offset: number, now?: number): number`
  - `remainingSec(endAt: number | null, offset: number, now?: number): number` (ปัดขึ้น ไม่ติดลบ คืน `0` เมื่อ `endAt` เป็น null)
  - `countdownSec(startAt: number | null, offset: number, now?: number): number` (ปัดขึ้น ไม่ติดลบ)
- Produces `track.ts`:
  - `TRACK_BASELINE = 5000` · `LEADER_SPAN = 0.85`
  - `niceCeil(v: number): number` (ขั้น 1,000 ถ้า v ≤ 10,000 · ขั้น 2,000 ถ้า ≤ 40,000 · นอกนั้นขั้น 5,000)
  - `trackMax(leaderScore: number): number` = `niceCeil(Math.max(TRACK_BASELINE, leaderScore / LEADER_SPAN))`
  - `laneFraction(score: number, max: number): number` (บีบให้อยู่ใน 0..1)
  - `trackTicks(max: number): number[]` (ค่า 5 ค่าเว้นเท่ากัน `[0, max/4, max/2, 3max/4, max]`)

- [ ] **Step 1: เขียน test ที่ fail**

```ts
// tests/live/clock.test.ts
it('uses server time, not the device clock', () => {
  // device is 5 minutes behind the server
  const offset = clockOffset(1_000_300_000, 1_000_000_000)
  expect(offset).toBe(300_000)
  expect(remainingSec(1_000_300_000 + 480_000, offset, 1_000_000_000)).toBe(480)
})
it('rounds up and never goes negative', () => {
  expect(remainingSec(10_500, 0, 10_000)).toBe(1)
  expect(remainingSec(9_000, 0, 10_000)).toBe(0)
  expect(remainingSec(null, 0, 10_000)).toBe(0)
  expect(countdownSec(12_001, 0, 10_000)).toBe(3)
})
// tests/live/track.test.ts
it('keeps a baseline track early in the round', () => expect(trackMax(0)).toBe(5000))
it('extends so the leader stays near 85%', () => {
  expect(trackMax(6820)).toBe(9000)        // 6820/0.85 = 8023.5 → 9000
  expect(trackMax(20000)).toBe(24000)      // 23529 → 24000
  expect(trackMax(60000)).toBe(75000)      // 70588 → 75000
})
it('clamps lane fraction', () => {
  expect(laneFraction(4500, 9000)).toBe(0.5)
  expect(laneFraction(-1, 9000)).toBe(0)
  expect(laneFraction(99999, 9000)).toBe(1)
})
it('makes five ticks', () => expect(trackTicks(8000)).toEqual([0, 2000, 4000, 6000, 8000]))
```

- [ ] **Step 2: รัน test เพื่อดูว่า fail**

Run: `pnpm test`
Expected: FAIL เพราะหา module ไม่เจอ

- [ ] **Step 3: เขียน `clock.ts` และ `track.ts`** ตาม Interfaces

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/utils/live/clock.ts app/utils/live/track.ts tests/live/clock.test.ts tests/live/track.test.ts
git commit -m "feat(live): add server clock and race track math"
```

---

### Task 3: โครง `live-server` + ตรวจข้อความ (`validate.ts`)

**Files:**
- Create: `live-server/package.json`, `live-server/tsconfig.json`, `live-server/vitest.config.ts`, `live-server/src/validate.ts`, `live-server/test/validate.test.ts`

**Interfaces:**
- Consumes: type และค่าคงที่จาก `../../app/utils/live/protocol` (Task 1) · `PLAYER_AVATARS`, `isPlayerAvatarId` จาก `../../app/data/player-avatars`
- Produces (`live-server/src/validate.ts`):
  - `cleanName(v: unknown): string` (ลบอักขระควบคุม `\u0000-\u001f\u007f`, รวมช่องว่างซ้อนให้เหลือช่องเดียว, trim แล้วต่อ grapheme ทีละตัวด้วย `Intl.Segmenter('th', {granularity:'grapheme'})` จนกว่าจะเกิน `NAME_MAX` UTF-16 units)
  - `parseClientMessage(raw: string | ArrayBuffer, role: Role): ClientMessage | null` แปลงตามกติกาต่อไปนี้ ถ้าไม่ผ่านคืน `null`:
    - ต้องเป็น string ยาวไม่เกิน `MAX_MSG_BYTES`, เป็น JSON object และ `type` ต้องรู้จัก
    - player รับได้แค่ `hello`/`progress`/`leave`
      - `hello`: pid ต้องผ่าน `PID_RE`, ชื่อหลังผ่าน `cleanName` ต้องไม่ว่าง, avatar ที่ไม่รู้จักแทนด้วย `PLAYER_AVATARS[0]`, อายุต้องเป็นจำนวนเต็ม 5–18 ไม่งั้นคืน null
      - `progress`: ทุกช่องต้องเป็นจำนวนเต็ม ≥ 0 และ `combo ≤ bestCombo`
    - host รับได้แค่ `hello` และ `HostCommand`
      - `mode` ต้องเป็น A/B/C
      - `durationSec` ต้องเป็นจำนวนเต็มในช่วง `MIN..MAX_DURATION_SEC`
      - `kick.playerId` ต้องผ่าน `PID_RE`
    - screen รับได้แค่ `hello`

`package.json`: `"name": "debug-master-live"`, `"type": "module"`, `"private": true`, scripts `test: vitest run`, `typecheck: tsc --noEmit`, `dev: wrangler dev`, `deploy: wrangler deploy`, `types: wrangler types src/worker-configuration.d.ts` · devDependencies `typescript ~6.0.2`, `vitest ^5.0.2`, `wrangler ^4.143.1` · ใช้ pnpm (lockfile แยกของตัวเอง)
`tsconfig.json`: `"target": "es2023"`, `"module": "es2022"`, `"moduleResolution": "bundler"`, `"strict": true`, `"noEmit": true`, `"types": []` (Task 6 จะเพิ่ม worker types), include `src`, `test`, และ `../app/utils/live/protocol.ts`, `../app/data/player-avatars.ts`

- [ ] **Step 1: สร้าง package แล้วติดตั้ง**

Run: `pnpm --dir live-server install`
Expected: มี `live-server/pnpm-lock.yaml` และ `live-server/node_modules/`

- [ ] **Step 2: เขียน test ที่ fail** `live-server/test/validate.test.ts`

```ts
const hello = { type: 'hello', pid: 'pid-abc123', name: 'มิ้นท์🔥', avatarId: 'art-toy/10-party.svg', age: 9 }
it('accepts a player hello and keeps a known avatar', () =>
  expect(parseClientMessage(JSON.stringify(hello), 'player')).toEqual(hello))
it('replaces an unknown avatar with the default', () =>
  expect((parseClientMessage(JSON.stringify({ ...hello, avatarId: 'x.svg' }), 'player') as PlayerHello).avatarId).toBe('codi_default.svg'))
it('rejects bad pid, empty name, bad age', () => {
  for (const bad of [{ pid: 'x' }, { name: '  \u0007 ' }, { age: 4 }, { age: 9.5 }])
    expect(parseClientMessage(JSON.stringify({ ...hello, ...bad }), 'player')).toBeNull()
})
it('never splits an emoji when trimming to 24 units', () => {
  const name = cleanName('ก'.repeat(23) + '🔥🔥')
  expect(name).toBe('ก'.repeat(23))
  expect(cleanName('a\u0000b   c')).toBe('ab c')
})
it('rejects host commands from players and screens', () => {
  expect(parseClientMessage('{"type":"start"}', 'player')).toBeNull()
  expect(parseClientMessage('{"type":"start"}', 'screen')).toBeNull()
  expect(parseClientMessage('{"type":"start"}', 'host')).toEqual({ type: 'start' })
})
it('validates host payloads', () => {
  expect(parseClientMessage('{"type":"setDuration","durationSec":59}', 'host')).toBeNull()
  expect(parseClientMessage('{"type":"setDuration","durationSec":901}', 'host')).toBeNull()
  expect(parseClientMessage('{"type":"setDuration","durationSec":600}', 'host')).toEqual({ type: 'setDuration', durationSec: 600 })
  expect(parseClientMessage('{"type":"setMode","mode":"D"}', 'host')).toBeNull()
})
it('rejects progress with combo above bestCombo or negative numbers', () => {
  const p = { type: 'progress', roundId: 1, score: 10, levelsCompleted: 1, bestCombo: 3, combo: 3 }
  expect(parseClientMessage(JSON.stringify(p), 'player')).toEqual(p)
  expect(parseClientMessage(JSON.stringify({ ...p, combo: 4 }), 'player')).toBeNull()
  expect(parseClientMessage(JSON.stringify({ ...p, score: -1 }), 'player')).toBeNull()
})
it('rejects oversize, binary and non-JSON input', () => {
  expect(parseClientMessage('x'.repeat(2049), 'player')).toBeNull()
  expect(parseClientMessage(new ArrayBuffer(4), 'player')).toBeNull()
  expect(parseClientMessage('{nope', 'player')).toBeNull()
})
```

- [ ] **Step 3: รัน test เพื่อดูว่า fail**

Run: `pnpm --dir live-server test`
Expected: FAIL เพราะหา module ไม่เจอ

- [ ] **Step 4: เขียน `validate.ts`**

- [ ] **Step 5: รัน test และ typecheck ให้ผ่าน**

Run: `pnpm --dir live-server test && pnpm --dir live-server typecheck`
Expected: PASS และ tsc exit 0

- [ ] **Step 6: Commit**

```bash
git add live-server/package.json live-server/pnpm-lock.yaml live-server/tsconfig.json live-server/vitest.config.ts live-server/src/validate.ts live-server/test/validate.test.ts
git commit -m "feat(live-server): scaffold worker package and message validation"
```

---

### Task 4: ตรรกะห้อง ส่วน lobby, คิว และคำสั่ง host

**Files:**
- Create: `live-server/src/room-logic.ts`, `live-server/test/room-logic.lobby.test.ts`

**Interfaces:**
- Consumes: protocol types/constants (Task 1)
- Produces (`room-logic.ts`, ห้าม import `cloudflare:workers`):
  - `type StoredPlayer = Omit<LivePlayer, 'connected'>`
  - `interface StoredRoom { code: string; phase: Phase; mode: ModeId; durationSec: number; roundId: number; startAt: number | null; endAt: number | null; players: Record<string, StoredPlayer>; hostKeyHash?: string; lastActivity: number }`
  - `createRoom(code: string, now: number): StoredRoom` (เริ่มที่ `lobby`, mode `'A'`, `DEFAULT_DURATION_SEC`, `roundId: 1`)
  - `seatCount(room: StoredRoom, connected: Set<string>): number` (ผู้เล่น `playing` ที่เชื่อมต่ออยู่ + `queued` ทุกคน)
  - `joinPlayer(room: StoredRoom, hello: PlayerHello, connected: Set<string>, now: number): 'playing' | 'queued' | 'full'`
    - pid เดิม: คืนสถานะเดิมทันที (ไม่มีวันได้ `full`) ส่วนชื่อ/avatar/อายุอัปเดตได้เฉพาะตอน `lobby` หรือตอนที่ยังเป็น `queued`
    - pid ใหม่: ถ้า `seatCount ≥ MAX_PLAYERS` คืน `full` ไม่งั้นตอน `lobby` ได้ `playing` พร้อมเลนว่างที่เลขน้อยที่สุด ส่วน phase อื่นได้ `queued` (`lane: null`, `queuedAt: now`)
  - `leavePlayer(room: StoredRoom, pid: string): boolean` (ลบ record ออก)
  - `applyHostCommand(room: StoredRoom, cmd: HostCommand, connected: Set<string>, now: number): boolean` (คืน `true` เมื่อห้องเปลี่ยน)
    - `setMode` / `setDuration`: ใช้ได้เฉพาะ `lobby`
    - `start`: ใช้ได้เฉพาะ `lobby` และต้องมีผู้เล่น `playing` ที่เชื่อมต่ออยู่อย่างน้อย 1 คน → `phase='countdown'`, `startAt = now + COUNTDOWN_MS`, `endAt = startAt + durationSec*1000`
    - `endEarly`: ใช้ได้เฉพาะ `countdown`/`running` → `phase='finished'`, `endAt = Math.min(endAt, now)`
    - `newRound`: ใช้ได้เฉพาะ `finished` → `roundId + 1`, `phase='lobby'`, `startAt`/`endAt = null`
      - ลบผู้เล่นที่หลุด (ทั้ง `playing` และ `queued`)
      - รีเซ็ต `score`/`levelsCompleted`/`bestCombo`/`combo` เป็น 0
      - ย้ายคิวเข้าเล่นตาม `queuedAt` จนครบ `MAX_PLAYERS`
      - จัดเลนใหม่ 0..n-1: คนที่อยู่ต่อเรียงตามเลนเดิม แล้วตามด้วยคนจากคิว
    - `kick`: ใช้ได้ทุก phase ลบ record (DO เป็นคนปิด socket)
  - `hashHostKey(key: string): Promise<string>` (SHA-256 เป็น hex ด้วย `crypto.subtle`)
  - `claimHost(room: StoredRoom, keyHash: string | null): boolean` (key แรกได้จองห้อง ครั้งต่อไปต้องตรงกับที่จองไว้ ถ้าไม่มี key คืน `false`)

- [ ] **Step 1: เขียน test ที่ fail** (ใช้ helper `hello(pid, name='P')` และ `conn(...pids)` เพื่อสร้าง `Set`)

```ts
it('seats lobby players in the lowest free lane', () => {
  const r = createRoom('CODI-1', 0)
  expect(joinPlayer(r, hello('p-aaaaaa'), conn('p-aaaaaa'), 1)).toBe('playing')
  expect(joinPlayer(r, hello('p-bbbbbb'), conn('p-aaaaaa', 'p-bbbbbb'), 2)).toBe('playing')
  leavePlayer(r, 'p-aaaaaa')
  joinPlayer(r, hello('p-cccccc'), conn('p-bbbbbb', 'p-cccccc'), 3)
  expect(r.players['p-cccccc'].lane).toBe(0)
})
it('two players with the same name get separate lanes', () => {
  const r = createRoom('CODI-1', 0)
  joinPlayer(r, hello('p-aaaaaa', 'มิ้นท์'), conn('p-aaaaaa'), 1)
  joinPlayer(r, hello('p-bbbbbb', 'มิ้นท์'), conn('p-aaaaaa', 'p-bbbbbb'), 2)
  expect(new Set(Object.values(r.players).map((p) => p.lane))).toEqual(new Set([0, 1]))
})
it('queues joiners while a round runs and returns full at 12 seats', () => { /* 12 seated → start → 13th hello in lobby is 'full'; during running a new pid is 'queued' only when seats < 12 */ })
it('a reloaded booth device keeps its lane and score mid-round', () => {
  // seat p-aaaaaa in lane 0, start, set score 500, then hello again with the same pid while running
  expect(joinPlayer(r, hello('p-aaaaaa'), conn('p-aaaaaa'), 5_000)).toBe('playing')
  expect(r.players['p-aaaaaa']).toMatchObject({ lane: 0, score: 500 })
})
it('start requires lobby and a connected playing player, and sets the clock', () => {
  const r = createRoom('CODI-1', 0)
  expect(applyHostCommand(r, { type: 'start' }, conn(), 1000)).toBe(false)
  joinPlayer(r, hello('p-aaaaaa'), conn('p-aaaaaa'), 1)
  applyHostCommand(r, { type: 'setDuration', durationSec: 600 }, conn('p-aaaaaa'), 1000)
  expect(applyHostCommand(r, { type: 'start' }, conn('p-aaaaaa'), 1000)).toBe(true)
  expect(r).toMatchObject({ phase: 'countdown', startAt: 4000, endAt: 604000 })
  expect(applyHostCommand(r, { type: 'setMode', mode: 'C' }, conn('p-aaaaaa'), 1100)).toBe(false)
})
it('newRound drops disconnected players, promotes the queue and re-lanes', () => {
  // lanes: A=0 (connected), B=1 (disconnected); queue Q1, Q2; finish → newRound
  // expect A lane 0, Q1 lane 1, Q2 lane 2, B removed, all scores 0, roundId 2, phase lobby
})
it('newRound and endEarly only from their phases', () => { /* newRound in running → false; endEarly in lobby → false */ })
it('first host key claims; a different key does not', async () => {
  const r = createRoom('CODI-1', 0)
  expect(claimHost(r, await hashHostKey('k'.repeat(20)))).toBe(true)
  expect(claimHost(r, await hashHostKey('z'.repeat(20)))).toBe(false)
  expect(claimHost(r, null)).toBe(false)
  expect(claimHost(r, await hashHostKey('k'.repeat(20)))).toBe(true)
})
```

ช่วงที่เป็นคอมเมนต์ใน test ให้เขียนเป็น assertion จริงตามที่คอมเมนต์อธิบาย

- [ ] **Step 2: รัน test เพื่อดูว่า fail**

Run: `pnpm --dir live-server test`
Expected: FAIL

- [ ] **Step 3: เขียนฟังก์ชันใน `room-logic.ts`** ตาม Interfaces

- [ ] **Step 4: รัน test และ typecheck ให้ผ่าน**

Run: `pnpm --dir live-server test && pnpm --dir live-server typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add live-server/src/room-logic.ts live-server/test/room-logic.lobby.test.ts
git commit -m "feat(live-server): room lobby, queue and host commands"
```

---

### Task 5: ตรรกะห้อง ส่วน progress, นาฬิกา และ snapshot

**Files:**
- Modify: `live-server/src/room-logic.ts`
- Create: `live-server/test/room-logic.race.test.ts`

**Interfaces:**
- Consumes: `StoredRoom`, `createRoom`, `joinPlayer`, `applyHostCommand` (Task 4)
- Produces:
  - `applyProgress(room: StoredRoom, pid: string, msg: ProgressMsg, now: number): boolean` รับเฉพาะเมื่อ:
    - `phase === 'running'` หรือ (`phase === 'finished'` และ `now ≤ endAt + GRACE_MS`)
    - `msg.roundId === room.roundId` และผู้ส่งมี `status === 'playing'`
    - `score`/`levelsCompleted`/`bestCombo` ไม่ลดลง และ `levelsCompleted ≤ MAX_LEVEL_ID`
    - `score - prev.score ≤ (levelsCompleted - prev.levelsCompleted) × maxLevelPoints(msg.bestCombo)`

    ถ้าไม่ผ่านข้อใดให้ทิ้งทั้งข้อความ (คืน `false`) ถ้าผ่านให้เขียนทั้ง 4 ค่าลงไป
  - `advanceClock(room: StoredRoom, now: number): boolean` (`countdown` → `running` เมื่อ `now ≥ startAt` แล้ว `running` → `finished` เมื่อ `now ≥ endAt` ทำได้ทั้งสองขั้นในการเรียกครั้งเดียว)
  - `nextAlarmAt(room: StoredRoom, openSockets: number): number | null` (`countdown` → `startAt` · `running` → `endAt` · ไม่มี socket เปิดอยู่ → `lastActivity + IDLE_MS` · นอกนั้น `null`)
  - `isIdleExpired(room: StoredRoom, openSockets: number, now: number): boolean`
  - `comparePlayers(a: LivePlayer, b: LivePlayer): number` (`playing` ก่อน `queued` · ใน `playing` เรียง score DESC → levelsCompleted DESC → joinedAt ASC · ใน `queued` เรียง queuedAt ASC)
  - `snapshot(room: StoredRoom, connected: Set<string>, counts: { screens: number; hosts: number }, now: number): RoomState`

- [ ] **Step 1: เขียน test ที่ fail**

```ts
// helper: running(): room with p-aaaaaa seated, started at t=0 (startAt 3000, endAt 483000), advanceClock(r, 3000)
const prog = (o: Partial<ProgressMsg> = {}): ProgressMsg => ({ type: 'progress', roundId: 1, score: 900, levelsCompleted: 1, bestCombo: 4, combo: 4, ...o })
it('accepts monotonic cumulative progress', () => {
  const r = running()
  expect(applyProgress(r, 'p-aaaaaa', prog(), 10_000)).toBe(true)
  expect(applyProgress(r, 'p-aaaaaa', prog({ score: 800 }), 11_000)).toBe(false) // stale/duplicate
  expect(r.players['p-aaaaaa'].score).toBe(900)
})
it('rejects score without a cleared level and jumps above the cap', () => {
  const r = running()
  expect(applyProgress(r, 'p-aaaaaa', prog({ levelsCompleted: 0 }), 10_000)).toBe(false)
  expect(applyProgress(r, 'p-aaaaaa', prog({ score: maxLevelPoints(4) + 1 }), 10_000)).toBe(false)
  expect(applyProgress(r, 'p-aaaaaa', prog({ score: maxLevelPoints(4) }), 10_000)).toBe(true)
})
it('ignores a previous round progress after newRound', () => {
  const r = running(); applyHostCommand(r, { type: 'endEarly' }, conn('p-aaaaaa'), 20_000)
  applyHostCommand(r, { type: 'newRound' }, conn('p-aaaaaa'), 30_000)
  applyHostCommand(r, { type: 'start' }, conn('p-aaaaaa'), 31_000); advanceClock(r, 34_000)
  expect(applyProgress(r, 'p-aaaaaa', prog({ roundId: 1 }), 35_000)).toBe(false)
  expect(applyProgress(r, 'p-aaaaaa', prog({ roundId: 2 }), 35_000)).toBe(true)
})
it('honours the 2s grace after endAt', () => {
  const r = running(); advanceClock(r, 483_000)
  expect(r.phase).toBe('finished')
  expect(applyProgress(r, 'p-aaaaaa', prog(), 485_000)).toBe(true)
  expect(applyProgress(r, 'p-aaaaaa', prog({ score: 1800, levelsCompleted: 2 }), 485_001)).toBe(false)
})
it('rejects progress from queued players', () => { /* queued pid during running → false */ })
it('advances countdown → running → finished even when woken late', () => {
  const r = running0() // countdown, not advanced
  expect(advanceClock(r, 500_000)).toBe(true)
  expect(r.phase).toBe('finished')
})
it('schedules alarms', () => {
  expect(nextAlarmAt(countdownRoom, 3)).toBe(3000)
  expect(nextAlarmAt(runningRoom, 3)).toBe(483_000)
  expect(nextAlarmAt(lobbyRoom, 0)).toBe(lobbyRoom.lastActivity + IDLE_MS)
  expect(nextAlarmAt(lobbyRoom, 2)).toBeNull()
})
it('snapshot sorts playing by score then queue by queuedAt and marks connection', () => { /* assert order + connected flags + serverNow === now */ })
```

ช่วงที่เป็นคอมเมนต์ใน test ให้เขียนเป็น assertion จริงตามที่คอมเมนต์อธิบาย

- [ ] **Step 2: รัน test เพื่อดูว่า fail**

Run: `pnpm --dir live-server test`
Expected: FAIL

- [ ] **Step 3: เขียนฟังก์ชันตาม Interfaces**

- [ ] **Step 4: รัน test และ typecheck ให้ผ่าน**

Run: `pnpm --dir live-server test && pnpm --dir live-server typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add live-server/src/room-logic.ts live-server/test/room-logic.race.test.ts
git commit -m "feat(live-server): progress validation, round clock and snapshots"
```

---

### Task 6: Durable Object `LiveRoom` + Worker entry + smoke test

**Files:**
- Create: `live-server/src/live-room.ts`, `live-server/src/index.ts`, `live-server/wrangler.jsonc`, `live-server/scripts/smoke.mjs`, `live-server/README.md`
- Modify: `live-server/tsconfig.json` (types ของ worker จาก `wrangler types`), `live-server/package.json` (script `smoke: node scripts/smoke.mjs`)

**Interfaces:**
- Consumes: `parseClientMessage` (Task 3) และฟังก์ชันทั้งหมดใน `room-logic` (Tasks 4–5)
- Produces:
  - **Endpoint:** `GET /rooms/:code/ws?role=player|host|screen[&key=…]` (WebSocket) · `GET /health` → `200 ok`
  - **`wrangler.jsonc`:** `name: "debug-master-live"`, `main: "src/index.ts"`, `compatibility_date: "2026-09-29"`, `observability.redact_query_string: true`, `vars.ALLOWED_ORIGINS: "https://itoon.github.io,http://localhost:3000"`, DO binding `LIVE_ROOM` → class `LiveRoom`, migration `{tag:"v1", new_sqlite_classes:["LiveRoom"]}`

**พฤติกรรมของ DO** (โครงเหมือน `codeventure-signal-lost-main/worker/race-room.ts` ให้เปิดไฟล์นั้นอ่านประกอบ):
- **การต่อ:**
  - `index.ts` ตอบ 426 ถ้าไม่ใช่ WebSocket upgrade
  - ถ้ามี header `Origin` และไม่อยู่ใน `ALLOWED_ORIGINS` ตอบ 403 (ไม่มี Origin ยอมให้ผ่าน เพื่อให้ smoke script ใช้ได้)
  - `normalizeRoomCode` ไม่ผ่านตอบ 400
  - ส่ง `key` ต่อให้ DO เฉพาะ `role=host` ที่ผ่าน `HOST_KEY_RE`
  - stub = `env.LIVE_ROOM.idFromName(code)`
- **hibernation:** ใช้ `ctx.acceptWebSocket(server, [role])`, `setWebSocketAutoResponse('ping','pong')` และ attachment `{ role, pid?: string, host?: boolean }`
- **host:** `claimHost` → ตอบ `{type:'host', host}` ตอน `hello`
  - คำสั่ง host จากการเชื่อมต่อที่ `host:false` ได้ `{type:'error', error:'not_host'}`
  - `kick` ส่ง `{type:'kicked'}` แล้วปิด socket ของ pid นั้นด้วย `CLOSE_KICKED`
- **player `hello`:** เรียก `joinPlayer`
  - ได้ `full` → ส่ง `{type:'full'}` แล้วปิดด้วย `CLOSE_FULL`
  - นอกนั้นส่ง `{type:'you', pid, status}` แล้วผูก pid กับ attachment
- **`leave`:** เรียก `leavePlayer` แล้วปิด socket ด้วย 1000
- **ข้อความที่ `parseClientMessage` คืน `null`:** ส่ง `{type:'error', error:'bad_message'}` (ไม่ปิด socket)
- **ทุกครั้งที่ห้องเปลี่ยน:** อัปเดต `lastActivity`, บันทึก storage key `room`, ตั้ง alarm ตาม `nextAlarmAt` แล้ว broadcast `{type:'state'}` (ห่างกันอย่างน้อย `BROADCAST_INTERVAL_MS` และส่งค่าล่าสุดตามหลัง)
- **`alarm()`:**
  - เรียก `advanceClock` → ถ้าห้องเปลี่ยนก็บันทึกแล้ว broadcast
  - ถ้า `isIdleExpired` → `storage.deleteAll()` แล้วรีเซ็ตเป็น `createRoom(code, now)`
  - สุดท้ายตั้ง alarm ใหม่
- **socket ปิดหรือ error:** บันทึก ตั้ง alarm แล้ว broadcast (สถานะ connected มาจาก socket ที่ยังเปิดอยู่ จึงไม่ต้องเก็บใน storage)

- [ ] **Step 1: สร้าง types ของ worker และเพิ่มเข้า tsconfig**

Run: `pnpm --dir live-server types`
Expected: มีไฟล์ `live-server/src/worker-configuration.d.ts` และมี `Env.LIVE_ROOM` กับ `ALLOWED_ORIGINS`

- [ ] **Step 2: เขียน `scripts/smoke.mjs`** ใช้ `WebSocket` ของ Node 22 ต่อเข้า `ws://127.0.0.1:8787/rooms/SMOKE-<random>/ws` ตามลำดับนี้ และ assert ทุกข้อ (`process.exit(1)` เมื่อมีข้อไหน fail):
  1. host ต่อด้วย key A ได้ `host:true` · host อีกตัวต่อด้วย key B ได้ `host:false` และพอส่ง `start` ได้ `not_host`
  2. screen ต่อแล้วได้ `state` ที่ `phase:'lobby'`
  3. ผู้เล่น P1, P2 ส่ง `hello` แล้วทั้งคู่ได้ `you` ที่ `status:'playing'`
  4. host ส่ง `setDuration 60` ตามด้วย `start` → state เป็น `countdown` ภายใน 1 วินาที และเป็น `running` ภายใน 4 วินาที
  5. P1 ส่ง `progress {roundId:1, score:500, levelsCompleted:1, bestCombo:2, combo:2}` → state ของ screen แสดง P1 อยู่ที่อันดับแรก
  6. P3 ส่ง `hello` ได้ `you` ที่ `status:'queued'`
  7. host ส่ง `endEarly` → `finished` แล้วส่ง `newRound` → `lobby`, `roundId:2`, P3 เป็น `playing` ที่ `lane:2`
  8. host ส่ง `kick` P2 → P2 ได้ `kicked` และ socket ปิดด้วย 4001

- [ ] **Step 3: เขียน `live-room.ts`, `index.ts`, `wrangler.jsonc` และ README** (README มี: วิธีรัน dev, deploy, ตั้ง `ALLOWED_ORIGINS` และ runbook "host key หาย ให้ใช้รหัสห้องใหม่")

- [ ] **Step 4: Typecheck และ unit test**

Run: `pnpm --dir live-server typecheck && pnpm --dir live-server test`
Expected: PASS

- [ ] **Step 5: รัน smoke กับ wrangler dev**

Run: `pnpm --dir live-server dev` (เปิดค้างใน terminal อื่น) แล้วตามด้วย `pnpm --dir live-server smoke`
Expected: smoke พิมพ์ `smoke ok` และ exit 0

- [ ] **Step 6: Commit**

```bash
git add live-server/src/live-room.ts live-server/src/index.ts live-server/src/worker-configuration.d.ts live-server/wrangler.jsonc live-server/scripts/smoke.mjs live-server/README.md live-server/tsconfig.json live-server/package.json
git commit -m "feat(live-server): LiveRoom durable object, worker entry and smoke test"
```

---

### Task 7: Client WebSocket, ตัวตนในเครื่อง และ composable

**Files:**
- Create: `app/utils/live/socket.ts`, `app/utils/live/identity.ts`, `app/composables/useLiveRoom.ts`, `tests/live/socket.test.ts`
- Modify: `nuxt.config.ts` (`runtimeConfig: { public: { liveUrl: "" } }`)

**Interfaces:**
- Consumes: protocol (Task 1), `clockOffset` (Task 2)
- Produces:
  - **`socket.ts` (ไม่พึ่ง Vue):**
    - `liveWsUrl(base: string, code: string, role: Role, key?: string): string` เปลี่ยน `https://x` เป็น `wss://x/rooms/CODE/ws?role=…[&key=…]` และ `http` เป็น `ws` (ตัด `/` ท้าย base ออก และใส่ key เฉพาะ role `host`)
    - `openLiveSocket(url: string, hello: () => ClientMessage, handlers: { onMessage(m: ServerMessage, receivedAt: number): void; onConnection(up: boolean): void }): { send(msg: ClientMessage, coalesceKey?: string): void; close(): void }`
    - พฤติกรรมยกมาจาก `connect()` ใน `codeventure-signal-lost-main/src/live.ts`: ต่อใหม่ตาม Global Constraints, ping ทุก 20 วินาที, ส่ง `hello` ใหม่ทุกครั้งที่ต่อได้ และเก็บข้อความที่ส่งไม่ได้ไว้ในคิว (key เดียวกันเก็บแค่ล่าสุด)
  - **`identity.ts`:** อ่าน/เขียน localStorage ใน try/catch เสมอ
    - `livePlayerId(): string` (key `debug-master:live-pid` ถ้าไม่มีสร้างด้วย `crypto.randomUUID()`)
    - `resetLivePlayerId(): string`
    - `hostKeyFor(code: string): string | null` · `saveHostKey(code: string, key: string): void` (key `debug-master:host:<CODE>`)
    - `newHostKey(): string` (18 bytes จาก `crypto.getRandomValues` เข้ารหัส base64url)
  - **`useLiveRoom.ts`:**
    - `useLiveConfig(): { liveUrl: string; enabled: boolean }`
    - `useLiveRoom(opts: { code: string; role: Role; key?: string; hello: () => ClientMessage }): { state: Ref<RoomState | null>; offset: Ref<number>; connected: Ref<boolean>; isHost: Ref<boolean | null>; you: Ref<{ pid: string; status: PlayerStatus } | null>; notice: Ref<'full' | 'kicked' | null>; error: Ref<'not_host' | 'bad_message' | null>; send(msg: ClientMessage, coalesceKey?: string): void; close(): void }`
    - ปิด socket ใน `onBeforeUnmount` และอัปเดต `offset` ด้วย `clockOffset(state.serverNow, receivedAt)` ทุกครั้งที่ได้ `state`

- [ ] **Step 1: เขียน test ที่ fail** `tests/live/socket.test.ts`

```ts
it('builds secure and local socket URLs', () => {
  expect(liveWsUrl('https://live.example.workers.dev/', 'codi-1', 'player')).toBe('wss://live.example.workers.dev/rooms/CODI-1/ws?role=player')
  expect(liveWsUrl('http://127.0.0.1:8787', 'CODI-1', 'screen')).toBe('ws://127.0.0.1:8787/rooms/CODI-1/ws?role=screen')
  expect(liveWsUrl('https://x.dev', 'CODI-1', 'host', 'k_k-'.repeat(5))).toBe(`wss://x.dev/rooms/CODI-1/ws?role=host&key=${'k_k-'.repeat(5)}`)
  expect(liveWsUrl('https://x.dev', 'CODI-1', 'player', 'secret-secret-secret')).not.toContain('key=')
})
```

- [ ] **Step 2: รัน test เพื่อดูว่า fail**

Run: `pnpm test`
Expected: FAIL

- [ ] **Step 3: เขียน `socket.ts`, `identity.ts`, `useLiveRoom.ts` และแก้ `nuxt.config.ts`**

- [ ] **Step 4: รัน test และ build ให้ผ่าน**

Run: `pnpm test && pnpm build`
Expected: PASS และ build exit 0

- [ ] **Step 5: Commit**

```bash
git add app/utils/live/socket.ts app/utils/live/identity.ts app/composables/useLiveRoom.ts tests/live/socket.test.ts nuxt.config.ts
git commit -m "feat(live): reconnecting room socket and composable"
```

---

### Task 8: สถานะหน้าจอของผู้เล่น (ฟังก์ชันล้วน)

**Files:**
- Create: `app/utils/live/playerStage.ts`, `tests/live/playerStage.test.ts`

**Interfaces:**
- Consumes: protocol (Task 1), `serverTime` (Task 2)
- Produces:
  - `type LivePlayerStage = 'unavailable' | 'setup' | 'connecting' | 'lobby' | 'queued' | 'full' | 'kicked' | 'countdown' | 'running' | 'results'`
  - `derivePlayerStage(i: { enabled: boolean; code: string | null; hasProfile: boolean; connected: boolean; notice: 'full' | 'kicked' | null; state: RoomState | null; pid: string; offset: number; now: number }): LivePlayerStage`
  - ลำดับการตัดสิน (ข้อแรกที่ตรงชนะ):
    1. ไม่ `enabled` หรือ `code` เป็น null → `unavailable`
    2. ยังไม่มีโปรไฟล์ → `setup`
    3. `notice` → `full` / `kicked`
    4. ยังไม่มี state → `connecting`
    5. หาตัวเองใน `state.players` ด้วย pid ไม่เจอ → `connecting`
    6. ตัวเองเป็น `queued` → `queued`
    7. `phase` เป็น `lobby` → `lobby`
    8. `phase` เป็น `countdown` และ `serverTime < startAt` → `countdown`
    9. `phase` เป็น `running` หรือ `countdown` → `running`
    10. `phase` เป็น `finished` → `results`

- [ ] **Step 1: เขียน test ที่ fail** ให้ครอบทั้ง 10 ข้อ อย่างน้อยต้องมี:

```ts
it('shows the race once server time passes startAt even before the running broadcast', () => {
  const s = state({ phase: 'countdown', startAt: 10_000 }, me('playing'))
  expect(derivePlayerStage({ ...base, state: s, offset: 0, now: 9_999 })).toBe('countdown')
  expect(derivePlayerStage({ ...base, state: s, offset: 0, now: 10_000 })).toBe('running')
})
it('keeps a queued player in the queue while the round runs', () =>
  expect(derivePlayerStage({ ...base, state: state({ phase: 'running' }, me('queued')) })).toBe('queued'))
it('a kicked notice wins over any state', () =>
  expect(derivePlayerStage({ ...base, notice: 'kicked', state: state({ phase: 'running' }, me('playing')) })).toBe('kicked'))
```

- [ ] **Step 2: รัน test เพื่อดูว่า fail**

Run: `pnpm test`
Expected: FAIL

- [ ] **Step 3: เขียน `derivePlayerStage`**

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/utils/live/playerStage.ts tests/live/playerStage.test.ts
git commit -m "feat(live): derive player screen stage from room state"
```

---

### Task 9: จอใหญ่ `/live/screen`

**Files:**
- Create: `app/pages/live/screen.vue`, `app/components/live/RaceLanes.vue`, `app/components/live/LiveBoard.vue`, `app/components/live/LobbyStage.vue`, `app/components/live/QueueStrip.vue`, `app/components/live/LiveResults.vue`
- Modify: `app/i18n/messages.ts`, `package.json` (`uqr@^0.1.2`)

**Interfaces:**
- Consumes: `useLiveRoom`, `useLiveConfig` (Task 7) · `trackMax`, `laneFraction`, `trackTicks` (Task 2) · `remainingSec` (Task 2) · `usePlayerAvatar` · `useGameAudio` · `homeConfig` (ชื่อโหมดใช้คีย์ `mode.A`/`difficulty.X` ที่มีอยู่แล้ว)
- Produces (props ของ component):
  - `RaceLanes { players: LivePlayer[]; max: number }` (เฉพาะคนที่เป็น `playing` เรียงตาม `lane`)
  - `LiveBoard { players: LivePlayer[] }` (เรียงตามอันดับแล้ว ใช้ `<TransitionGroup>` แบบ FLIP 300 ms)
  - `LobbyStage { code: string; joinUrl: string; mode: ModeId; durationSec: number; players: LivePlayer[] }`
  - `QueueStrip { players: LivePlayer[] }`
  - `LiveResults { players: LivePlayer[]; mode: ModeId }`

**รายละเอียดหน้าตา (spec ข้อ 5.1–5.3 และ mockup `themed-screens.html` ที่อนุมัติแล้ว):**
- **`screen.vue`:**
  - อ่าน `?room=` ด้วย `normalizeRoomCode` ถ้าไม่ผ่านให้แสดงช่องกรอกรหัสห้อง
  - ต่อด้วย `role: 'screen'` และ `hello: () => ({ type: 'hello' })`
  - เลือกเนื้อหาตาม `phase`: `lobby` → `LobbyStage` · `countdown` → `LobbyStage` + ตัวเลข 3-2-1 ใหญ่ · `running` → HUD + `RaceLanes` + `LiveBoard` + `QueueStrip` · `finished` → `LiveResults` + `QueueStrip`
  - `joinUrl = location.origin + useRuntimeConfig().app.baseURL + '?room=' + code`
- **HUD:** ป้าย `LIVE RACE · CODE` และกล่อง `.metric` สามกล่อง (โหมด, เวลาที่เหลือ, ผู้เล่น)
  - ใน 30 วินาทีสุดท้ายใช้ class `time-low` และ keyframes เดียวกับ `GameHud`
  - นาฬิกาอัปเดตทุก 250 ms จาก `remainingSec(state.endAt, offset)`
- **`RaceLanes`:**
  - กระเบื้องของแต่ละเลนวนตามลำดับ `['grass','ice','sand','stone','wood','blue'][lane % 6]` จาก `${baseURL}tiles/<kind>.png` เป็น `background-repeat: repeat-x` และส่วนที่ยังไม่วิ่งถึงมีชั้นสีมืดทับ
  - avatar วิ่ง (hop) 1.2 วินาทีหลังคะแนนเพิ่ม ตำแหน่ง `left: laneFraction*100%` เลื่อนด้วย transition 600 ms ease-out
  - คนนำมีขอบ `#ffdb58` และมงกุฎ (path svg เดียวกับ `ChallengeRanking`)
  - `combo ≥ 5` มีป้าย `×N` พื้น `#f79722` ตัวอักษร `#3b1d00`
  - คนที่ `connected:false` เลนจางลง (opacity .45) พร้อมป้าย `live.disconnected`
- **`LobbyStage`:** QR จาก `renderSVG(joinUrl)` ของ `uqr` อยู่บนการ์ดสีขาวมุม `--cv-radius-xl`
  - รหัสห้องสี `#ffdb58` และ Codi จาก `~/assets/sprites/cody-happy.webp`
  - มีช่องผู้เล่น 12 ช่องบน `tiles/grass.png` ช่องที่ยังว่างเป็นเส้นประ
- **`LiveResults`:** โพเดียม 1–3 ขึ้นตามลำดับ 3 → 2 → 1 ใช้ค่าสีเหรียญตามที่บันทึกในส่วน "ข้อตัดสินใจเพิ่ม" และอันดับ 4 ขึ้นไปเป็นแถวด้านล่าง
  - ตอนเปลี่ยนเป็น `finished` เล่นเสียง `playSound('complete')` หนึ่งครั้ง
- **reduced motion:** ไม่มี hop, ไม่มี transition ตำแหน่ง, ไม่มีโพเดียมเด้งขึ้น แต่ยังเห็นตำแหน่งและสีเหมือนเดิม

**คีย์ i18n ที่ต้องเพิ่ม** (ข้อความภาษาไทยตามนี้):

| key | text |
|---|---|
| `live.brand` | `LIVE RACE` |
| `live.mode` | `โหมด` |
| `live.timeLeft` | `เวลาที่เหลือ` |
| `live.players` | `ผู้เล่น` |
| `live.board` | `อันดับสด` |
| `live.queue` | `คิวรอบหน้า` |
| `live.disconnected` | `หลุด` |
| `live.scanToJoin` | `สแกนเข้าห้อง` |
| `live.roomCode` | `รหัสห้อง` |
| `live.nextRound` | `รอบถัดไป · {mode} · {minutes} นาที` |
| `live.emptySeat` | `ว่าง` |
| `live.resultsTitle` | `จบรอบ! ผู้ชนะ` |
| `live.enterCode` | `ใส่รหัสห้อง` |
| `live.open` | `เปิดห้อง` |
| `live.unavailable` | `ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ Live` |
| `live.reconnecting` | `กำลังเชื่อมต่อใหม่…` |

- [ ] **Step 1: ติดตั้ง `uqr`**

Run: `pnpm add uqr@^0.1.2`
Expected: `package.json` และ lockfile อัปเดต

- [ ] **Step 2: เขียน component, หน้า และคีย์ i18n**

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: exit 0

- [ ] **Step 4: ตรวจในเบราว์เซอร์กับ server ในเครื่อง**
  - รัน `pnpm --dir live-server dev` และรัน `NUXT_PUBLIC_LIVE_URL=http://127.0.0.1:8787 pnpm dev`
  - เปิด `/live/screen?room=DEV-1` ที่ viewport 1920×1080 (ตอนนี้เห็นแค่ Lobby ส่วนลู่วิ่งกับผลรอบจะตรวจจริงใน Task 11 Step 5)
  - เช็กว่าไม่มี console error และ QR สแกนได้

Expected: เห็น Lobby ในธีมเกม ไม่มี console error และ QR ชี้ไปที่ `http://localhost:3000/?room=DEV-1`

- [ ] **Step 5: Commit**

```bash
git add app/pages/live/screen.vue app/components/live/RaceLanes.vue app/components/live/LiveBoard.vue app/components/live/LobbyStage.vue app/components/live/QueueStrip.vue app/components/live/LiveResults.vue app/i18n/messages.ts package.json pnpm-lock.yaml
git commit -m "feat(live): big-screen lobby, race lanes and results"
```

---

### Task 10: หน้าคุม `/live/host`

**Files:**
- Create: `app/pages/live/host.vue`
- Modify: `app/i18n/messages.ts`

**Interfaces:**
- Consumes: `useLiveRoom`, `useLiveConfig` (Task 7) · `hostKeyFor`, `saveHostKey`, `newHostKey` (Task 7) · `normalizeRoomCode`, `DURATION_PRESETS_SEC`, `MIN_DURATION_SEC`, `MAX_DURATION_SEC` (Task 1) · `remainingSec` (Task 2)

**พฤติกรรม (spec ข้อ 4 "Host key" และ 5.4):**
- **การได้ key:**
  - ถ้า URL มี `?room=&key=` → `saveHostKey` แล้ว `router.replace` ลบ `key` ออกจาก URL
  - ถ้าไม่มี key ใน URL ให้อ่าน `hostKeyFor(code)` ถ้ายังไม่มีอีกให้แสดงฟอร์ม "สร้างห้อง" (ช่องรหัสห้อง + ปุ่ม) ซึ่งเรียก `newHostKey()` แล้ว `saveHostKey`
- ต่อด้วย `role: 'host'` และ `hello: () => ({ type: 'hello' })` ถ้า `isHost === false` ให้แสดง `live.hostDenied` และปิดปุ่มคุมทั้งหมด
- **Lobby:**
  - radio การ์ด A/B/C → `setMode`
  - ปุ่ม 8/10/15 กับ "กำหนดเอง" (input number 1–15 นาที) → `setDuration`
  - รายชื่อ `playing` และ `queued` แยกกัน มีปุ่ม `live.kick` และคนที่ `connected:false` ใช้สีเทาพร้อมป้าย `live.disconnected`
  - ปุ่ม CTA `live.start` (พื้น `--cv-cta`) กดไม่ได้ถ้าไม่มีผู้เล่น `playing` ที่เชื่อมต่ออยู่
- **ระหว่างแข่ง:** แสดงเวลาที่เหลือ, อันดับ 1–3 และปุ่ม `live.endEarly` ที่เปิด `<dialog>` ยืนยัน (focus ที่ปุ่มยกเลิกก่อน)
- **Finished:** ปุ่ม `live.newRound`
- **ทุก phase:**
  - ปุ่ม `live.copyHostLink` คัดลอก `${origin}${baseURL}live/host?room=CODE&key=KEY`
  - ลิงก์ `live.openScreen` ไปที่ `/live/screen?room=CODE`
  - ปุ่มทุกปุ่มสูงอย่างน้อย 48 px และกดไม่ได้ตอน `connected === false` (แสดง `live.reconnecting`)
  - หน้ามี container ที่ scroll เองได้ เพราะ `body` ตั้ง `overflow: hidden`

**คีย์ i18n ที่ต้องเพิ่ม:**

| key | text |
|---|---|
| `live.hostTitle` | `หน้าคุม` |
| `live.createRoom` | `สร้างห้อง` |
| `live.chooseMode` | `เลือกโหมดรอบนี้` |
| `live.chooseTime` | `เวลาต่อรอบ` |
| `live.minutes` | `{count} นาที` |
| `live.custom` | `กำหนดเอง` |
| `live.waitingQueue` | `คิวรอบหน้า {count} คน` |
| `live.playersCount` | `ผู้เล่น {count} คน` |
| `live.kick` | `เตะ` |
| `live.start` | `▶ เริ่มแข่ง {minutes} นาที` |
| `live.endEarly` | `จบรอบก่อนเวลา` |
| `live.endEarlyConfirm` | `จบรอบนี้เลยไหม? คะแนนตอนนี้จะเป็นผลสุดท้าย` |
| `live.cancel` | `ยกเลิก` |
| `live.confirm` | `ยืนยัน` |
| `live.newRound` | `เปิดรอบใหม่` |
| `live.copyHostLink` | `คัดลอกลิงก์หน้าคุม` |
| `live.copied` | `คัดลอกแล้ว` |
| `live.openScreen` | `เปิดจอใหญ่` |
| `live.hostDenied` | `เครื่องนี้ดูได้อย่างเดียว ไม่มีสิทธิ์คุมห้องนี้` |
| `live.waitStart` | `รอเริ่ม` |

- [ ] **Step 1: เขียน `host.vue` และคีย์ i18n**

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: exit 0

- [ ] **Step 3: ตรวจในเบราว์เซอร์** (server ในเครื่องเหมือน Task 9) ตามลำดับ:
  1. สร้างห้อง `DEV-1`
  2. เปิด `/live/screen?room=DEV-1` อีกแท็บ
  3. เปิดลิงก์หน้าคุมที่คัดลอกในแท็บไม่ระบุตัวตน → ต้องคุมได้
  4. เปิด `/live/host?room=DEV-1` แบบไม่มี key ในแท็บไม่ระบุตัวตนอีกแท็บ → ต้องขึ้น `live.hostDenied`
  5. เช็กที่ viewport 375×812 ว่าไม่มี scroll แนวนอน

Expected: ได้ผลตามทุกข้อ และไม่มี console error

- [ ] **Step 4: Commit**

```bash
git add app/pages/live/host.vue app/i18n/messages.ts
git commit -m "feat(live): host controller page"
```

---

### Task 11: โหมด Live ในหน้าเกม

**Files:**
- Create: `app/components/live/LivePlayerPanel.vue`
- Modify: `app/pages/index.vue`, `app/components/GameHud.vue`, `app/i18n/messages.ts`

**Interfaces:**
- Consumes: `useLiveRoom`, `useLiveConfig`, `livePlayerId`, `resetLivePlayerId` (Task 7) · `derivePlayerStage` (Task 8) · `remainingSec`, `countdownSec` (Task 2) · `PlayerSetupDialog` (props `mode: ChallengeMode`, emits `start(PlayerSetupInput)`, `close`)
- Produces:
  - `GameHud` มี prop ใหม่ `liveRank?: string` (เช่น `"2/7"`) แสดงเป็นกล่อง `.metric` ป้าย `live.rank` ต่อจากกล่องเวลา
  - `LivePlayerPanel { stage: LivePlayerStage; state: RoomState | null; pid: string; countdown: number; queueRemainingSec: number; lateScoreNote: boolean }` emits `changePlayer`, `leave`, `home` (ครอบทุก stage ยกเว้น `setup` กับ `running`)

**การแก้ `index.vue`** (ให้ diff เล็กที่สุด และแยกส่วน Live ไว้ในบล็อก `// ---- Live ----` บล็อกเดียว):
- `liveCode = normalizeRoomCode(useRoute().query.room)` · `liveMode = computed(() => liveCode !== null)`
- **ตอน mount ถ้า `liveMode`:**
  - ไม่เรียก `resetHomeSession` / HomeV2 (`showSetup = false`)
  - แสดง `PlayerSetupDialog` ด้วย `mode` = โหมดปัจจุบันของห้อง (ก่อนได้ state ใช้ `homeConfig.modes[0]`)
  - ได้ `start(profile)` → เก็บโปรไฟล์ แล้วต่อ `useLiveRoom({ role:'player', hello: () => ({ type:'hello', pid, name, avatarId, age }) })`
- **ถ้ายังไม่ได้ตั้ง `liveUrl`:** stage เป็น `unavailable` ให้แสดง `live.unavailable` พร้อมปุ่มกลับหน้าแรก
- **stage เปลี่ยนเป็น `running` (ครั้งเดียวต่อ `roundId`):**
  - ตั้ง `activeChallenge` = โหมดใน `homeConfig.modes` ที่ id ตรงกับ `state.mode`
  - ตั้ง `selectedSetId`, `selectedMode = "timer"`, `customMinutes = state.durationSec / 60`
  - ตั้ง `playerName`/`currentAvatarId`/`playerAge` จากโปรไฟล์ แล้วเรียก `startGame()`
- **`beginTimer()`:** ถ้า `liveMode` ให้คำนวณ `timerRemaining = remainingSec(state.endAt, offset)` ทุก 250 ms แทนการลดทีละ 1 แล้วเรียก `timeUp()` เมื่อถึง 0
- **progress:**
  - `watch([totalScore, completedLevels, comboStreak, bestCombo])` ตอน stage `running` ส่ง `progress` (`roundId` ของรอบนี้) ด้วย coalesce key `'progress'` และเว้นระยะอย่างน้อย `PROGRESS_INTERVAL_MS` (ส่งค่าล่าสุดตามหลัง)
  - `timeUp()` ในโหมด Live ส่ง progress สุดท้ายทันทีโดยไม่รอระยะ
- **ห้ามบันทึกคะแนน:** `saveScore()` / `timeUp()` / `completeLevel()` ในโหมด Live ต้องไม่เขียนลง repository, ไม่เปิด SessionPanel และไม่เปิด Ranking (เช็ก `liveMode` ก่อนทุกครั้ง) ถ้าผ่านครบทุกด่านก่อนหมดเวลาให้รอผลรอบ
- **`liveRank`:** ส่งให้ `GameHud` เป็น `${อันดับของตัวเอง}/${จำนวนผู้เล่น playing}`
- **ตอน `roundId` เปลี่ยนและ phase เป็น `lobby`:** หยุดเกม (`stopTimer`, `clearPendingRunTimers`, `campaignStarted=false`) แล้วกลับไปหน้ารอ โดยยังใช้โปรไฟล์เดิม
- **`changePlayer`:** ส่ง `leave` → `close` → `resetLivePlayerId()` → ล้างโปรไฟล์ → กลับไป stage `setup`
- **`kicked`/`home`:** ปิด socket แล้ว `router.replace({ query: {} })` และเรียก `resetHomeSession()`
- **idle timeout 90 วินาที:** ต้องไม่ทำงานระหว่าง `liveMode`
- **`lateScoreNote`:** เป็น `true` เมื่อ stage `results` และ `totalScore > คะแนนของตัวเองใน state` เพื่อแสดง `live.lateScore`

**คีย์ i18n ที่ต้องเพิ่ม:**

| key | text |
|---|---|
| `live.rank` | `อันดับ` |
| `live.waitHost` | `รอสตาฟฟ์กดเริ่ม` |
| `live.roundInfo` | `{mode} · {minutes} นาที` |
| `live.queued` | `คุณอยู่ในคิวรอบหน้า` |
| `live.queuedEta` | `อีก {time} เริ่มรอบใหม่` |
| `live.full` | `ห้องเต็ม รอรอบหน้านะ` |
| `live.kicked` | `สตาฟฟ์นำคุณออกจากห้องแล้ว` |
| `live.countdownGo` | `เริ่ม!` |
| `live.yourRank` | `คุณได้อันดับ {rank} จาก {total}` |
| `live.lateScore` | `บันทึกคะแนนล่าสุดที่ส่งทันเวลา` |
| `live.changePlayer` | `เปลี่ยนผู้เล่น` |
| `live.leave` | `ออกจากห้อง` |
| `live.home` | `กลับหน้าแรก` |

- [ ] **Step 1: เพิ่ม prop `liveRank` ใน `GameHud.vue` และเขียน `LivePlayerPanel.vue` พร้อมคีย์ i18n**

- [ ] **Step 2: แก้ `index.vue` ตามรายการข้างบน**

- [ ] **Step 3: Test + build**

Run: `pnpm test && pnpm build`
Expected: PASS และ build exit 0

- [ ] **Step 4: ตรวจว่าโหมดเดิมไม่เสีย** เปิด `/` แบบไม่มี `?room=` แล้วเล่นโหมด A ผ่าน 1 ด่าน, Exit และฝึกซ้อม 1 ด่าน

Expected: เหมือนก่อนแก้ทุกอย่าง (คะแนนบันทึกลง Ranking ตามปกติ)

- [ ] **Step 5: ตรวจรอบ Live สั้นๆ** (server ในเครื่อง): หน้าคุม `DEV-1` เลือก "กำหนดเอง 1 นาที", จอใหญ่ และผู้เล่น 2 แท็บ `/?room=DEV-1`

Expected:
- countdown ตรงกันทุกแท็บ
- จอใหญ่ขยับเลนตามคะแนนทุกครั้งที่ผ่านด่าน และ HUD ผู้เล่นมีอันดับ
- พอหมดเวลา ปุ่มล็อก และผลตรงกันทุกจอ
- `localStorage` ไม่มีคะแนนใหม่ในคีย์ของ ScoreRepository

- [ ] **Step 6: Commit**

```bash
git add app/components/live/LivePlayerPanel.vue app/pages/index.vue app/components/GameHud.vue app/i18n/messages.ts
git commit -m "feat(live): live player mode in the game page"
```

---

### Task 12: Deploy config + ซ้อมตาม checklist

**Files:**
- Modify: `.github/workflows/deploy.yml` (step `Build for GitHub Pages` เพิ่ม env `NUXT_PUBLIC_LIVE_URL: ${{ vars.LIVE_URL }}`), `live-server/README.md` (ส่วนซ้อม)
- Create: ไม่มี

- [ ] **Step 1: แก้ `deploy.yml`** และเขียนลง README ว่าต้องตั้ง repository variable `LIVE_URL` (เช่น `https://debug-master-live.<account>.workers.dev`) และ deploy worker ด้วย `pnpm --dir live-server run deploy` ซึ่งผู้ใช้ต้อง `wrangler login` เอง

- [ ] **Step 2: รันชุดตรวจทั้งหมด**

Run: `pnpm test && pnpm build && pnpm --dir live-server test && pnpm --dir live-server typecheck`
Expected: PASS ทั้งหมด

- [ ] **Step 3: ซ้อมตาม checklist ของ spec ข้อ 7** (ทั้ง 8 ข้อ) กับ `wrangler dev` และมือถือจริงอย่างน้อย 1 เครื่อง
  - มือถือเข้าผ่าน IP ของเครื่องในวง LAN: เพิ่ม origin นั้นใน `ALLOWED_ORIGINS` ของ `wrangler dev` ด้วย `--var` ห้ามแก้ไฟล์
  - จดผลแต่ละข้อ (ผ่าน/ไม่ผ่าน) ลงในรายงานส่งงาน ข้อไหนไม่ผ่านให้เปิด task แก้ก่อน

Expected: ผ่านครบ 8 ข้อ

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml live-server/README.md
git commit -m "chore(live): wire live server URL into the Pages build"
```

- [ ] **Step 5: เอกสารประจำ repo** `docs/HANDOFF.md` และ `DESIGN.md` บันทึกงานทุกครั้ง แต่ตอนนี้ `HANDOFF.md` มีงานที่ผู้ใช้ยังไม่ commit ให้ถามผู้ใช้ก่อนแก้ไฟล์ทั้งสอง ถ้าผู้ใช้อนุมัติ ให้เพิ่มรายการ "2026-10-14 — Live race room" (สรุปฟีเจอร์ + วิธีตรวจ) และเพิ่มส่วน Live ใน DESIGN.md › Components
