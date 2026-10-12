<template>
  <div class="doc-shell">
    <header class="doc-header">
      <div class="doc-header-inner">
        <div class="doc-title">
          <p class="doc-eyebrow">{{ eyebrow }}</p>
          <h1>{{ title }}</h1>
          <p v-if="$slots.subtitle" class="doc-sub"><slot name="subtitle" /></p>
        </div>
        <nav class="doc-nav" aria-label="หน้าอื่น">
          <NuxtLink to="/">เล่นเกม</NuxtLink>
          <NuxtLink to="/review">คลังโจทย์</NuxtLink>
          <NuxtLink to="/elements">Elements</NuxtLink>
        </nav>
      </div>
      <slot name="toolbar" />
    </header>

    <main class="doc-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
// Shared frame for the team pages (pages/review.vue, pages/elements.vue).
defineProps<{ eyebrow: string; title: string }>();
</script>

<style scoped>
/* The game page locks body scrolling, so these pages scroll their own shell. */
.doc-shell {
  height: 100dvh;
  overflow-y: auto;
  background: var(--cv-surface);
  color: var(--cv-text);
  font-family: var(--cv-font);
}

.doc-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  gap: 12px;
  padding: 16px max(16px, calc((100% - 1180px) / 2));
  background: linear-gradient(160deg, var(--cv-navy-800), var(--cv-navy-900));
  color: var(--cv-on-dark);
  box-shadow: var(--cv-shadow-xl);
}

.doc-header-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.doc-title h1 {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 2rem);
  font-weight: 800;
}

.doc-eyebrow {
  display: inline-block;
  margin: 0 0 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.14);
  color: var(--cv-yellow);
  font-size: 0.72rem;
  font-weight: 700;
}

.doc-sub {
  margin: 4px 0 0;
  color: var(--cv-on-dark-muted);
  font-size: 0.85rem;
}

.doc-sub :deep(code) {
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.doc-nav {
  display: inline-flex;
  padding: 3px;
  border-radius: var(--cv-radius);
  background: rgba(255, 255, 255, 0.1);
}

.doc-nav a {
  padding: 7px 12px;
  border-radius: 9px;
  color: var(--cv-on-dark-muted);
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: none;
}

.doc-nav a:hover {
  color: #fff;
}

.doc-nav a.router-link-exact-active {
  background: #fff;
  color: var(--cv-blue);
}

.doc-main {
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 16px 60px;
}

@media (max-width: 760px) {
  .doc-header {
    position: static;
  }
}

@media print {
  .doc-shell {
    height: auto;
    overflow: visible;
  }

  .doc-header {
    position: static;
    box-shadow: none;
  }

  .doc-nav {
    display: none;
  }
}
</style>
