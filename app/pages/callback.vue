<template>
  <main class="callback">
    <p role="status">{{ message }}</p>
    <a v-if="failed" :href="homeHref">{{ t('callback.home') }}</a>
  </main>
</template>

<script setup lang="ts">
import { useGameI18n } from "../composables/useGameI18n";
import { useLiveConfig } from "../composables/useLiveRoom";
import { codiReturnPath, redirectUriForOrigin } from "../utils/codiOauth";
import { clearCodiTxn, readCodiTxn, saveCodiResult, type CodiTxn } from "../utils/codiSession";

const { t } = useGameI18n();
const runtimeConfig = useRuntimeConfig();
const { liveUrl, enabled } = useLiveConfig();
const message = ref(t("callback.working"));
const failed = ref(false);
const homeHref = computed(() => runtimeConfig.app.baseURL || "/");

onMounted(async () => {
  const txn = readCodiTxn();
  if (!txn) { failHere(); return; }
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (params.get("error") || params.get("state") !== txn.state || !code) {
    finish(txn, params.get("error") === "access_denied" ? "denied" : "state");
    return;
  }
  const redirectUri = redirectUriForOrigin(window.location.origin);
  if (!enabled || !redirectUri) { finish(txn, enabled ? "origin" : "unavailable"); return; }
  try {
    const response = await fetch(`${liveUrl.replace(/\/$/, "")}/oauth/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, code_verifier: txn.verifier, nonce: txn.nonce, redirect_uri: redirectUri }),
    });
    const body: unknown = await response.json();
    const profile = readProfile(body);
    if (!response.ok || !profile) { finish(txn, "failed"); return; }
    clearCodiTxn();
    saveCodiResult(txn.kind === "home" ? { kind: "home", modeId: txn.modeId, profile } : { kind: "live", room: txn.room, profile });
    window.location.replace(codiReturnPath(runtimeConfig.app.baseURL, txn));
  } catch {
    finish(txn, "failed");
  }
});

function finish(txn: CodiTxn, error: string): void {
  clearCodiTxn();
  saveCodiResult(txn.kind === "home"
    ? { kind: "home", modeId: txn.modeId, fallback: true, error }
    : { kind: "live", room: txn.room, fallback: true, error });
  window.location.replace(codiReturnPath(runtimeConfig.app.baseURL, txn));
}

function failHere(): void {
  failed.value = true;
  message.value = t("callback.failed");
}

function readProfile(value: unknown): { sub: string; nickname: string; picture: string } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.sub !== "string" || typeof body.nickname !== "string" || typeof body.picture !== "string") return null;
  if (!body.picture.startsWith("https://")) return null;
  return { sub: body.sub, nickname: body.nickname, picture: body.picture };
}
</script>

<style scoped>
.callback { display: grid; justify-items: center; gap: 16px; min-height: 100dvh; align-content: center; padding: 24px; background: #102858; color: #fff; font-family: var(--cv-font, sans-serif); text-align: center; }
p { margin: 0; font-size: 1.2rem; font-weight: 800; }
a { color: #112760; background: #ffd440; min-height: 44px; padding: 10px 16px; border-radius: 12px; font-weight: 800; text-decoration: none; }
a:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
</style>
