<template>
  <DocShell eyebrow="สำหรับทีมออกแบบ" title="Elements ที่ต้องเตรียม">
    <template #subtitle>
      รายการทั้งหมดอยู่ใน <code>app/data/assets.ts</code> · รูปตัวอย่างคือไฟล์จริงที่เกมใช้
      ทับไฟล์เดิมแล้วทั้งเกมและหน้านี้เปลี่ยนตาม
    </template>

    <template #toolbar>
      <div class="el-toolbar">
        <button
          v-for="filter in filters"
          :key="filter.id"
          type="button"
          class="el-filter"
          :class="[`status-${filter.id}`, { on: statusFilter === filter.id }]"
          @click="statusFilter = filter.id"
        >
          {{ filter.label }} <b>{{ filter.count }}</b>
        </button>
      </div>
      <nav class="el-jump" aria-label="ไปที่หมวด">
        <a v-for="group in assetGroups" :key="group.id" :href="`#group-${group.id}`">{{
          group.title
        }}</a>
        <a href="#group-colors">สีหลัก</a>
      </nav>
    </template>

    <section
      v-for="group in visibleGroups"
      :id="`group-${group.id}`"
      :key="group.id"
      class="el-group"
    >
      <header class="el-group-head">
        <h2>{{ group.title }}</h2>
        <p>{{ group.description }}</p>
        <ul v-if="group.common?.length" class="el-common">
          <li v-for="line in group.common" :key="line">{{ line }}</li>
        </ul>
      </header>

      <div class="el-grid">
        <article v-for="item in group.items" :key="item.id" class="el-card">
          <div class="el-preview" :class="previewClass(item)">
            <template v-if="item.preview.kind === 'image'">
              <img
                :src="item.preview.src"
                :alt="item.name"
                @load="onImageLoad(item.id, $event)"
              />
            </template>
            <template v-else-if="item.preview.kind === 'tile'">
              <div
                class="tile"
                :class="[
                  `tile-${item.preview.tileKind}`,
                  { start: item.preview.start },
                ]"
                style="--cell-size: 84px"
              />
              <div
                v-if="item.preview.alt"
                class="tile alt"
                :class="`tile-${item.preview.tileKind}`"
                style="--cell-size: 84px"
              />
            </template>
            <span
              v-else-if="item.preview.kind === 'glyph'"
              class="el-glyph"
              >{{ item.preview.text }}</span
            >
            <span v-else class="el-missing">ยังไม่มีไฟล์</span>
          </div>

          <div class="el-body">
            <div class="el-name-row">
              <h3>{{ item.name }}</h3>
              <span class="el-status" :class="`status-${item.status}`">{{
                STATUS_LABELS[item.status]
              }}</span>
            </div>
            <code class="el-file">{{ item.file }}</code>
            <p v-if="sizes[item.id]" class="el-size">
              ไฟล์ปัจจุบัน {{ sizes[item.id] }}
            </p>
            <p class="el-used"><b>ใช้ที่:</b> {{ item.usedIn }}</p>
            <ul v-if="item.spec.length" class="el-spec">
              <li v-for="line in item.spec" :key="line">{{ line }}</li>
            </ul>
            <p v-if="item.swap" class="el-swap"><b>วิธีเปลี่ยน:</b> {{ item.swap }}</p>
            <div
              v-if="item.preview.kind === 'tile' && group.id === 'tiles'"
              class="el-chip-sample"
            >
              ในโค้ด:
              <span class="code-tile" :class="`tile-${item.preview.tileKind}`"
                ><i class="code-tile-swatch" /><span class="code-tile-label">{{
                  item.preview.tileKind
                }}</span></span
              >
            </div>
          </div>
        </article>
      </div>
    </section>

    <section v-if="statusFilter === 'all'" id="group-colors" class="el-group">
      <header class="el-group-head">
        <h2>สีหลัก (design tokens)</h2>
        <p>
          ไม่ใช่ไฟล์ที่ต้องส่ง แต่ทุก asset ควรเข้ากับชุดสีนี้ · แก้ได้ที่
          <code>app/assets/css/tailwind.css</code> (:root)
        </p>
      </header>
      <div class="el-colors">
        <div v-for="token in COLOR_TOKENS" :key="token.name" class="el-color">
          <span class="el-swatch" :style="{ background: `var(${token.name})` }" />
          <b>{{ token.label }}</b>
          <code>{{ token.name }}</code>
          <small>{{ tokenValues[token.name] }}</small>
        </div>
      </div>
      <p class="el-font-note">
        ฟอนต์: LINE Seed Sans TH (<code>app/assets/font/</code>) ·
        <span style="font-weight: 400">Regular 400</span> ·
        <span style="font-weight: 700">Bold 700</span> ·
        <span style="font-weight: 800">ExtraBold 800</span> · ตัวอย่าง: ด่าน 01
        กดลูกศรให้ตรงกับ code
      </p>
    </section>
  </DocShell>
