import type { LessonSpec } from "./paint";

// New lessons for the time-challenge groups, written after studying Set 01.
// Each group only uses the concepts of its own Set 01 range:
//   Beginner     (Set 01 #1–20):  sequence, repeat, nested repeat, wrap, if
//   Intermediate (Set 01 #21–40): + else, elif, while, nested while, not
//   Pro          (Set 01 #41–60): + def, functions calling functions, recursion
// Ids: 101–130 Beginner, 201–230 Intermediate, 301–330 Pro.
// Where each lesson sits in its group is set in app/data/challenge-groups.ts.
//
// `tiles` lists the colour of each cell an if / while reads, in the order it
// is first read ("." = plain path tile). Run `bun scripts/challenge-levels/build.ts`
// after editing; it re-checks every lesson with the game's interpreter.

const SEQ = "Sequence and repeat loops";
const COND = "Conditionals";
const WHILE = "While loops and negation";
const FUNC = "Functions and decomposition";
const REC = "Recursion and advanced control flow";

const beginner: LessonSpec[] = [
  // Sequence
  { id: 101, group: "beginner", concept: SEQ, objective: "อ่านคำสั่งทีละบรรทัด เลี้ยวตามลำดับที่เขียน", code: "down()\nright()\nright()\nup()" },
  { id: 102, group: "beginner", concept: SEQ, objective: "นับช่องให้ครบก่อนเปลี่ยนทิศ", code: "left()\nleft()\ndown()\ndown()\nright()" },
  { id: 103, group: "beginner", concept: SEQ, objective: "เดินสลับทิศเป็นขั้นบันได", code: "up()\nright()\nup()\nright()\nup()\nright()" },
  { id: 104, group: "beginner", concept: SEQ, objective: "เดินกลับทางเดิมได้ ช่องเดิมเหยียบซ้ำได้", code: "right()\nright()\nleft()\ndown()\ndown()\nleft()" },
  // Repeat one move
  { id: 105, group: "beginner", concept: SEQ, objective: "repeat(n) คือทำคำสั่งข้างในซ้ำ n ครั้ง", code: "repeat(4):\n  down()" },
  { id: 106, group: "beginner", concept: SEQ, objective: "คำสั่งก่อนและหลัง repeat ทำแค่ครั้งเดียว", code: "left()\nrepeat(3):\n  up()\nleft()" },
  { id: 107, group: "beginner", concept: SEQ, objective: "repeat หลายก้อนต่อกัน นับแยกทีละก้อน", code: "repeat(2):\n  right()\nrepeat(3):\n  down()\nrepeat(2):\n  left()" },
  // Repeat a pattern
  { id: 108, group: "beginner", concept: SEQ, objective: "ข้างใน repeat มีหลายคำสั่ง ทำครบทุกบรรทัดก่อนเริ่มรอบใหม่", code: "repeat(3):\n  right()\n  down()" },
  { id: 109, group: "beginner", concept: SEQ, objective: "รูปแบบในรอบเดียวยาวขึ้น นับรอบให้ครบ", code: "repeat(3):\n  up()\n  up()\n  right()" },
  { id: 110, group: "beginner", concept: SEQ, objective: "คำสั่งเดี่ยวนำหน้า แล้วตามด้วยรูปแบบที่ทำซ้ำ", code: "down()\nrepeat(3):\n  left()\n  up()\n  left()" },
  // Wrap around the edge
  { id: 111, group: "beginner", concept: SEQ, objective: "เดินตกขอบแล้วไปโผล่อีกฝั่ง นับต่อให้ถูก", code: "repeat(4):\n  right()", board: [1, 5, 0, 3] },
  { id: 112, group: "beginner", concept: SEQ, objective: "repeat มากกว่าความสูงกระดาน ต้องทะลุขอบแล้ววนกลับมา", code: "repeat(5):\n  down()\nleft()", board: [4, 3, 2, 1] },
  { id: 113, group: "beginner", concept: SEQ, objective: "ทะลุขอบได้ทั้งแนวนอนและแนวตั้ง", code: "repeat(3):\n  left()\n  up()", board: [3, 4, 1, 1] },
  // Nested repeat
  { id: 114, group: "beginner", concept: SEQ, objective: "repeat ซ้อนกัน: รอบในทำจนครบก่อน แล้วค่อยนับรอบนอก", code: "repeat(2):\n  repeat(3):\n    right()\n  down()" },
  { id: 115, group: "beginner", concept: SEQ, objective: "repeat ซ้อน: นับรอบในคูณรอบนอก", code: "repeat(3):\n  repeat(2):\n    up()\n  left()" },
  { id: 116, group: "beginner", concept: SEQ, objective: "ในรอบนอกมี repeat สองก้อน ทำทีละก้อน", code: "repeat(2):\n  repeat(2):\n    right()\n  repeat(2):\n    down()" },
  { id: 117, group: "beginner", concept: SEQ, objective: "ไปแล้วกลับในรอบเดียว แล้วขยับต่อ", code: "repeat(2):\n  repeat(3):\n    down()\n  repeat(3):\n    up()\n  right()" },
  // if (no else)
  { id: 118, group: "beginner", concept: COND, objective: "if สีช่อง: ทำคำสั่งข้างในเฉพาะเมื่อยืนอยู่บนสีนั้น", code: "right()\nif o:\n  down()\nright()", tiles: "o" },
  { id: 119, group: "beginner", concept: COND, objective: "ถ้าสีไม่ตรง ข้ามบล็อก if ไปเลย", code: "down()\nif g:\n  right()\ndown()\nif g:\n  left()\ndown()", tiles: "g." },
  { id: 120, group: "beginner", concept: COND, objective: "if แต่ละตัวอ่านช่องที่ยืนอยู่ตอนนั้น ไม่ใช่ช่องเริ่ม", code: "up()\nif p:\n  up()\nif p:\n  left()\nleft()", tiles: "p." },
  // repeat + if
  { id: 121, group: "beginner", concept: COND, objective: "if อยู่ใน repeat: ทุกรอบต้องดูสีช่องใหม่", code: "repeat(4):\n  right()\n  if b:\n    up()", tiles: "b..b" },
  { id: 122, group: "beginner", concept: COND, objective: "if อยู่บรรทัดแรกของรอบ อ่านสีก่อนเดิน", code: "repeat(5):\n  if y:\n    left()\n  down()", tiles: ".y.y." },
  { id: 123, group: "beginner", concept: COND, objective: "ใน if มีสองคำสั่ง ทำครบทั้งสองเมื่อเงื่อนไขจริง", code: "repeat(3):\n  down()\n  if o:\n    right()\n    right()", tiles: "o.o" },
  { id: 124, group: "beginner", concept: COND, objective: "if สองตัวในรอบเดียว ตัวที่สองอ่านช่องหลังจากตัวแรกพาเดินแล้ว", code: "repeat(3):\n  right()\n  if p:\n    down()\n  if g:\n    up()", tiles: "p.g." },
  // if traps
  { id: 125, group: "beginner", concept: COND, objective: "repeat มากแค่ไหนก็ไม่เดิน ถ้า if ไม่เคยจริง", code: "repeat(10):\n  if v:\n    down()\nright()\nup()", tiles: "." },
  { id: 126, group: "beginner", concept: COND, objective: "เดินตามสีจนหลุดสี แล้วรอบที่เหลือไม่ทำอะไร", code: "repeat(6):\n  if o:\n    right()\nup()", tiles: "oo." },
  // repeat inside if
  { id: 127, group: "beginner", concept: COND, objective: "repeat อยู่ใน if: ทำซ้ำเฉพาะเมื่อสีตรง", code: "repeat(3):\n  if b:\n    repeat(2):\n      right()\n  down()", tiles: "b.b" },
  { id: 128, group: "beginner", concept: COND, objective: "อ่านสีหลังเดินซ้าย แล้วค่อยตัดสินว่าจะขึ้นสองช่องไหม", code: "repeat(4):\n  left()\n  if y:\n    repeat(2):\n      up()", tiles: ".y.y" },
  // if + wrap
  { id: 129, group: "beginner", concept: COND, objective: "ทะลุขอบแล้วยังต้องอ่านสีช่องที่โผล่", code: "repeat(5):\n  right()\n  if p:\n    down()", tiles: ".p.p.", board: [3, 4, 0, 1] },
  { id: 130, group: "beginner", concept: COND, objective: "รวมทุกอย่าง: repeat, if และนับช่องให้ครบ", code: "repeat(5):\n  if g:\n    down()\n    down()\n  right()", tiles: "g..g." },
];

