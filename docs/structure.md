# โครงสร้างโปรเจกต์ Debug Runner (สำหรับน้องที่เพิ่งเข้ามา)

เอกสารนี้อธิบายว่าแต่ละไฟล์ใน `game/` ทำอะไร ข้อมูลไหลอย่างไร และส่วนไหนหยิบไปใช้กับ platform อื่นได้
อ่านจากบนลงล่างครั้งแรก แล้วค่อยใช้เป็นแผนที่เวลาจะแก้โค้ด

---

## 1. เกมนี้คืออะไร

**Debug Runner** เป็นเกมฝึกอ่านโค้ด: เกมโชว์โปรแกรมสั้นๆ (เช่น `repeat(3): right()`) กับกระดานสี
ผู้เล่นต้อง **กดลูกศรให้ตรงกับที่โปรแกรมจะสั่งทีละก้าว** โดยไม่ได้แก้โค้ด
คำสั่ง `if` / `while` จะอ่าน "สีของช่องที่ Codi ยืนอยู่" ผู้เล่นจึงต้องไล่โค้ดในหัวให้ถูก

| เรื่อง | ใช้อะไร |
|---|---|
| Framework | **Nuxt 4** (Vue 3) + TypeScript |
| สไตล์ | CSS ธรรมดา (มี Tailwind ติดตั้งไว้แต่แทบไม่ได้ใช้) |
| Backend | **ไม่มี** ทุกอย่างรันในเบราว์เซอร์ คะแนนเก็บใน `localStorage` |
| Deploy | Static site บน GitHub Pages (`/debug-master/`) ผ่าน GitHub Actions |

## 2. รันโปรเจกต์

ต้องใช้ **Node 22 ขึ้นไป** (ดู `.nvmrc`) และ pnpm

```bash
pnpm install
pnpm dev                     # เปิด http://localhost:3000
pnpm generate                # build เป็น static site ไว้ที่ .output/public
pnpm dlx jiti scripts/check-level-gen.ts 300 30   # ทดสอบตัวสร้างด่าน (Dead Mode)
```

หน้าที่มี: `/` (เกม) · `/review` (คลังโจทย์สำหรับผู้ตรวจ) · `/elements` (รายการ asset สำหรับทีมออกแบบ)

---

## 3. แผนผังโฟลเดอร์

```
game/
├─ app/
│  ├─ app.vue                  กรอบนอกสุด แค่ <NuxtPage/> (ให้ Nuxt เลือกหน้าตาม URL)
│  ├─ pages/                   หนึ่งไฟล์ = หนึ่ง URL
│  │  ├─ index.vue             ตัวเกม (หน้าตั้งค่า, กระดาน, HUD, ตรรกะการเล่น)
│  │  ├─ review.vue            คลังโจทย์ 60 ข้อ Set A/B + ตัวอย่าง Dead Mode
│  │  └─ elements.vue          รายการ asset ที่ทีมออกแบบต้องเตรียม
│  ├─ components/              ชิ้นส่วน UI ที่ใช้ซ้ำหลายหน้า
│  │  ├─ LevelBoard.vue        วาดกระดาน (ช่อง + ช่อง START) มี slot ให้วาง Codi
│  │  ├─ LevelCode.vue         วาดหน้าต่างโค้ด (สีไวยากรณ์ + ป้ายช่อง เช่น [■ ice])
│  │  └─ DocShell.vue          ส่วนหัว/เมนูของหน้า review และ elements
│  ├─ composables/             ตรรกะที่หน้า/คอมโพเนนต์เรียกใช้
│  │  ├─ useProgramParser.ts   แปลงโค้ด (ข้อความ) → ต้นไม้คำสั่ง (AST)   [ไม่พึ่ง Vue]
│  │  ├─ useBoardPresentation.ts  คำนวณข้อมูลวาดกระดาน + ขนาดช่อง        [ใช้ Vue]
│  │  └─ useCodePresentation.ts   แยกโค้ดเป็นชิ้นเพื่อใส่สี + ขนาดตัวอักษร  [ใช้ Vue]
│  ├─ utils/                   ฟังก์ชันล้วน ไม่พึ่ง Vue
│  │  ├─ programRunner.ts      ★ ตัวรันโปรแกรม (interpreter) ใช้ทั้งเกมและหน้า review
│  │  ├─ codeLanguage.ts       แปลงโค้ด Python → JavaScript สำหรับแสดงผล
│  │  └─ levelGen/             ตัวสร้างด่านอัตโนมัติ (Dead Mode)
│  ├─ data/                    ข้อมูล (แก้เนื้อหาที่นี่ ไม่ต้องแตะโค้ด)
│  │  ├─ levels.ts             Set A: 60 ด่านต้นฉบับ
│  │  ├─ set-02.json           Set B: 60 ด่านชุดใหม่
│  │  ├─ level-sets.ts         รวมชุดด่าน + ชื่อ/คำอธิบายที่โชว์ในเกม
│  │  └─ assets.ts             รายการ asset สำหรับหน้า /elements
│  ├─ types/debug-game.ts      ชนิดข้อมูล (type) ที่ใช้ร่วมกันทั้งโปรเจกต์
│  └─ assets/                  ไฟล์ที่ผ่าน Vite (ได้ hash + base URL ถูกต้องอัตโนมัติ)
│     ├─ css/tailwind.css      ฟอนต์ + ตัวแปรสี/ขนาด (design tokens) ของทั้งเว็บ
│     ├─ css/board.css         หน้าตากระดาน ช่องทุกชนิด Codi และหน้าต่างโค้ด
│     ├─ sprites/ font/ bg.png รูป Codi, หิน, คริสตัล, ฟอนต์, ฉากหลัง
├─ scripts/check-level-gen.ts  สคริปต์ทดสอบตัวสร้างด่านแบบจำนวนมาก
├─ public/                     ไฟล์ที่เสิร์ฟตรงๆ ไม่ผ่าน Vite (favicon, robots.txt)
├─ nuxt.config.ts              ตั้งค่า Nuxt (โมดูล, ไฟล์ CSS ส่วนกลาง)
└─ .github/workflows/deploy.yml   build แล้ว deploy ขึ้น GitHub Pages ทุกครั้งที่ push main
```

