<template>
  <DocShell :eyebrow="t('home.team')" :title="t('players.title')">
    <template #subtitle>{{ t('players.description') }}</template>
    <template #toolbar>
      <div class="players-toolbar">
        <label :for="searchId">{{ t('players.search') }}</label>
        <input :id="searchId" ref="searchInput" v-model="query" type="search" autocomplete="off" :disabled="deleting || pending.length > 0" :placeholder="t('players.searchPlaceholder')" />
        <span>{{ t('players.count', { count: entries.length }) }}</span>
      </div>
    </template>
    <p v-if="loadError" class="page-error" role="alert">{{ t('storage.loadError') }} <button type="button" @click="refresh">{{ t('players.retryLoad') }}</button></p>
    <p v-else-if="!loaded" class="list-notice">{{ t('players.loading') }}</p>
    <template v-else>
      <p v-if="notice" class="list-notice" role="status">{{ notice }}</p>
      <div class="selection-toolbar">
        <span role="status">{{ t('players.selectedCount', { count: selectedIds.length }) }}</span>
        <button type="button" :disabled="!selectedIds.length || deleting" @click="selectedIds = []">{{ t('players.clearSelection') }}</button>
        <button type="button" class="delete-button" :disabled="!selectedIds.length || deleting" @click="selectBatch($event)">{{ t('players.deleteSelected', { count: selectedIds.length }) }}</button>
      </div>
      <div v-if="filtered.length" class="table-scroll">
        <table>
          <caption class="sr-only">{{ t('players.title') }}</caption>
          <thead><tr><th class="selection-cell"><label class="checkbox-hit"><input class="select-checkbox" type="checkbox" :checked="allFilteredSelected" :indeterminate="someFilteredSelected && !allFilteredSelected" :disabled="deleting" :aria-label="t('players.selectAllVisible')" @change="toggleFiltered($event)" /></label></th><th>{{ t('home.nickname') }}</th><th>{{ t('players.age') }}</th><th>{{ t('players.mode') }}</th><th>{{ t('game.score') }}</th><th>{{ t('players.playedAt') }}</th><th>{{ t('players.actions') }}</th></tr></thead>
          <tbody>
            <tr v-for="entry in filtered" :key="entry.id" :class="{ 'selected-row': selectedIds.includes(entry.id) }">
              <td class="selection-cell"><label class="checkbox-hit"><input v-model="selectedIds" class="select-checkbox" type="checkbox" :value="entry.id" :disabled="deleting" :aria-label="t('players.selectEntry', { name: entry.name, playedAt: dateFormatter.format(new Date(entry.createdAt)) })" /></label></td>
              <td><div class="player-cell"><img :class="{ 'is-photo': avatarSrc(entry.avatarId).startsWith('https:') }" :src="avatarSrc(entry.avatarId)" alt="" draggable="false" /><strong>{{ entry.name }}</strong></div></td>
              <td>{{ entry.age ? t('home.years', { age: entry.age }) : '—' }}</td>
              <td>{{ modeName(entry) }}<small>{{ entry.setTitle }}</small></td>
              <td class="score-cell">{{ entry.score.toLocaleString('th-TH') }}<small>{{ formatClock(entry.elapsedMs) }}</small></td>
              <td>{{ dateFormatter.format(new Date(entry.createdAt)) }}</td>
              <td><button type="button" class="delete-button" :disabled="deleting" :aria-label="t('players.deleteLabel', { name: entry.name })" @click="selectEntry(entry, $event)"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>{{ t('players.delete') }}</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="list-notice">{{ t(query.trim() ? 'players.noMatches' : 'players.empty') }}</p>
    </template>
    <PlayerDeleteDialog v-if="pending.length" :entries="pending.map(entry => ({ ...entry, modeLabel: modeName(entry), playedAt: dateFormatter.format(new Date(entry.createdAt)) }))" :busy="deleting" :error="deleteError" @close="closeDialog" @confirm="deleteEntries" />
  </DocShell>
</template>