</template>

<script setup lang="ts">
// Team page: every visual/audio asset the game uses or wants, from the
// checklist in data/assets.ts. Previews are the real files and the real tile
// CSS (assets/css/board.css), so this page never drifts from the game.
import {
  assetGroups,
  STATUS_LABELS,
  type AssetItem,
  type AssetStatus,
} from "../data/assets";

useHead({ title: "Elements · Debug Runner" });

const COLOR_TOKENS = [
  { name: "--cv-navy-900", label: "กรมท่า (พื้นหลัก)" },
  { name: "--cv-blue", label: "น้ำเงินแบรนด์" },
  { name: "--cv-blue-light", label: "ฟ้าอ่อน" },
  { name: "--cv-yellow", label: "เหลือง (เน้น)" },
  { name: "--cv-orange", label: "ส้ม (ปุ่มหลัก)" },
  { name: "--cv-coral", label: "ส้มแดง" },
  { name: "--cv-red", label: "แดง (ผิด)" },
  { name: "--cv-green", label: "เขียว (ถูก)" },
  { name: "--cv-heading", label: "ตัวหนังสือหัวข้อ" },
  { name: "--cv-surface", label: "พื้นการ์ดอ่อน" },
];

type Filter = AssetStatus | "all";
const statusFilter = ref<Filter>("all");
const allItems = assetGroups.flatMap((group) => group.items);
const filters = computed(() =>
  (["all", "wanted", "css", "in-use", "spare"] as Filter[]).map((id) => ({
    id,
    label: id === "all" ? "ทั้งหมด" : STATUS_LABELS[id],
    count:
      id === "all"
        ? allItems.length
        : allItems.filter((item) => item.status === id).length,
  })),
);
const visibleGroups = computed(() =>
  assetGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          statusFilter.value === "all" || item.status === statusFilter.value,
      ),
    }))
    .filter((group) => group.items.length),
);

// Actual pixel size of each image, read from the loaded file.
const sizes = reactive<Record<string, string>>({});
function onImageLoad(id: string, event: Event): void {
  const img = event.target as HTMLImageElement;
  sizes[id] = `${img.naturalWidth} × ${img.naturalHeight} px`;
}

const tokenValues = reactive<Record<string, string>>({});
onMounted(() => {
  const root = getComputedStyle(document.documentElement);
  for (const token of COLOR_TOKENS) {
    tokenValues[token.name] = root.getPropertyValue(token.name).trim();
  }
});

function previewClass(item: AssetItem): string {
  if (item.preview.kind === "image") {
    return `backdrop-${item.preview.backdrop ?? "light"}`;
  }
  if (item.preview.kind === "tile") return "backdrop-board";
  return "backdrop-light";
}
</script>

<style scoped>
.el-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.el-filter {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--cv-on-dark);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.el-filter b {
  margin-left: 4px;
  opacity: 0.75;
}

.el-filter.on {
  background: #fff;
  color: var(--cv-blue);
}

.el-jump {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.el-jump a {
  padding: 3px 10px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--cv-on-dark);
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
}

.el-jump a:hover {
  background: rgba(255, 255, 255, 0.22);
}

.el-group {
  scroll-margin-top: 190px;
  margin-bottom: 36px;
}

.el-group-head h2 {
  margin: 0 0 4px;
  color: var(--cv-heading);
  font-size: 1.4rem;
  font-weight: 800;
}