> **กฎจำง่าย:** อยากแก้ *เนื้อหา* → `data/` · อยากแก้ *หน้าตา* → `assets/css/` · อยากแก้ *กติกา* → `utils/` · อยากแก้ *หน้าจอ/การไหลของเกม* → `pages/`

---

## 4. ข้อมูลไหลอย่างไร (ภาพรวม)

```
 data/levels.ts, set-02.json          (ข้อมูลด่าน: แผนที่ + โค้ด Python + จุดเริ่ม)
            │
            ▼
 data/level-sets.ts  ──► pages/index.vue (เกม)        pages/review.vue (คลังโจทย์)
                              │                               │
        ┌─────────────────────┼───────────────────┐           │
        ▼                     ▼                   ▼           ▼
 useProgramParser      programRunner        LevelBoard / LevelCode  (วาดผล)
 โค้ด → AST            รัน AST ทีละก้าว      ใช้ board.css
                       (ถามสีช่องจากเกม)
```

- **ข้อความโค้ดในข้อมูลด่านคือความจริงหนึ่งเดียว** เก็บเป็นรูปแบบ Python เสมอ
  ถ้าผู้เล่นเลือก JavaScript จะแปลงเพื่อ *แสดงผล* เท่านั้น ตอนเล่นจริงยังรันจาก Python
- **ตัวรันมีตัวเดียว** (`programRunner.ts`) เกมใช้รันทีละก้าวตามที่ผู้เล่นกด
  หน้า review ใช้รันรวดเดียวจนจบเพื่อพิมพ์เฉลย ทั้งสองที่จึงไม่มีทางได้ผลต่างกัน

---

## 5. อธิบายรายไฟล์ แบ่งตามชั้น (layer)

### ชั้นที่ 1: ข้อมูลและชนิดข้อมูล

**`types/debug-game.ts`**: นิยามรูปร่างข้อมูลที่ทุกไฟล์ใช้ร่วมกัน ควรอ่านไฟล์นี้ก่อนไฟล์อื่น
- `Node` (`MoveNode`, `IfNode`, `RepeatNode`, `WhileNode`, `CallNode`) คือ "ต้นไม้คำสั่ง" หลัง parse
- `Program = { main, functions }` คือโปรแกรมทั้งก้อน (คำสั่งหลัก + ฟังก์ชันที่ `def` ไว้)
- `Frame` คือกล่องจำว่าตอนนี้รันถึงบรรทัดไหนของบล็อกไหน (ใช้ใน interpreter)
- `Mode` (`campaign`, `timer`, `ranking`, `dead`) และ `GameStatus` (`ready`, `playing`, `success`, `failed`, …)
- `Score` คือข้อมูลคะแนนที่บันทึกลง Ranking
- `colorMeta` คือตัวอักษรช่อง → ชื่อ class สี (`b` → `cyan`, `k` → `black`, …)

