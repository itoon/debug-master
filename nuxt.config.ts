// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  app: { head: { htmlAttrs: { lang: "th" } } },
  modules: ["@nuxtjs/tailwindcss"],
  css: ["~/assets/css/tailwind.css", "~/assets/css/board.css"],
});
