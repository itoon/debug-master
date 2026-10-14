import { rememberInitialSearch } from "../utils/live/initialSearch";

// Runs before Nuxt's `app:created` hook swaps the URL to the prerendered route (see utils/live/initialSearch.ts).
export default defineNuxtPlugin(() => {
  rememberInitialSearch(window.location.search);
});