**`data/levels.ts`, `data/set-02.json`**: ด่านแต่ละด่านหน้าตาแบบนี้ (Set A ด่าน 4 ของจริง):

```json
{
  "id": 4,
  "rows": 3, "cols": 7,
  "map": [["g","g","g","g","g","p","g"],
          ["g","p","p","p","p","p","g"],
          ["g","p","g","g","g","g","g"]],
  "start": [2, 1],
  "code": "up()\nrepeat(3):\n  right()\nup()",
  "concept": "Sequence and repeat loops",
  "learningObjective": "อ่านคำสั่งทีละบรรทัด ..."
}
```
เฉลย: `↑ →×3 ↑` (Codi เริ่มที่แถว 2 คอลัมน์ 1 ขึ้น 1, ขวา 3, ขึ้น 1)
- `map[row][col]` คือตัวอักษรช่อง (`n` พื้นธรรมดา, `b` ice, `y` sand, `g` green, `p` pink, `o` orange, `v` gem, `k` rock)
- `start` คือ `[row, col]` จุดเริ่มของ Codi
- เดินตกขอบจะ **ทะลุไปโผล่อีกฝั่ง** (wrap)

**`data/level-sets.ts`**: รวม Set A กับ Set B เป็นรายการ `levelSets` (ชื่อชุดที่โชว์ในเกมแก้ที่นี่)

**`data/assets.ts`**: รายการ asset (รูป Codi, ช่อง, ไอคอน, เสียง) พร้อมสเปก ใช้แสดงในหน้า `/elements`

### ชั้นที่ 2: ตรรกะล้วน (ไม่พึ่ง Vue หยิบไปใช้ที่อื่นได้)

**`composables/useProgramParser.ts`**: แปลงข้อความโค้ด Python เป็น `Program`
- อ่านทีละบรรทัด ใช้ **จำนวนช่องว่างหน้าบรรทัด (indent)** บอกว่าบรรทัดไหนอยู่ในบล็อกไหน
- รองรับ `up/down/left/right()`, `repeat(n):`, `if/elif/else`, `while`, `not`, `def name():` และการเรียกฟังก์ชัน
- ⚠️ ชื่อขึ้นต้นด้วย `use` เหมือน Vue composable แต่ข้างในไม่ได้ใช้ Vue เลย เรียกจากที่ไหนก็ได้

**`utils/programRunner.ts`** ★ หัวใจของเกม
- `createRunState(program)` สร้างสถานะเริ่มต้น (stack ของ `Frame`)
- `runUntilMove(state, readTile)` รันไปเรื่อยๆ จนเจอคำสั่งเดิน แล้วหยุดรอ คืนค่าได้ 3 แบบ:
  `{kind: "move"}` (รอผู้เล่นกด), `{kind: "done"}` (จบด่าน), `{kind: "error"}` (เช่น Loop error เมื่อรันเกิน 1000 ขั้น)
  `readTile` คือฟังก์ชันที่ผู้เรียกส่งมาให้ ใช้บอกว่าตอนนี้ยืนอยู่บนช่องสีอะไร ตัวรันจึงไม่ต้องรู้จักกระดานเอง
- `stepPosition(...)` ขยับ 1 ช่องพร้อมทะลุขอบ
- `solveLevel(level, program)` รันจนจบโดยถือว่าผู้เล่นกดถูกทุกครั้ง คืน **เฉลยลำดับปุ่ม** และเส้นทาง

**`utils/codeLanguage.ts`**: `pythonToJs()` แปลงโค้ดเพื่อแสดงแบบ JavaScript (`{}`, `!`, `else if`) และ `CODE_LANGUAGE_OPTIONS` (ข้อความตัวเลือกในหน้าตั้งค่า)

**`utils/levelGen/`**: ตัวสร้างด่านของ Dead Mode (`generateLevel(seed, ลำดับด่าน)`)
| ไฟล์ | หน้าที่ |
|---|---|
| `index.ts` | บันไดความยาก `LADDER`, รูปแบบระดับยาก `HARD_POOL`, ลองสร้างสูงสุด 40 ครั้ง |
| `templates/` | "แม่แบบโจทย์" แต่ละแบบ (sequence, loop) แต่ละแบบมีระดับ easy/normal/hard |
| `layout.ts` | รันโปรแกรมแล้ววางกระดานให้พอดีเส้นทาง |
| `validate.ts` | กฎตรวจด่าน (รันจบ, จำนวนก้าวพอดี, ไม่เดินทับ, ใช้ loop แล้วสั้นลงจริง ...) |
| `ast.ts` | ตัวช่วยสร้าง `Node` + พิมพ์ `Program` กลับเป็นโค้ด Python |
| `rng.ts` | ตัวสุ่มแบบมี seed: seed เดิมได้ด่านเดิมทุกครั้ง |

