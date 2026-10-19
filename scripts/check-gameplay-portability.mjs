import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('gameplay stylesheet does not lock the host document', () => {
  const css = read('../app/assets/css/debug-theme.css')
  assert.doesNotMatch(css, /@tailwind/)
  assert.doesNotMatch(css, /html\s*,\s*body\s*,\s*#__nuxt/)
  assert.doesNotMatch(css, /^body\s*\{/m)
})

test('board and Codi selectors are limited to the Debug Master theme', () => {
  const css = read('../app/assets/css/board.css')
  for (const line of css.split(/\r?\n/)) {
    if (!/^\s*\.[\w-]/.test(line)) continue
    assert.match(line, /^\s*:where\(\.debug-master-theme\)\s+\./)
  }
  for (const [, name] of css.matchAll(/@keyframes\s+([\w-]+)/g)) {
    assert.match(name, /^debug-/)
  }
})

test('shared scrollbar rules stay inside the Debug Master theme', () => {
  const css = read('../app/assets/css/scrollbar.css')
  for (const line of css.split(/\r?\n/)) {
    if (!line.includes('.game-scrollbar')) continue
    assert.match(line, /:where\(\.debug-master-theme\)\s+\.game-scrollbar/)
  }
})

test('the extracted gameplay view owns the board and code window', () => {
  const component = read('../app/components/LevelGameplay.vue')
  assert.match(component, /<LevelBoard\b/)
  assert.match(component, /<LevelCode\b/)
  assert.match(component, /defineEmits/)
})