.el-group-head p {
  margin: 0;
  color: var(--cv-muted);
}

.el-group-head code,
.el-font-note code,
.el-color code {
  padding: 1px 6px;
  border-radius: 6px;
  background: #eef2f7;
  color: var(--cv-heading);
  font-size: 0.85em;
}

.el-common {
  margin: 10px 0 0;
  padding: 10px 14px 10px 30px;
  border-left: 4px solid var(--cv-blue);
  border-radius: var(--cv-radius-sm);
  background: var(--cv-blue-soft);
  color: var(--cv-heading);
  font-size: 0.9rem;
}

.el-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.el-card {
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius-xl);
  background: #fff;
  box-shadow: var(--cv-shadow-md);
  break-inside: avoid;
}

.el-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 170px;
  padding: 14px;
}

.el-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.backdrop-light {
  background: repeating-conic-gradient(#eef2f7 0 25%, #fff 0 50%) 0 0 / 20px
    20px;
}

.backdrop-dark {
  padding: 0;
  background: var(--cv-navy-900);
}

.backdrop-dark img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.backdrop-tile,
.backdrop-board {
  background: linear-gradient(180deg, #1c3f9e, #142f80);
}

.el-glyph {
  color: var(--cv-heading);
  font-size: 2rem;
  font-weight: 800;
}

.el-missing {
  padding: 8px 14px;
  border: 2px dashed #cbd5e1;
  border-radius: var(--cv-radius);
  color: var(--cv-muted);
  font-weight: 700;
}

.el-body {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 14px 16px 16px;
  border-top: 1px solid var(--cv-border);
}

.el-name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.el-name-row h3 {
  margin: 0;
  color: var(--cv-heading);
  font-size: 1rem;
  font-weight: 800;
}

.el-status {
  padding: 2px 9px;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.status-in-use {
  background: rgba(50, 213, 131, 0.18);
  color: #127a47;
}

.status-css {
  background: rgba(31, 117, 255, 0.12);
  color: var(--cv-blue);
}

.status-wanted {
  background: rgba(247, 151, 34, 0.18);
  color: #9a4f00;
}

.status-spare {
  background: #eef2f7;
  color: var(--cv-muted);
}

/* Filter buttons on the dark header keep their own colours. */
.el-filter.status-in-use,
.el-filter.status-css,
.el-filter.status-wanted,
.el-filter.status-spare {
  background: rgba(255, 255, 255, 0.08);
  color: var(--cv-on-dark);
}

.el-filter.on.status-in-use,
.el-filter.on.status-css,
.el-filter.on.status-wanted,
.el-filter.on.status-spare {
  background: #fff;
  color: var(--cv-blue);
}

.el-file {
  overflow-wrap: anywhere;
  color: var(--cv-blue);
  font-family: var(--cv-font-mono);
  font-size: 0.78rem;
}

.el-size {
  margin: 0;
  color: var(--cv-muted);
  font-size: 0.8rem;
}

.el-used,
.el-swap {
  margin: 0;
  font-size: 0.85rem;
}

.el-swap {
  color: var(--cv-muted);
}

.el-spec {
  margin: 0;
  padding-left: 18px;
  font-size: 0.85rem;
}

.el-chip-sample {
  display: flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 6px 10px;
  border-radius: var(--cv-radius-sm);
  background: var(--cv-navy-900);
  color: #e5f0ff;
  font-family: var(--cv-font-mono);
  font-size: 0.9rem;
}

.el-colors {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.el-color {
  display: grid;
  grid-template-columns: 40px 1fr;
  column-gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius);
  background: #fff;
}

.el-swatch {
  grid-row: span 3;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.el-color b {
  color: var(--cv-heading);
  font-size: 0.85rem;
}

.el-color code {
  width: fit-content;
  font-size: 0.72rem;
}

.el-color small {
  color: var(--cv-muted);
  font-family: var(--cv-font-mono);
}

.el-font-note {
  margin-top: 16px;
  color: var(--cv-heading);
}

@media print {
  .el-toolbar,
  .el-jump {
    display: none;
  }
}
</style>