const intermediate: LessonSpec[] = [
  // if / else
  { id: 201, group: "intermediate", concept: COND, objective: "if / else: ต้องเลือกทางใดทางหนึ่งเสมอ", code: "right()\nif o:\n  down()\nelse:\n  up()\nright()", tiles: "o" },
  { id: 202, group: "intermediate", concept: COND, objective: "สีไม่ตรง ไปทำฝั่ง else", code: "up()\nif g:\n  left()\nelse:\n  right()\nup()", tiles: "." },
  { id: 203, group: "intermediate", concept: COND, objective: "if / else สองชุด อ่านสีใหม่ทุกครั้ง", code: "down()\nif b:\n  right()\nelse:\n  left()\ndown()\nif b:\n  right()\nelse:\n  left()", tiles: "b." },
  { id: 204, group: "intermediate", concept: COND, objective: "ในแต่ละฝั่งของ if / else มี repeat ได้", code: "if p:\n  repeat(2):\n    right()\nelse:\n  repeat(2):\n    left()\nup()\nif p:\n  up()\nelse:\n  down()", tiles: ".p" },
  // elif
  { id: 205, group: "intermediate", concept: COND, objective: "elif: ตรวจทีละเงื่อนไขจากบนลงล่าง ทำแค่อันแรกที่จริง", code: "left()\nif y:\n  up()\nelif o:\n  down()\nelse:\n  left()\nleft()", tiles: "o" },
  { id: 206, group: "intermediate", concept: COND, objective: "ไม่ตรงทั้ง if และ elif ไปทำ else", code: "down()\nif g:\n  right()\nelif p:\n  left()\nelse:\n  down()\ndown()", tiles: "." },
  { id: 207, group: "intermediate", concept: COND, objective: "elif สองชุดต่อกัน ชุดหลังอ่านช่องใหม่", code: "right()\nif b:\n  up()\nelif y:\n  down()\nelse:\n  right()\nif b:\n  up()\nelif y:\n  down()\nelse:\n  right()", tiles: "y." },
  // repeat + if / else / elif
  { id: 208, group: "intermediate", concept: COND, objective: "if / else ใน repeat: ทุกรอบเดินแน่นอนหนึ่งก้าว", code: "repeat(6):\n  if o:\n    up()\n  else:\n    right()", tiles: ".o.o.o" },
  { id: 209, group: "intermediate", concept: COND, objective: "ทางเลือกแล้วตามด้วยก้าวบังคับในรอบเดียว", code: "repeat(5):\n  if g:\n    down()\n  else:\n    left()\n  left()", tiles: "g..g." },
  { id: 210, group: "intermediate", concept: COND, objective: "elif ใน repeat: สีบอกทิศ เดินเป็นงู", code: "repeat(8):\n  if b:\n    right()\n  elif p:\n    down()\n  else:\n    left()", tiles: "bbp..pbb" },
  { id: 211, group: "intermediate", concept: COND, objective: "ฝั่ง if มี repeat ฝั่ง else เดินก้าวเดียว", code: "repeat(4):\n  if y:\n    repeat(3):\n      down()\n  else:\n    right()", tiles: "y.y." },
  // while
  { id: 212, group: "intermediate", concept: WHILE, objective: "while: ทำซ้ำไปเรื่อยๆ ตราบที่ยังยืนบนสีนั้น", code: "while p:\n  down()\nright()", tiles: "pppp." },
  { id: 213, group: "intermediate", concept: WHILE, objective: "while สองก้อน แต่ละก้อนหยุดเมื่อหลุดสี", code: "while b:\n  left()\nup()\nwhile b:\n  left()", tiles: "bbb.bb." },
  { id: 214, group: "intermediate", concept: WHILE, objective: "ใน while มีหลายคำสั่ง เช็กสีเฉพาะตอนจบรอบ", code: "while g:\n  right()\n  up()", tiles: "ggg." },
  { id: 215, group: "intermediate", concept: WHILE, objective: "while อยู่ใน repeat: แต่ละรอบเดินไม่เท่ากัน", code: "repeat(2):\n  while y:\n    down()\n  right()", tiles: "yy.yyy." },
  // while + if, nested while
  { id: 216, group: "intermediate", concept: WHILE, objective: "if อยู่ใน while: อ่านสีสองแบบในช่องเดียวกัน", code: "while o:\n  right()\n  if v:\n    down()", tiles: "ovoovo." },
  { id: 217, group: "intermediate", concept: WHILE, objective: "while ซ้อน while: วงในเดินจนหลุดสีก่อน", code: "while b:\n  up()\n  while p:\n    left()", tiles: "bppbpb." },
  { id: 218, group: "intermediate", concept: WHILE, objective: "repeat ครอบ while สองตัว สลับทิศตามสี", code: "repeat(3):\n  while g:\n    right()\n  while y:\n    down()", tiles: "ggyygyg." },
  { id: 219, group: "intermediate", concept: WHILE, objective: "repeat อยู่ใน while: ทำครบ repeat ก่อนเช็กสี", code: "while v:\n  repeat(2):\n    left()\n  down()", tiles: "vvv." },
  // not (if)
  { id: 220, group: "intermediate", concept: WHILE, objective: "if not: ทำเมื่อสี *ไม่* ตรง", code: "right()\nif not g:\n  down()\nright()", tiles: "." },
  { id: 221, group: "intermediate", concept: WHILE, objective: "not กลับความหมาย: ยืนบนสีนั้นจะข้าม", code: "down()\nif not b:\n  left()\ndown()\nif not b:\n  left()", tiles: "b." },
  { id: 222, group: "intermediate", concept: WHILE, objective: "if not ใน repeat", code: "repeat(4):\n  if not o:\n    up()\n  right()", tiles: "o.o." },
  { id: 223, group: "intermediate", concept: WHILE, objective: "if not กับ else: ระวังฝั่งไหนทำเมื่อไร", code: "repeat(5):\n  if not p:\n    left()\n  else:\n    down()", tiles: "..p.p" },
  { id: 224, group: "intermediate", concept: WHILE, objective: "repeat เยอะแต่เดินถึงสีแล้วติด ต้องรู้ว่าหยุดตรงไหน", code: "repeat(12):\n  if not y:\n    right()\nup()", tiles: "...y" },
  // while not
  { id: 225, group: "intermediate", concept: WHILE, objective: "while not: เดินไปเรื่อยๆ จนกว่าจะเจอสีนั้น", code: "while not v:\n  down()\nleft()", tiles: "...v" },
  { id: 226, group: "intermediate", concept: WHILE, objective: "while not กับหลายคำสั่งในรอบ", code: "while not o:\n  right()\n  down()", tiles: "...o" },
  { id: 227, group: "intermediate", concept: WHILE, objective: "while not สองก้อน หยุดที่สีเป้าหมายทั้งสองครั้ง", code: "while not g:\n  left()\nup()\nwhile not g:\n  right()", tiles: "..g..g" },
  { id: 228, group: "intermediate", concept: WHILE, objective: "while not ครอบ if: หยุดเมื่อเจอเป้าหมาย ระหว่างทางเลี้ยวตามสี", code: "while not b:\n  up()\n  if p:\n    right()", tiles: ".p..pb" },
  { id: 229, group: "intermediate", concept: WHILE, objective: "repeat ครอบ while not: เริ่มรอบใหม่ทั้งที่อาจยืนบนเป้าหมายอยู่แล้ว", code: "repeat(3):\n  while not y:\n    right()\n  down()", tiles: "..y.yy" },
  { id: 230, group: "intermediate", concept: WHILE, objective: "while not + elif: สีบอกทาง จนกว่าจะเจอคริสตัล", code: "while not v:\n  if o:\n    up()\n  elif b:\n    right()\n  else:\n    down()", tiles: "bb..bov" },
];

