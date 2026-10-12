// Asset checklist for the art team, shown on pages/elements.vue.
//
// To replace an asset that is "in-use": overwrite the file at `file` with the
// new art (same name and format). The game and the elements page both import
// that file, so both update. To add a "wanted" asset: put it at `file`, then
// wire it up as described in `swap` and change its status to "in-use".

import codiDizzy from "~/assets/sprites/cody-dizzy.webp";
import codiHappy from "~/assets/sprites/cody-happy.webp";
import codiIdle from "~/assets/sprites/cody-idle.webp";
import beacon from "~/assets/sprites/beacon.png";
import gem from "~/assets/sprites/gem.png";
import rock from "~/assets/sprites/rock.png";
import background from "~/assets/bg.png";
import { PLAYER_SPRITES } from "../utils/playerSprites";

export type AssetStatus = "in-use" | "css" | "wanted" | "spare";

export type AssetPreview =
  | { kind: "image"; src: string; backdrop?: "tile" | "dark" | "light" }
  | {
      kind: "tile";
      /** Tile kind, e.g. "honey" (CSS class tile-honey). */
      tileKind: string;
      letter: string;
      /** Also show the checker (alt) shade. */
      alt?: boolean;
      start?: boolean;
    }
  | { kind: "font"; weight: number }
  | { kind: "glyph"; text: string }
  | { kind: "none" };

export type AssetItem = {
  id: string;
  name: string;
  /** Where the file lives (or should live) in the repo. */
  file: string;
  status: AssetStatus;
  preview: AssetPreview;
  usedIn: string;
  spec: string[];
  /** How to swap it in, when it is not a straight file overwrite. */
  swap?: string;
};

export type AssetGroup = {
  id: string;
  title: string;
  description: string;
  /** Spec lines that apply to every item in the group. */
  common?: string[];
  items: AssetItem[];
};

export const STATUS_LABELS: Record<AssetStatus, string> = {
  "in-use": "ใช้อยู่ในเกม",
  css: "วาดด้วย CSS (ยังไม่มีรูป)",
  wanted: "ต้องการเพิ่ม",
  spare: "มีไฟล์ แต่ยังไม่ได้ใช้",
};

const CODI_SPEC = [
  "พื้นหลังโปร่งใส ทุกรูปตัวขนาดเท่ากัน เท้าอยู่ระดับเดียวกัน (สลับรูปแล้วตัวไม่กระโดด)",
  "ตัวเดินวาดแยกครบ 4 ทิศ เกมไม่กลับด้านรูปให้",
  "รูปท่าทาง (ดีใจ มึน ...): WebP สูง 320 px กว้างไม่เกิน 320 px",
  "ไม่ต้องใส่เงาใต้เท้า (CSS ใส่ drop-shadow ให้)",
];

const TILE_SPEC = [
  "WebP 160 × 160 px ไม่โปร่งใส มุมเหลี่ยม (CSS ตัดมุมมนและใส่ขอบนูนให้)",
  "ไม่มีตัวอักษรบนช่อง แต่ละชนิดคือ 'ของ' หนึ่งอย่าง (หญ้า ดอกไม้ น้ำผึ้ง ...) ต้องดูออกจากรูปทรงและลาย ไม่ใช่จากสีอย่างเดียว (ผู้เล่นตาบอดสีต้องแยกได้)",
  "ทุกชนิดต้องแยกกันออกชัดเมื่อย่อเหลือ 26 px และเมื่อ Codi ยืนทับตรงกลาง",
  "ลายต้องเบาพอที่ Codi (หมวกแดง) ยืนทับแล้วยังเห็นตัวชัด",
];

const TILE_SWAP =
  'วางไฟล์ที่ path นี้ แล้วใน assets/css/board.css เปลี่ยน --tile-bg ของชนิดนั้นเป็น url("../tiles/<ชื่อ>.webp") center / cover';

