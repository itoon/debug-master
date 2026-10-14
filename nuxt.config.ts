// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  app: { head: { htmlAttrs: { lang: "th" } } },
  modules: ["@nuxtjs/tailwindcss"],
  runtimeConfig: { public: { liveUrl: "" } },
  // Live pages read the room code, host key and socket in the browser only: render them client-side,
  // and still emit /live/host and /live/screen as static pages (GitHub Pages has no server).
  routeRules: { "/live/**": { ssr: false } },
  nitro: { prerender: { routes: ["/live/host", "/live/screen"] } },
  css: ["~/assets/css/tailwind.css", "~/assets/css/board.css"],
});