<script setup lang="ts">
import type { Score } from '../types/debug-game';
import { createLocalRepositories } from '../storage/LocalStorageAdapter';
import { useGameI18n } from '../composables/useGameI18n';
import { usePlayerAvatar } from '../composables/usePlayerAvatar';
import { formatClock } from '../utils/ranking';
const { t } = useGameI18n();
const avatarSrc = usePlayerAvatar();
const repositories = createLocalRepositories();
const entries = ref<Score[]>([]);
const query = ref('');
const loaded = ref(false);
const loadError = ref(false);
const notice = ref('');
const selectedIds = ref<string[]>([]);
const pending = ref<Score[]>([]);
const deleting = ref(false);
const deleteError = ref(false);
const searchId = useId();
const searchInput = ref<HTMLInputElement | null>(null);
let launchButton: HTMLButtonElement | null = null;
let unsubscribe: (() => void) | undefined;
const dateFormatter = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const filtered = computed(() => {
  const search = query.value.trim().toLocaleLowerCase('th-TH');
  return entries.value.filter((entry) => !search || entry.name.toLocaleLowerCase('th-TH').includes(search));
});
const allFilteredSelected = computed(() => filtered.value.length > 0 && filtered.value.every(entry => selectedIds.value.includes(entry.id)));
const someFilteredSelected = computed(() => filtered.value.some(entry => selectedIds.value.includes(entry.id)));
watch(query, () => { selectedIds.value = []; notice.value = ''; });
function toggleFiltered(event: Event): void {
  if (deleting.value) return;
  const visible = new Set(filtered.value.map(entry => entry.id));
  selectedIds.value = (event.target as HTMLInputElement).checked
    ? [...new Set([...selectedIds.value, ...visible])]
    : selectedIds.value.filter(id => !visible.has(id));
}
function modeName(entry: Score): string {
  if (entry.challengeId) return t(`mode.${entry.challengeId}`);
  const keys = { campaign: 'players.campaign', timer: 'players.timer', ranking: 'players.ranking', dead: 'players.dead' } as const;
  return t(keys[entry.mode]);
}
function refresh(): void {
  try {
    entries.value = repositories.scores.list().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const visible = new Set(filtered.value.map(entry => entry.id));
    selectedIds.value = selectedIds.value.filter(id => visible.has(id));
    loadError.value = false;
  } catch { loadError.value = true; selectedIds.value = []; }
  loaded.value = true;
}
function selectEntry(entry: Score, event: MouseEvent): void {
  if (deleting.value || loadError.value) return;
  launchButton = event.currentTarget as HTMLButtonElement;
  pending.value = [entry];
  deleteError.value = false;
  notice.value = '';
}
function selectBatch(event: MouseEvent): void {
  if (deleting.value || loadError.value) return;
  const ids = new Set(selectedIds.value);
  const chosen = filtered.value.filter(entry => ids.has(entry.id));
  if (!chosen.length) return;
  launchButton = event.currentTarget as HTMLButtonElement;
  pending.value = chosen;
  deleteError.value = false;
  notice.value = '';
}
async function closeDialog(): Promise<void> {
  if (deleting.value) return;
  pending.value = [];
  await nextTick();
  if (launchButton?.isConnected && !launchButton.disabled) launchButton.focus();
  else searchInput.value?.focus();
}
async function deleteEntries(): Promise<void> {
  if (!pending.value.length || deleting.value) return;
  const chosen = pending.value.slice();
  deleting.value = true;
  deleteError.value = false;
  try {
    for (const playerId of new Set(chosen.map(entry => entry.playerId).filter((id): id is string => !!id))) {
      await repositories.players.clearIfPlayer(playerId);
    }
    await repositories.scores.removeMany(chosen.map(entry => entry.id));
    notice.value = chosen.length === 1 ? t('players.deleted', { name: chosen[0]!.name }) : t('players.deletedMany', { count: chosen.length });
    const deletedIds = new Set(chosen.map(entry => entry.id));
    selectedIds.value = selectedIds.value.filter(id => !deletedIds.has(id));
    deleting.value = false;
    refresh();
    await closeDialog();
  } catch {
    deleteError.value = true;
    deleting.value = false;
  }
}
onMounted(() => { refresh(); unsubscribe = repositories.scores.subscribe(refresh); });
onBeforeUnmount(() => unsubscribe?.());
</script>

<style scoped>
.players-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.players-toolbar label, .players-toolbar span { font-size: .85rem; }
input[type="search"] { min-height: 48px; width: min(320px, 100%); padding: 10px 14px; border: 1px solid #86b4ff; border-radius: 12px; color: #142c54; background: #fff; font: inherit; }
.selection-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 16px; }
.selection-toolbar span { margin-right: auto; font-weight: 700; }
.selection-cell { width: 56px; padding: 4px 6px; }
.checkbox-hit { display: grid; place-items: center; width: 44px; height: 44px; cursor: pointer; }
.select-checkbox { width: 20px; height: 20px; accent-color: var(--cv-blue); cursor: pointer; }
.selected-row td { background: #edf4ff; }
.table-scroll { overflow-x: auto; border: 1px solid var(--cv-border); border-radius: 16px; background: #fff; }
table { border-collapse: collapse; width: 100%; text-align: left; font-size: .85rem; }
th, td { padding: 12px 14px; border-bottom: 1px solid #e5ebf5; vertical-align: middle; }
th { white-space: nowrap; background: #eaf2ff; color: #294a7c; }
tr:last-child td { border-bottom: 0; }
td small { display: block; color: #64748b; font-size: .7rem; }
.player-cell { display: flex; align-items: center; gap: 10px; min-width: 160px; }
.player-cell img { width: 36px; height: 36px; flex: none; border-radius: 50%; background: #d9e8ff; object-fit: contain; }
.player-cell img.is-photo { object-fit: cover; background: transparent; }
.player-cell strong { overflow-wrap: anywhere; }
.score-cell { font-variant-numeric: tabular-nums; }
button { min-height: 48px; border: 1px solid #d5a7ad; border-radius: 10px; padding: 8px 12px; font: inherit; cursor: pointer; }
.delete-button { display: inline-flex; align-items: center; gap: 6px; background: #fff0f1; color: #a1283a; white-space: nowrap; }
.delete-button:not(:disabled):hover { background: #ffe0e5; }
button:disabled { opacity: .55; cursor: not-allowed; }
.delete-button svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
input:focus-visible, button:focus-visible { outline: 3px solid #ffd440; outline-offset: 3px; }
.list-notice { margin: 0 0 16px; padding: 20px; border: 1px solid #d2e0f4; border-radius: 12px; background: #eff5ff; }
.page-error { color: #a1283a; }
</style>
