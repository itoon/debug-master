// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  app: { head: { htmlAttrs: { lang: "th" } } },
  modules: ["@nuxtjs/tailwindcss"],
  runtimeConfig: {
    public: {
      liveUrl: "",
      codiIssuer: "https://codi-arena-hub.innovasive.workers.dev",
      codiClientId: "cva_zlfJ437Zr3GMa4ps",
    },
  },
  // Live pages and the Codi callback read the browser only: render them client-side,
  // and still emit them as static pages (GitHub Pages has no server).
  routeRules: { "/live/**": { ssr: false }, "/callback": { ssr: false } },
  nitro: { prerender: { routes: ["/live/host", "/live/screen", "/callback"] } },
  css: ["~/assets/css/tailwind.css", "~/assets/css/board.css", "~/assets/css/scrollbar.css"],
});
