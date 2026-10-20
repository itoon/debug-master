// Capacity tests use this Node builtin at runtime; production Worker compilation has no Node globals.
declare module 'node:v8' {
  export function serialize(value: unknown): Uint8Array
}
