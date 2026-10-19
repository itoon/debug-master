# Debug Master: ตะลุยด่าน 60 ด่าน

ไฟล์ `level1.json`–`level60.json` เป็นข้อมูล Set 01 ที่โหมดตะลุยด่านใช้อยู่จริง (`home-config.ts` ชี้ `set-01`) โดยหนึ่งไฟล์แทนหนึ่งด่าน ลำดับในชื่อไฟล์และ `content.gameConfig.meta.order` ตรงกับลำดับเล่นเดิม

ข้อมูลจาก `RawLevel` ถูกเก็บดังนี้:

| ต้นทาง | JSON |
| --- | --- |
| `id` | `content.gameConfig.meta.sourceId` |
| `title` | `content.title.en` |
| `rows`, `cols` | `content.gameConfig.tileMapSize.row`, `.col` |
| `start` | `content.gameConfig.defaultPlayerPosition` |
| `code` | `content.gameConfig.defaultCode` |
| `map` | `content.gameConfig.debugMap` |
| `concept` | `content.gameConfig.meta.legacyConcept` และ BOF concept ใกล้เคียงใน `concepts` |
| `learningObjective` | `content.description.th` และ `content.gameConfig.meta.learningObjective` |
| `image` | `content.gameConfig.meta.sourceImage` |

`defaultDirection: south` ตรงกับทิศเริ่มต้นของ Codi ใน Debug Master ข้อมูลด่านเหล่านี้ยังไม่ได้เปลี่ยนแหล่งโหลดของเกม และไม่ได้อัปโหลดไป BOF

**ก่อนนำเข้าผ่าน BOF:** BOF Page ปัจจุบันยังไม่มี `DEBUG_CODING`, `debugMap`, `meta` และใช้ `content.title`/`description` เป็น string จึงต้องเพิ่มการรองรับหรือทำ import adapter ก่อน ไฟล์ชุดนี้เป็น BOF-compatible subset สำหรับเตรียมข้อมูล ไม่ใช่ Page payload ที่อัปโหลดเข้าฟอร์มปัจจุบันได้ทันที

สร้างไฟล์ซ้ำจากต้นทางด้วย `node scripts/export-practice-levels.mjs` และตรวจว่าไฟล์ตรงกับต้นทางด้วย `node scripts/export-practice-levels.mjs --check`