export const assetGroups: AssetGroup[] = [
  {
    id: "codi",
    title: "Codi (ตัวละคร)",
    description:
      "ตัวที่ผู้เล่นบังคับใช้รูป 4 ทิศ (หันตามก้าวล่าสุด เริ่มด่านหันหน้าลง) ส่วนรูปท่าทางชุดเดิมยังเก็บไว้",
    common: CODI_SPEC,
    items: [
      ...(["right", "up", "down", "left"] as const).map(
        (direction): AssetItem => ({
          id: `codi-walk-${direction}`,
          name: `ตัวเดิน หัน${{ right: "ขวา", up: "ขึ้น (หันหลัง)", down: "ลง (หันหน้า)", left: "ซ้าย" }[direction]}`,
          file: `app/assets/sprites/codi-${direction}.png`,
          status: "in-use",
          preview: { kind: "image", src: PLAYER_SPRITES[direction], backdrop: "tile" },
          usedIn: direction === "down" ? "หน้าแรก, ตัวผู้เล่นตอนเริ่มด่าน / เดินลง, หน้าคลังโจทย์" : `ตัวผู้เล่นตอนเดิน${direction === "up" ? "ขึ้น" : direction === "left" ? "ซ้าย" : "ขวา"}`,
          spec: ["PNG โปร่งใส 128 × 128 px ทั้ง 4 ทิศตัวขนาดเท่ากัน เท้าอยู่ระดับเดียวกัน"],
        }),
      ),
      {
        id: "codi-idle",
        name: "ยืนรอ (idle)",
        file: "app/assets/sprites/cody-idle.webp",
        status: "spare",
        preview: { kind: "image", src: codiIdle, backdrop: "tile" },
        usedIn: "ยังไม่ได้ใช้ (เดิมใช้ตลอดการเล่น)",
        spec: ["ท่าที่เห็นบ่อยที่สุด ควรอ่านง่ายที่สุด"],
      },
      {
        id: "codi-happy",
        name: "ดีใจ (happy)",
        file: "app/assets/sprites/cody-happy.webp",
        status: "spare",
        preview: { kind: "image", src: codiHappy, backdrop: "tile" },
        usedIn: "ยังไม่ได้ใช้ (เดิมใช้ตอนผ่านด่าน)",
        spec: [],
      },
      {
        id: "codi-dizzy",
        name: "มึน (dizzy)",
        file: "app/assets/sprites/cody-dizzy.webp",
        status: "spare",
        preview: { kind: "image", src: codiDizzy, backdrop: "tile" },
        usedIn: "ยังไม่ได้ใช้ (เดิมใช้ตอนกดผิด / หมดเวลา)",
        spec: [],
      },
      {
        id: "codi-wave",
        name: "โบกมือ (wave)",
        file: "app/assets/sprites/cody-wave.webp",
        status: "wanted",
        preview: { kind: "none" },
        usedIn: "หน้าตั้งค่าเกม / เมนู",
        spec: [],
        swap: "เพิ่มรูปในหน้าตั้งค่า pages/index.vue",
      },
      {
        id: "codi-think",
        name: "ครุ่นคิด (think)",
        file: "app/assets/sprites/cody-think.webp",
        status: "wanted",
        preview: { kind: "none" },
        usedIn: "ตอนเปิด Hint หรือผู้เล่นนิ่งนาน",
        spec: [],
        swap: "เพิ่มเงื่อนไขใน codiSprite (pages/index.vue)",
      },
      {
        id: "codi-party",
        name: "ฉลองใหญ่ (party)",
        file: "app/assets/sprites/cody-party.webp",
        status: "wanted",
        preview: { kind: "none" },
        usedIn: "จบครบทุกด่าน / หน้า Ranking",
        spec: [],
        swap: "ใช้แทน happy เมื่อ status = completed ใน codiSprite",
      },
      {
        id: "codi-sad",
        name: "เสียใจ (sad)",
        file: "app/assets/sprites/cody-sad.webp",
        status: "wanted",
        preview: { kind: "none" },
        usedIn: "หมดเวลา (แยกจากกดผิด)",
        spec: [],
        swap: "ใช้แทน dizzy เมื่อ status = timeup ใน codiSprite",
      },
      {
        id: "codi-back",
        name: "หันหลัง (back) — ไม่บังคับ",
        file: "app/assets/sprites/cody-back.webp",
        status: "wanted",
        preview: { kind: "none" },
        usedIn: "ตอนเดินขึ้น ให้ดูสมจริงขึ้น",
        spec: [],
        swap: "เลือกรูปตามทิศล่าสุดใน pages/index.vue",
      },
    ],
  },
  {
    id: "tiles",
    title: "ช่องบนกระดาน (8 ชนิด)",
    description:
      "ช่องแต่ละชนิดเป็น 'ของ' หนึ่งอย่าง ใช้ชื่อเดียวกันทุกที่: ป้ายในโค้ด (if honey:), class CSS (tile-honey) และรายการนี้ ใช้เป็นเงื่อนไขใน if / while จึงต้องแยกกันออกชัด ตัวอักษร (n, b, y, …) เป็นแค่รหัสในข้อมูลด่าน ผู้เล่นไม่เห็น ตอนนี้วาดด้วย CSS ทั้งหมด ส่งเป็นรูปพื้นผิวมาแทนได้",
    common: TILE_SPEC,
    items: [
      tile("floor", "n", "พื้นธรรมดา (floor)", "ช่องที่มากที่สุด (~1,000 ช่อง) ต้องเรียบที่สุด ให้ช่องเงื่อนไขเด่น", true),
      tile("ice", "b", "น้ำแข็ง (ice)", "ฟ้าขาวเงา มีแสงสะท้อน ต้องต่างจาก floor ชัด"),
      tile("sand", "y", "ทราย (sand)", "เหลืองอ่อน เม็ดทรายจางๆ ต้องต่างจาก honey ชัด (sand ซีดและด้าน honey เข้มและมันวาว)"),
      tile("grass", "g", "หญ้า (grass)", "พื้นเขียว + พุ่มหญ้าใหญ่สองโทน 1 พุ่มกลางช่อง แบบเดียวกับคริสตัลและหิน (SVG ใน CSS) ถ้าทำรูปมาแทน ต้องดูออกทันทีว่าเป็นหญ้า แม้ Codi ยืนทับ"),
      tile("flower", "p", "ดอกไม้ (flower)", "พื้นชมพู + ดอกซากุระ 1 ดอกกลางช่อง (กลีบ 5 กลีบปลายเว้า ใจชมพูเข้มมีเกสร) แบบเดียวกับคริสตัลและหิน (SVG ใน CSS) ถ้าทำรูปมาแทน ต้องดูออกทันทีว่าเป็นดอกซากุระ แม้ Codi ยืนทับ"),
      tile("honey", "o", "น้ำผึ้ง (honey)", "อำพันเข้ม + ลายรวงผึ้งจางๆ + ไหดินเผาใส่น้ำผึ้ง 1 ใบกลางช่อง น้ำผึ้งล้นปากไหย้อยลงมา แบบเดียวกับคริสตัลและหิน (SVG ใน CSS) ห้ามมีตัวหนังสือ ต้องเข้มกว่า sand ชัดเจน และดูออกว่าเป็นน้ำผึ้งแม้ Codi ยืนทับ"),
      {
        ...tile("gem", "v", "คริสตัล (gem)", "ม่วง + รูปคริสตัล"),
        status: "in-use",
        file: "app/assets/sprites/gem.png",
        spec: ["ตัวคริสตัล: PNG โปร่งใส 172 × 192 px วางกลางช่อง (พื้นม่วงยังเป็น CSS)"],
        swap: "ทับไฟล์ gem.png ได้เลย",
      },
      {
        ...tile("rock", "k", "หิน (rock)", "กรมท่า + รูปก้อนหิน"),
        status: "in-use",
        file: "app/assets/sprites/rock.png",
        spec: ["ตัวหิน: PNG โปร่งใส 190 × 192 px วางกลางช่อง (พื้นกรมท่ายังเป็น CSS)"],
        swap: "ทับไฟล์ rock.png ได้เลย",
      },
    ],
  },
  {
    id: "board",
    title: "กระดานและเครื่องหมาย",
    description: "กรอบกระดาน จุดเริ่ม และเครื่องหมายเส้นทางในหน้าคลังโจทย์",
    items: [
      {
        id: "start-pad",
        name: "จุดเริ่ม (START)",
        file: "app/assets/css/board.css → .tile.start",
        status: "css",
        preview: { kind: "tile", tileKind: "floor", letter: "n", start: true },
        usedIn: "ช่องเริ่มของทุกด่าน",
        spec: [
          "ตอนนี้เป็นเส้นประสีเขียวรอบช่อง ต้องเห็นชัดบนทุกชนิดช่อง",
          "ถ้าทำเป็นรูป: PNG โปร่งใส 160 × 160 px เป็นกรอบ/แผ่นรอง ตรงกลางโล่งให้ Codi ยืน",
        ],
      },
      {
        id: "beacon",
        name: "เสาสัญญาณ (beacon)",
        file: "app/assets/sprites/beacon.png",
        status: "spare",
        preview: { kind: "image", src: beacon, backdrop: "tile" },
        usedIn: "ยังไม่ได้ใช้ (มาจาก signal-lost) ใช้เป็นเป้าหมายของด่านได้",
        spec: ["PNG โปร่งใส 128 × 192 px"],
      },
      {
        id: "finish-flag",
        name: "ธงจุดจบ",
        file: "app/assets/sprites/flag.png",
        status: "wanted",
        preview: { kind: "glyph", text: "🏁" },
        usedIn: "หน้าคลังโจทย์ (ตอนนี้ใช้ emoji)",
        spec: ["PNG โปร่งใส 96 × 96 px"],
        swap: "แทน emoji 🏁 ใน pages/review.vue",
      },
    ],
  },
  {
    id: "background",
    title: "ฉากหลัง",
    description: "ภาพเต็มจอหลังกระดาน กระดานและหน้าต่างโค้ดจะวางทับตรงกลาง",
    items: [
      {
        id: "bg",
        name: "ฉากหลังเกม (จอแนวนอน)",
        file: "app/assets/bg.png",
        status: "in-use",
        preview: { kind: "image", src: background, backdrop: "dark" },
        usedIn: "หน้าเกม",
        spec: [
          "WebP 1920 × 1080 px ขนาดไฟล์ไม่เกิน 400 KB (ไฟล์ปัจจุบัน PNG 593 KB)",
          "ตรงกลางโล่ง ของตกแต่งไว้ขอบซ้าย/ขวา/ล่าง เพราะจอแคบจะถูกตัดด้านข้าง",
          "โทนน้ำเงิน CodeVenture ไม่สว่างเกินจนตัวหนังสือสีขาวอ่านยาก",
        ],
        swap: "ถ้าเปลี่ยนนามสกุลไฟล์ แก้ url ใน .app-shell (pages/index.vue)",
      },
      {
        id: "bg-mobile",
        name: "ฉากหลังจอแนวตั้ง — ไม่บังคับ",
        file: "app/assets/bg-mobile.webp",
        status: "wanted",
        preview: { kind: "none" },
        usedIn: "มือถือ / แท็บเล็ตแนวตั้ง",
        spec: ["WebP 1080 × 1920 px ไม่เกิน 400 KB"],
        swap: "เพิ่ม @media (orientation: portrait) ใน .app-shell",
      },
    ],
  },
  {
    id: "ui",
    title: "ปุ่มและไอคอน",
    description: "ส่วนควบคุมบนหน้าจอ ตอนนี้ใช้ตัวอักษรพิเศษแทนไอคอน",
    common: ["SVG สีเดียว (ใช้ currentColor) กรอบ 24 × 24 px เส้นหนาเท่ากันทั้งชุด"],
    items: [
      {
        id: "arrows",
        name: "ไอคอนลูกศร 4 ทิศ",
        file: "app/assets/icons/arrow-{up,down,left,right}.svg",
        status: "wanted",
        preview: { kind: "glyph", text: "▲ ◀ ▼ ▶" },
        usedIn: "ปุ่มบังคับบนจอ, เฉลยในหน้าคลังโจทย์",
        spec: [],
        swap: "แทนตัวอักษร ▲◀▼▶ ในปุ่ม .arrow (pages/index.vue)",
      },
      {
        id: "heart",
        name: "หัวใจ (ชีวิตใน Dead Mode)",
        file: "app/assets/icons/heart-{full,empty}.svg",
        status: "wanted",
        preview: { kind: "glyph", text: "♥ ♥ ♥" },
        usedIn: "HUD ของ Dead Mode, 5 ดวง (ตอนนี้ใช้ตัวอักษร ♥)",
        spec: ["2 แบบ: เต็ม (แดง) และเสียแล้ว (จาง) ต้องแยกออกบนพื้นน้ำเงินเข้ม"],
        swap: "แทนตัวอักษร ♥ ใน .hearts (pages/index.vue)",
      },
      {
        id: "logo",
        name: "โลโก้ Debug Runner",
        file: "app/assets/brand/logo.svg",
        status: "wanted",
        preview: { kind: "glyph", text: "◯ Debug Runner" },
        usedIn: "หัวเกม (ตอนนี้เป็นป้ายตัวอักษร)",
        spec: ["SVG แนวนอน สูง 32 px ใช้บนพื้นน้ำเงินเข้ม"],
      },
      {
        id: "favicon",
        name: "ไอคอนแท็บเบราว์เซอร์ (favicon)",
        file: "public/favicon.ico",
        status: "wanted",
        preview: { kind: "none" },
        usedIn: "แท็บเบราว์เซอร์ (ตอนนี้เป็นไอคอน Nuxt)",
        spec: ["SVG หรือ PNG 512 × 512 px อ่านออกที่ 16 px"],
        swap: "วางทับ public/favicon.ico (หรือเพิ่ม favicon.svg แล้วตั้งใน nuxt.config)",
      },
    ],
  },
  {
    id: "sound",
    title: "เสียง — ไม่บังคับ",
    description: "ตอนนี้เกมยังไม่มีเสียง",
    common: ["MP3 หรือ OGG สั้นไม่เกิน 1 วินาที (ยกเว้นเพลงจบ) ไฟล์ละไม่เกิน 50 KB ระดับเสียงเท่ากันทั้งชุด"],
    items: [
      sound("move", "เดินถูก", "ทุกครั้งที่กดถูก (ได้ยินบ่อยมาก ต้องเบาและสั้น)"),
      sound("wrong", "กดผิด", "ตอนกระดานแตก"),
      sound("clear", "ผ่านด่าน", "ตอนคะแนนเด้ง"),
      sound("complete", "จบเกม", "ครบทุกด่าน / หมดเวลา (ยาวได้ 2–3 วินาที)"),
    ],
  },
];

function tile(
  name: string,
  letter: string,
  title: string,
  note: string,
  alt = false,
): AssetItem {
  return {
    id: `tile-${name}`,
    name: `${title} · ${letter}`,
    file: `app/assets/tiles/${name}.webp`,
    status: "css",
    preview: { kind: "tile", tileKind: name, letter, alt },
    usedIn: `กระดาน + ป้ายในโค้ด (if ${name}: · รหัสในข้อมูลด่าน ${letter})`,
    spec: [note],
    swap: TILE_SWAP.replace("<ชื่อ>", name),
  };
}

function sound(name: string, title: string, when: string): AssetItem {
  return {
    id: `sound-${name}`,
    name: title,
    file: `app/assets/sounds/${name}.mp3`,
    status: "wanted",
    preview: { kind: "none" },
    usedIn: when,
    spec: [],
  };
}
