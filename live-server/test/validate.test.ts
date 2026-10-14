import { describe, expect, it } from 'vitest'
import type { PlayerHello } from '../../app/utils/live/protocol'
import { MAX_LEVEL_MOVES } from '../../app/utils/live/protocol'
import { cleanName, parseClientMessage } from '../src/validate'

const hello = { type: 'hello', pid: 'pid-abc123', name: 'มิ้นท์🔥', avatarId: 'art-toy/10-party.svg', age: 9 }

describe('validate', () => {
  it('accepts a player hello and keeps a known avatar', () =>
    expect(parseClientMessage(JSON.stringify(hello), 'player')).toEqual(hello))
  it('replaces an unknown avatar with the default', () =>
    expect((parseClientMessage(JSON.stringify({ ...hello, avatarId: 'x.svg' }), 'player') as PlayerHello).avatarId).toBe('codi_default.svg'))
  it('rejects bad pid, empty name, bad age', () => {
    for (const bad of [{ pid: 'x' }, { name: '  \u0007 ' }, { age: 4 }, { age: 9.5 }])
      expect(parseClientMessage(JSON.stringify({ ...hello, ...bad }), 'player')).toBeNull()
  })
  it('never splits an emoji when trimming to 24 units', () => {
    const name = cleanName('ก'.repeat(23) + '🔥🔥')
    expect(name).toBe('ก'.repeat(23))
    expect(cleanName('a\u0000b   c')).toBe('ab c')
  })
  it('rejects host commands from players and screens', () => {
    expect(parseClientMessage('{"type":"start"}', 'player')).toBeNull()
    expect(parseClientMessage('{"type":"start"}', 'screen')).toBeNull()
    expect(parseClientMessage('{"type":"start"}', 'host')).toEqual({ type: 'start' })
  })
  it('validates host payloads', () => {
    expect(parseClientMessage('{"type":"setDuration","durationSec":59}', 'host')).toBeNull()
    expect(parseClientMessage('{"type":"setDuration","durationSec":901}', 'host')).toBeNull()
    expect(parseClientMessage('{"type":"setDuration","durationSec":600}', 'host')).toEqual({ type: 'setDuration', durationSec: 600 })
    expect(parseClientMessage('{"type":"setMode","mode":"D"}', 'host')).toBeNull()
  })
  it('rejects progress with combo above bestCombo or negative numbers', () => {
    const p = { type: 'progress', roundId: 1, score: 10, levelsCompleted: 1, bestCombo: 3, combo: 3 }
    expect(parseClientMessage(JSON.stringify(p), 'player')).toEqual(p)
    expect(parseClientMessage(JSON.stringify({ ...p, combo: 4 }), 'player')).toBeNull()
    expect(parseClientMessage(JSON.stringify({ ...p, score: -1 }), 'player')).toBeNull()
  })
  it('rejects a bestCombo above (levelsCompleted + 1) x MAX_LEVEL_MOVES', () => {
    const p = { type: 'progress', roundId: 1, score: 0, levelsCompleted: 0, bestCombo: MAX_LEVEL_MOVES, combo: 0 }
    expect(parseClientMessage(JSON.stringify(p), 'player')).toEqual(p)
    expect(parseClientMessage(JSON.stringify({ ...p, bestCombo: MAX_LEVEL_MOVES + 1 }), 'player')).toBeNull()
    const two = { ...p, levelsCompleted: 2, bestCombo: 3 * MAX_LEVEL_MOVES }
    expect(parseClientMessage(JSON.stringify(two), 'player')).toEqual(two)
    expect(parseClientMessage(JSON.stringify({ ...two, bestCombo: 3 * MAX_LEVEL_MOVES + 1 }), 'player')).toBeNull()
    // the huge combo that would lift the per-level score cap is refused
    expect(parseClientMessage(JSON.stringify({ ...p, levelsCompleted: 1, bestCombo: 1_000_000 }), 'player')).toBeNull()
  })
  it('rejects oversize, binary and non-JSON input', () => {
    expect(parseClientMessage('x'.repeat(2049), 'player')).toBeNull()
    expect(parseClientMessage(new ArrayBuffer(4), 'player')).toBeNull()
    expect(parseClientMessage('{nope', 'player')).toBeNull()
  })
  it('measures the size limit in UTF-8 bytes, not characters', () => {
    // 1000 Thai chars = 3000 bytes but only 1000 UTF-16 units
    const raw = JSON.stringify({ type: 'leave', pad: 'ก'.repeat(1000) })
    expect(raw.length).toBeLessThan(2048)
    expect(parseClientMessage(raw, 'player')).toBeNull()
  })
  it('screen and host may send a bare hello; players may leave', () => {
    expect(parseClientMessage('{"type":"hello"}', 'screen')).toEqual({ type: 'hello' })
    expect(parseClientMessage('{"type":"hello"}', 'host')).toEqual({ type: 'hello' })
    expect(parseClientMessage('{"type":"leave"}', 'player')).toEqual({ type: 'leave' })
    expect(parseClientMessage('{"type":"leave"}', 'screen')).toBeNull()
  })
  it('validates kick playerId', () => {
    expect(parseClientMessage('{"type":"kick","playerId":"pid-abc123"}', 'host')).toEqual({ type: 'kick', playerId: 'pid-abc123' })
    expect(parseClientMessage('{"type":"kick","playerId":"x"}', 'host')).toBeNull()
    // server-generated public ids are UUIDs
    const uuid = '0b6f7a2e-4c1d-4f7e-9a63-2d5c8e1f0a9b'
    expect(parseClientMessage(JSON.stringify({ type: 'kick', playerId: uuid }), 'host')).toEqual({ type: 'kick', playerId: uuid })
    expect(parseClientMessage('{"type":"kick","playerId":"bad id!"}', 'host')).toBeNull()
    expect(parseClientMessage('{"type":"kick","playerId":"pid-abc123"}', 'player')).toBeNull()
  })
})
