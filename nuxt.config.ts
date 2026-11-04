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
      // Codi Arena Scoreboard: one booth for the game, with a Board per home challenge (A beginner, B intermediate,
      // C pro). Public leaderboards are read from here; scores go through live-server, which holds the booth's bk_ key.
      // An empty URL or booth keeps the boards on the device. NUXT_PUBLIC_SCOREBOARD_URL / _BOOTH_ID override these.
      scoreboardUrl: process.env.NODE_ENV === "production" ? "https://codiarena-leaderboard-656350060084.asia-southeast3.run.app" : "http://localhost:3000",
      scoreboardBoothId: "debug-master",
    },
  },
  // Live pages and the Codi callback read the browser only: render them client-side,
  // and still emit them as static pages (GitHub Pages has no server).
  routeRules: { "/live/**": { ssr: false }, "/callback": { ssr: false } },
  nitro: { prerender: { routes: ["/live/host", "/live/screen", "/callback"] } },
  css: ["~/assets/css/tailwind.css", "~/assets/css/board.css", "~/assets/css/scrollbar.css"],
});