const pro: LessonSpec[] = [
  // Advanced control flow (no functions yet)
  { id: 301, group: "pro", concept: WHILE, objective: "repeat ซ้อนกับ if not / else: นับรอบและอ่านสีพร้อมกัน", code: "repeat(3):\n  repeat(3):\n    if not g:\n      right()\n    else:\n      down()\n  down()", tiles: "..g.g.g.." },
  { id: 302, group: "pro", concept: WHILE, objective: "while not + elif สามทาง เดินตามป้ายสีจนเจอเป้าหมาย", code: "while not v:\n  if p:\n    right()\n  elif y:\n    down()\n  else:\n    left()", tiles: "ppy..yppv" },
  { id: 303, group: "pro", concept: WHILE, objective: "while แล้ว if not ในรอบเดียว", code: "repeat(4):\n  while o:\n    right()\n  if not o:\n    down()", tiles: "oo.o.oo.." },
  { id: 304, group: "pro", concept: WHILE, objective: "while ซ้อนใน while not", code: "while not b:\n  while g:\n    up()\n  right()", tiles: "gg.g.gg.b" },
  { id: 305, group: "pro", concept: WHILE, objective: "elif แบบมี not", code: "repeat(5):\n  left()\n  if y:\n    up()\n  elif not p:\n    down()", tiles: "y.pyp" },
  { id: 306, group: "pro", concept: WHILE, objective: "while not อยู่ใน repeat ซ้อน repeat", code: "repeat(2):\n  repeat(2):\n    while not k:\n      right()\n    down()\n  left()", tiles: ".k.k.k.k" },
  // Functions
  { id: 307, group: "pro", concept: FUNC, objective: "def ตั้งชื่อชุดคำสั่ง เรียกกี่ครั้งก็ทำซ้ำเท่านั้น", code: "hop()\nhop()\nhop()\n\ndef hop():\n  up()\n  right()" },
  { id: 308, group: "pro", concept: FUNC, objective: "คำสั่งปกติกับการเรียกฟังก์ชันสลับกัน", code: "down()\nstep()\nstep()\n\ndef step():\n  right()\n  down()" },
  { id: 309, group: "pro", concept: FUNC, objective: "def อยู่บนสุดก็ยังไม่ทำ จนกว่าจะถูกเรียก", code: "def corner():\n  left()\n  left()\n  up()\n\ncorner()\nright()\ncorner()" },
  { id: 310, group: "pro", concept: FUNC, objective: "สองฟังก์ชัน ต้องจำว่าชื่อไหนทำอะไร", code: "zig()\nzag()\nzig()\n\ndef zig():\n  right()\n  up()\n\ndef zag():\n  right()\n  down()" },
  { id: 311, group: "pro", concept: FUNC, objective: "เรียกฟังก์ชันใน repeat และมี repeat ในฟังก์ชัน", code: "repeat(3):\n  stair()\n\ndef stair():\n  repeat(2):\n    right()\n  down()" },
  { id: 312, group: "pro", concept: FUNC, objective: "ฟังก์ชันพากลับจุดเดิม แล้วไปทำซ้ำอีกที่", code: "box()\nright()\nright()\nbox()\n\ndef box():\n  right()\n  down()\n  left()\n  up()" },
  { id: 313, group: "pro", concept: FUNC, objective: "ฟังก์ชันเรียกฟังก์ชัน: ไล่ทีละชั้นแล้วกลับมาต่อ", code: "def two():\n  left()\n  left()\n\ndef four():\n  two()\n  two()\n\nfour()\nup()\ntwo()" },
  { id: 314, group: "pro", concept: FUNC, objective: "ฟังก์ชันซ้อนสองชั้น ทำซ้ำสามครั้ง", code: "walk()\nwalk()\nwalk()\n\ndef bounce():\n  up()\n  down()\n\ndef walk():\n  right()\n  bounce()" },
  { id: 315, group: "pro", concept: FUNC, objective: "ใน def มี if: ผลแต่ละครั้งที่เรียกอาจต่างกัน", code: "check()\ncheck()\ncheck()\ncheck()\n\ndef check():\n  right()\n  if o:\n    down()", tiles: ".o.o" },
  { id: 316, group: "pro", concept: FUNC, objective: "ฟังก์ชันที่มี if / else ถูกเรียกใน repeat", code: "repeat(5):\n  turn()\n\ndef turn():\n  if b:\n    up()\n  else:\n    right()", tiles: ".b.b." },
  { id: 317, group: "pro", concept: FUNC, objective: "while อยู่ในฟังก์ชัน: ไถลจนหลุดสี", code: "slide()\nright()\nslide()\n\ndef slide():\n  while y:\n    down()", tiles: "yy.yyy." },
  { id: 318, group: "pro", concept: FUNC, objective: "เรียกฟังก์ชันใน while not จนเจอเป้าหมาย", code: "def zig():\n  right()\n  down()\n\nwhile not g:\n  zig()", tiles: "...g" },
  // Recursion
  { id: 319, group: "pro", concept: REC, objective: "ฟังก์ชันเรียกตัวเอง: ทำซ้ำจนเงื่อนไขหยุด", code: "go()\n\ndef go():\n  right()\n  if not p:\n    go()", tiles: "...p" },
  { id: 320, group: "pro", concept: REC, objective: "recursion ขึ้นบันได แล้วกลับมาทำคำสั่งหลังเรียก", code: "climb()\nright()\n\ndef climb():\n  up()\n  if g:\n    climb()", tiles: "ggg." },
  { id: 321, group: "pro", concept: REC, objective: "เรียกตัวเองใน else และอีกฟังก์ชันใน if", code: "def road():\n  right()\n  right()\n  if y:\n    turn()\n  else:\n    road()\n\ndef turn():\n  down()\n  down()\n\nroad()", tiles: ".y" },
  { id: 322, group: "pro", concept: REC, objective: "recursion เป็นบันไดลง หยุดที่สีส้ม", code: "stairs()\nleft()\n\ndef stairs():\n  right()\n  down()\n  if not o:\n    stairs()", tiles: "..o" },
  { id: 323, group: "pro", concept: REC, objective: "คำสั่งหลังเรียกตัวเองทำตอนย้อนกลับ (call stack)", code: "dive()\n\ndef dive():\n  down()\n  if b:\n    dive()\n  right()", tiles: "bb." },
  { id: 324, group: "pro", concept: REC, objective: "ย้อนกลับครบทุกชั้น จำนวนก้าวตอนกลับเท่ากับตอนไป", code: "back()\n\ndef back():\n  left()\n  if not v:\n    back()\n  up()", tiles: "..v" },
  { id: 325, group: "pro", concept: REC, objective: "สองฟังก์ชันเรียกกันไปมา", code: "a()\n\ndef a():\n  right()\n  if p:\n    b()\n\ndef b():\n  down()\n  if p:\n    a()", tiles: "ppp." },
  { id: 326, group: "pro", concept: REC, objective: "while อยู่ในฟังก์ชันที่เรียกตัวเอง", code: "climb()\n\ndef climb():\n  while g:\n    up()\n  right()\n  if not k:\n    climb()", tiles: "gg.g.k" },
  { id: 327, group: "pro", concept: REC, objective: "repeat ในฟังก์ชันเรียกตัวเอง ทำเป็นคลื่น", code: "wave()\n\ndef wave():\n  repeat(2):\n    right()\n  up()\n  if y:\n    wave()", tiles: "yy." },
  { id: 328, group: "pro", concept: REC, objective: "เลือกทางด้วย if / elif แล้วเรียกตัวเองต่อ", code: "choice()\n\ndef choice():\n  if o:\n    left()\n    choice()\n  elif b:\n    down()\n    choice()", tiles: "oobbo." },
  { id: 329, group: "pro", concept: REC, objective: "คำสั่งหลังเรียกตัวเองอยู่ใน if: ย้อนกลับเฉพาะชั้นที่เรียกต่อ", code: "tower()\nright()\n\ndef tower():\n  up()\n  if not y:\n    tower()\n    left()", tiles: "..y" },
  { id: 330, group: "pro", concept: REC, objective: "ด่านปิด: while, repeat, def และ recursion รวมกัน", code: "def fall():\n  while not p:\n    down()\n\ndef eye():\n  repeat(2):\n    right()\n    if k:\n      fall()\n\nwhile not v:\n  up()\neye()\nleft()\neye()", tiles: "..v.k.pk.p" },
];

export const LESSON_SPECS: LessonSpec[] = [...beginner, ...intermediate, ...pro];