### ชั้นที่ 3: การแสดงผล (Vue)

**`composables/useBoardPresentation.ts`**
- `visibleTiles` คือรายการช่องทั้งหมดพร้อมชื่อ class สี
- `fitCellSize(...)` คำนวณขนาดช่องใหญ่ที่สุดที่ยังวางได้ทั้งกระดาน (ด่านเล็ก ช่องก็ใหญ่)
- `tileKindLabel()` คือชื่อช่องที่โชว์ในโค้ด (`ice`, `sand`, `green`, …) แก้ชื่อที่ `tileKinds`

**`composables/useCodePresentation.ts`**: แยกแต่ละบรรทัดเป็นชิ้น (keyword, ชื่อฟังก์ชัน, ตัวเลข, เงื่อนไขช่อง) ให้ `LevelCode` ใส่สี และคำนวณขนาดตัวอักษรตามความยาวโค้ด

**`components/LevelBoard.vue`, `LevelCode.vue`**: รับ `level` เป็น prop แล้ววาด ใช้ทั้งในเกมและหน้า review
- `LevelBoard` มี **slot** ให้หน้าที่เรียกใช้วางของบนกระดาน (เกมวาง Codi, review วางตัวเลขเส้นทาง/ธง)
- ของที่วางบนกระดานใช้ class `.actor` กับตัวแปร CSS `--x` / `--y` บอกตำแหน่งช่อง

**`assets/css/tailwind.css`**: ฟอนต์ LINE Seed Sans TH + ตัวแปร `--cv-*` (สี ขอบมน เงา) ตามแบรนด์ CodeVenture
**`assets/css/board.css`**: หน้าตาช่องทุกชนิด (`.tile-cyan` = ice ฯลฯ), ช่อง START, Codi และ animation ทั้งหมด, หน้าต่างโค้ด

### ชั้นที่ 4: หน้า (pages)

**`pages/index.vue`**: ตัวเกม ไฟล์ใหญ่ที่สุด แบ่งเป็น 3 ส่วน:
1. `<template>`: HUD, กระดาน, โค้ด, ปุ่มลูกศร, หน้าตั้งค่า (setup), หน้า Ranking
2. `<script>`: สถานะเกม (`ref`) และฟังก์ชันควบคุมเกม (ดูข้อ 6)
3. `<style scoped>`: layout ของหน้าเกม (ส่วนที่ใช้ร่วมกับหน้าอื่นย้ายไปไว้ `board.css` แล้ว)

**`pages/review.vue`**: วนทุกด่านของชุดที่เลือก รัน `solveLevel` เพื่อพิมพ์เฉลย และตรวจหาปัญหาอัตโนมัติ
**`pages/elements.vue`**: แสดง `data/assets.ts` เป็นการ์ด พร้อมรูปจริงและขนาดไฟล์จริง

---

## 6. วงจรการเล่น 1 ด่าน (ไล่ตามฟังก์ชันใน `pages/index.vue`)

```
startGame()          อ่านค่าจากหน้าตั้งค่า, รีเซ็ตคะแนน, (Dead Mode: สุ่ม seed + สร้างด่านแรก)
  └─ beginLevel()    parse โค้ด → createRunState, วาง Codi ที่ start
       └─ advanceToMove()   runUntilMove(...) จนเจอคำสั่งเดิน → เก็บไว้ใน expectedMove
            │
ผู้เล่นกดลูกศร → handleKeydown() → controlMove(dir)
            ├─ ถูก  → ขยับ Codi (stepPosition), combo +1 → advanceToMove() ต่อ
            │         └─ ถ้าโปรแกรมจบ → completeLevel() → แสดง receipt ที่ยืนยันแล้ว → ด่านถัดไป
            └─ ผิด  → failLevel()  → กระดานแตก
                      ├─ โหมดปกติ: เริ่มด่านเดิมใหม่
                      └─ Dead Mode: เสียหัวใจ 1 ดวง (หมด 5 ดวง → endDeadRun() → บันทึกคะแนน)
```

