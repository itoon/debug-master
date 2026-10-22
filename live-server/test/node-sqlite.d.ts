// Archive tests run the real D1 migration on Node's built-in SQLite; production Worker compilation has no Node globals.
declare module 'node:sqlite' {
  export class StatementSync {
    run(...values: unknown[]): unknown
    all(...values: unknown[]): Record<string, unknown>[]
  }
  export class DatabaseSync {
    constructor(path: string)
    exec(sql: string): void
    prepare(sql: string): StatementSync
  }
}

declare module 'node:fs' {
  export function readFileSync(path: URL, encoding: 'utf8'): string
}

interface ImportMeta {
  readonly url: string
}
