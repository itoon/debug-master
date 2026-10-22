<script setup lang="ts">
import { isCodiPictureUrl } from "../utils/codiOauth";

const { avatarId = "", alt = "" } = defineProps<{
  avatarId?: string;
  alt?: string;
}>();

const emit = defineEmits<{ error: [] }>();
const srcFor = usePlayerAvatar();
const photo = computed(() => isCodiPictureUrl(avatarId));
</script>

<template>
  <img
    class="player-avatar"
    :class="{ 'is-photo': photo }"
    :src="srcFor(avatarId)"
    :alt="alt"
    draggable="false"
    @error="emit('error')"
  />
</template>

<style scoped>
/* Hub photos are a 512 square of the whole character, sitting in the lower
   half. This inset frames the head and the top of the shoulders. */
.player-avatar.is-photo {
  object-fit: cover;
  object-position: center;
  object-view-box: inset(32% 26% 20% 26%);
}
</style>