ฟังก์ชันอื่นที่ควรรู้: `beginTimer/stopTimer/timeUp` (โหมดจับเวลา), `saveScore` (บันทึกลง localStorage),
`utils/competition/scoring.ts` (คะแนนจากดาว ความยาก และเวลาจริง), `applyLevelFromQuery` (เปิด `/?set=set-02&level=12` แล้วเลือกด่านให้)

---

## 7. คำถามที่น้องมักถาม

- **ทำไมมีทั้ง `utils/` และ `composables/`?** ตั้งใจให้ `utils/` = ฟังก์ชันล้วน, `composables/` = ใช้ความสามารถของ Vue (`computed`)
  ยกเว้น `useProgramParser` ที่ชื่อชวนเข้าใจผิด (ข้อ 5)
- **ทำไมรูปอยู่ `app/assets/` ไม่ใช่ `public/`?** เว็บ deploy อยู่ใต้ `/debug-master/` ไฟล์ใน `assets/` ผ่าน Vite จะได้ path ที่ถูกต้องอัตโนมัติ
  ถ้าไว้ใน `public/` แล้วอ้างด้วย `/sprites/...` จะโหลดไม่ขึ้นบน GitHub Pages
- **ทำไมหน้า review/elements เลื่อนจอเองได้แต่หน้าเกมเลื่อนไม่ได้?** หน้าเกมล็อก `body` ไม่ให้ scroll (ต้องการเต็มจอพอดี)
  หน้าอื่นจึงทำกล่อง scroll ของตัวเองใน `DocShell`
- **แก้ด่านแล้วจะรู้ได้อย่างไรว่าเล่นจบได้?** เปิด `/review` การ์ดที่มีปัญหาจะมีขอบแดงพร้อมเหตุผล

---

## 8. คิดเรื่อง integration กับ platform อื่น

### 8.1 อะไรย้ายไปใช้ได้ทันที / อะไรผูกกับ Nuxt

| ย้ายได้ทันที (TypeScript ล้วน) | ผูกกับ Vue/Nuxt |
|---|---|
| `types/debug-game.ts` | `pages/*.vue`, `components/*.vue` |
| `composables/useProgramParser.ts` | `useBoardPresentation`, `useCodePresentation` (ใช้ `computed`) |
| `utils/programRunner.ts` | การ route (`/?set=&level=`), `useHead`, `NuxtLink` |
| `utils/codeLanguage.ts` | |
| `utils/levelGen/*` | |
| `data/*` (ข้อมูลด่าน) | |
| `assets/css/board.css` (CSS ธรรมดา ใช้กับ HTML อะไรก็ได้ ถ้าใส่ class ตรง) | |

กล่าวคือ **กติกาเกม ข้อมูลด่าน และตัวสร้างด่านไม่ขึ้นกับ framework** platform ที่เขียนด้วย TypeScript (เช่น Vite + vanilla TS) import ไปใช้ได้เลย

### 8.2 จุดเชื่อมที่มีตอนนี้

| เรื่อง | ตอนนี้เป็นอย่างไร | ถ้าจะต่อกับ platform |
|---|---|---|
| ผู้เล่น | พิมพ์ชื่อเองในหน้าตั้งค่า ไม่มีระบบ login | รับ id/ชื่อจาก platform |
| คะแนน | `CompetitionSessionRepository` เก็บ canonical sessions; Live ยืนยันที่ Worker | ส่งไป API ของ platform แทน (หรือส่งทั้งสองที่) |
| ด่าน | import ไฟล์ใน `data/` ตอน build | โหลดจาก API ได้ ถ้ารูปแบบตรงกับ `RawLevel` |
| เปิดด่านเฉพาะ | `/?set=set-02&level=12` | platform ลิงก์/ฝังด้วย URL นี้ได้เลย |
| เหตุการณ์ในเกม | ไม่มีส่งออก | ควรเพิ่ม event: เริ่มด่าน, ผ่านด่าน, กดผิด, จบเกม (เพื่อ analytics/ความก้าวหน้า) |

### 8.3 ทางเลือกในการต่อ (เรียงจากง่ายไปลึก)

1. **ฝังทั้งเกม (iframe / ลิงก์)**: เร็วที่สุด เพิ่ม `window.parent.postMessage(...)` ตอนผ่านด่าน/จบเกม
   ให้ platform ฟังแล้วบันทึกเอง ข้อเสียคือหน้าตาและ login แยกกัน
