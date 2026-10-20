<template>
  <dialog ref="dialog" class="join-dialog game-scrollbar" :aria-labelledby="titleId" :aria-describedby="helpId" @cancel.prevent="emit('close')">
    <form novalidate @submit.prevent="joinRoom">
      <header>
        <h2 :id="titleId">{{ t('live.joinRoom') }}</h2>
        <button type="button" class="close-button" :aria-label="t('live.cancel')" @click="emit('close')">×</button>
      </header>
      <p :id="helpId">{{ t('live.joinHelp') }}</p>
      <p v-if="!enabled" class="error" role="status">{{ t('live.unavailable') }}</p>
      <label :for="inputId">{{ t('live.roomCode') }}</label>
      <input :id="inputId" ref="codeInput" v-model="draft" type="text" maxlength="16" autocomplete="off" autocapitalize="characters" spellcheck="false"
        :placeholder="t('live.joinPlaceholder')" :disabled="joining || !enabled" :aria-invalid="invalid" :aria-describedby="invalid ? errorId : helpId" @input="attempted = false" />
      <p v-if="invalid" :id="errorId" class="error" role="alert">{{ t('live.joinInvalidCode') }}</p>
      <div class="join-actions">
        <button type="button" class="cancel-button" :disabled="joining" @click="emit('close')">{{ t('live.cancel') }}</button>
        <button type="submit" class="join-button" :disabled="joining || !enabled">{{ t('live.joinRoom') }}</button>
      </div>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { useGameI18n } from "../../composables/useGameI18n";
import { useLiveConfig } from "../../composables/useLiveRoom";
import { normalizeRoomCode } from "../../utils/live/protocol";

const emit = defineEmits<{ close: [] }>();
const { t } = useGameI18n();
const { enabled } = useLiveConfig();
const baseURL = useRuntimeConfig().app.baseURL;
const dialog = ref<HTMLDialogElement | null>(null);
const codeInput = ref<HTMLInputElement | null>(null);
const draft = ref("");
const attempted = ref(false);
const joining = ref(false);
const normalizedCode = computed(() => normalizeRoomCode(draft.value));
const invalid = computed(() => attempted.value && !normalizedCode.value);
const titleId = useId();
const helpId = useId();
const inputId = useId();
const errorId = useId();

function joinRoom(): void {
  if (!enabled || joining.value) return;
  attempted.value = true;
  const code = normalizedCode.value;
  if (!code) { codeInput.value?.focus(); return; }
  joining.value = true;
  const base = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
  // The existing player flow reads ?room= at mount. A document navigation
  // preserves that entry path, including the GitHub Pages deployment prefix.
  window.location.assign(`${base}?room=${encodeURIComponent(code)}`);
}

onMounted(() => { dialog.value?.showModal(); codeInput.value?.focus(); });
onBeforeUnmount(() => dialog.value?.close());
</script>

<style scoped>
.join-dialog { box-sizing: border-box; width: min(440px, calc(100% - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; margin: auto; padding: 26px; border: 1px solid var(--cv-blue-light); border-radius: 20px; background: #102858; color: var(--cv-on-dark); font-family: var(--cv-font); box-shadow: 0 20px 60px #020e36aa; }
.join-dialog::backdrop { background: #03102caa; backdrop-filter: blur(5px); }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h2 { margin: 0; font-size: 1.4rem; }
p { margin: 12px 0 20px; color: #d5e4ff; font-size: .875rem; line-height: 1.6; }
label { display: block; margin-bottom: 8px; font-weight: 700; }
input { width: 100%; min-height: 52px; padding: 10px 14px; border: 1px solid var(--cv-blue-light); border-radius: var(--cv-radius); background: var(--cv-navy-900); color: var(--cv-on-dark); font: inherit; font-size: 1.2rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; user-select: text; }
input::placeholder { color: #a9bee0; opacity: 1; }
input[aria-invalid="true"] { border-color: var(--cv-red); }
.error { margin: 10px 0; color: #ffbaba; }
.join-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 22px; }
button { min-height: 48px; padding: 10px 14px; border: 1px solid #709adc; border-radius: var(--cv-radius); background: #19386c; color: var(--cv-on-dark); font: inherit; font-weight: 800; cursor: pointer; }
.close-button { flex: none; width: 44px; min-height: 44px; padding: 0; font-size: 1.7rem; line-height: 1; }
.join-button { border-color: var(--cv-yellow); background: var(--cv-yellow); color: var(--cv-navy-900); }
button:not(:disabled):hover { filter: brightness(1.08); }
button:not(:disabled):active { filter: brightness(.95); }
button:disabled, input:disabled { opacity: .55; cursor: not-allowed; }
button:focus-visible, input:focus-visible { outline: 3px solid var(--cv-yellow); outline-offset: 3px; }
</style>
