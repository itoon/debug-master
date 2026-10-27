<template>
  <section v-if="players.length" class="queue-strip" :aria-labelledby="headingId">
    <h2 :id="headingId">{{ t('live.queue') }}</h2>
    <ol>
      <li v-for="player in players" :key="player.id" :class="{ off: !player.connected }">
        <PlayerAvatar :avatar-id="player.avatarId" />
        <span :title="player.name">{{ player.name }}</span>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { useGameI18n } from "../../composables/useGameI18n";
import type { LivePlayer } from "../../utils/live/protocol";

defineProps<{ players: LivePlayer[] }>();
const { t } = useGameI18n();
const headingId = useId();
</script>

<style scoped>
.queue-strip { display: inline-flex; align-items: center; gap: 1cqw; max-width: 100%; padding: .5cqw 1.2cqw .5cqw .6cqw; overflow: hidden; border: 1px solid #6e9fe855; border-radius: 999px; background: #071e49d0; }
h2 { flex: none; margin: 0; padding: .35cqw .9cqw; border-radius: 999px; background: #ffffff14; color: #87dfff; font-size: 1.2cqw; font-weight: 800; white-space: nowrap; }
ol { display: flex; gap: 1cqw; min-width: 0; margin: 0; padding: 0; list-style: none; }
li { display: flex; align-items: center; gap: .4cqw; flex: none; font-size: 1.15cqw; font-weight: 700; }
li.off { opacity: .45; }
img { width: 2.4cqw; height: 2.4cqw; border: .15cqw solid #dbeaff; border-radius: 50%; background: radial-gradient(circle at top, #76a3ed, #23448d); object-fit: contain; }
span { max-width: 7cqw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