2. **เกมคุยกับ API ของ platform**: ยังเป็นเว็บแยก แต่ `saveScore` และการโหลดด่านเรียก API
   ต้องตกลงเรื่องยืนยันตัวตน (token) และ CORS
3. **แยก "แกนเกม" เป็นแพ็กเกจ** (parser + runner + levelGen + types + data + board.css) แล้วให้ platform เขียน UI เอง
   ได้ประสบการณ์กลมกลืนที่สุด แต่ต้องดูแลสองที่ให้ใช้แกนเวอร์ชันเดียวกัน

### 8.4 เตรียมโค้ดก่อน integration (แนะนำ)

- **แยกตรรกะการเล่นออกจาก `pages/index.vue`** (ตอนนี้ ~1,700 บรรทัด ปนทั้ง UI และกติกา) เป็นเช่น `useGameSession()`
  แล้วกำหนดจุดเสียบที่ชัดเจน เช่น
  ```ts
  type GameHost = {
    player(): { id: string; name: string };
    saveScore(score: Score): Promise<void>;
    onEvent(event: { type: "level-start" | "level-clear" | "mistake" | "game-over"; level: number; mode: Mode }): void;
  };
  ```
  เวอร์ชันเว็บแยกใช้ host ที่เก็บ localStorage ส่วน platform เขียน host ของตัวเอง โดยไม่ต้องแก้ตัวเกม
- เปลี่ยนชื่อ `useProgramParser` → `parseProgram` ใน `utils/` ให้ตรงกับสิ่งที่มันเป็น
- ตกลง **รูปแบบข้อมูลด่าน** (`RawLevel`) และ **รูปแบบคะแนน** (`Score`) เป็นสัญญากลาง (contract) ก่อนเริ่มเขียนฝั่ง platform

---

## 9. ก่อนส่งงาน (checklist)

- [ ] `pnpm dev` แล้วลองเล่นอย่างน้อย 1 ด่าน + กดผิด 1 ครั้ง
- [ ] เปิด `/review` ต้องไม่มีการ์ดขอบแดง (ถ้าแก้ข้อมูลด่าน)
- [ ] แก้ `utils/levelGen` → รัน `pnpm dlx jiti scripts/check-level-gen.ts 300 30` ต้องขึ้น `OK`
- [ ] `NUXT_APP_BASE_URL=/debug-master/ pnpm generate` ต้อง build ผ่าน (แบบเดียวกับตอน deploy)


## Competition scoring / Live (2026-10-18)

- `types/competition.ts`: frozen config, canonical session/checkpoint/level ledger and receipts.
- `utils/competition/scoring.ts`, `session.ts`: pure formula, mistakes-to-stars, BEST/LATEST aggregation and finalized Score projection. Fractional seconds; one rounding per completed level. Defaults: difficulty 1, BEST; A/B/C names do not imply numeric difficulty. Stars: 0 mistakes → 3, 1 → 2, 2+ → 1; incomplete → zero points.
- `storage/CompetitionSessionRepository.ts`: browser's sole persisted scoring store. `useCompetitionSession` serializes checkpoints; ordinary resume reconstructs interpreter cursor without clearing first-ready time/mistakes. Browser day/board selection remains Asia/Bangkok. Practice is unscored; Dead retains five hearts and seeded generation.
- `utils/live/protocol.ts`: versioned gameplay evidence and private canonical scoring snapshots; client totals are unsupported.
- `utils/live/outbox.ts`: immutable write-before-send queue, scoped by room/round/player/session, accepted-prefix trimming. `utils/live/session.ts#createLiveReplay`: private reconciliation, ordered replay and input gating. `socket.ts` reconnects/hello/heartbeat; gameplay never enters its replaceable queue.
- `composables/useLiveRoom.ts`: private scoring/session/syncStatus plus sendGameplay. On lost acknowledgement, hello requests a new private checkpoint before replay. Blocked storage/reload states stop new scored inputs.
- `pages/index.vue`: ordinary controller and Live authority stay separate. Live rebuilds accepted cursor and displays only server totals/completions/receipt deltas. Public Live views preserve the server's current-round ranking. Room endAt (including End Early) governs deadline/results; canonical session stays active during delivery grace.
- `live-server/src/scoring.ts`: actual parser/interpreter validation, durable sequence/fingerprints (newest 64), compacted Live operation history. Old accepted duplicates return canonical sequence without receipt. `live-room.ts` persists candidates before acknowledgement/publication.
- Run app tests, Worker tests/typecheck, static generation and local smoke before a coordinated protocol rollout. No external API integration or previous-formula score migration is part of this implementation.
