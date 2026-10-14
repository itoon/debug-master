// The query string the page was opened with, captured before hydration.
// The prerendered Pages build hydrates "/" with its query-less prerendered route and temporarily
// rewrites the browser URL until after mount, so `?room=` is invisible to onMounted.
// app/plugins/live-initial-search.client.ts records it at startup; the game page takes it once.

let initialSearch: string | null = null

export function rememberInitialSearch(search: string): void {
  initialSearch = search
}

/** The captured search on the first call, then null (later visits read the live URL). */
export function takeInitialSearch(): string | null {
  const search = initialSearch
  initialSearch = null
  return search
}
