import { describe, expect, it } from 'vitest'
import type { PlayerHello } from '../../app/utils/live/protocol'
import { LIVE_PROTOCOL_VERSION } from '../../app/utils/live/protocol'
import { cleanName, parseClientMessage } from '../src/validate'

const hello = { type: 'hello', pid: 'pid-abc123', name: 'มิ้นท์🔥', avatarId: 'art-toy/10-party.svg', age: 9 }

describe('validate', () => {
  it('accepts a player hello and keeps a known avatar', () =>
    expect(parseClientMessage(JSON.stringify(hello), 'player')).toEqual(hello))
  it('replaces an unknown avatar with the default', () =>
    expect((parseClientMessage(JSON.stringify({ ...hello, avatarId: 'x.svg' }), 'player') as PlayerHello).avatarId).toBe('codi_default.svg'))
  it('accepts a Codi hello that has no age', () => {
    const { age: _age, ...withoutAge } = hello
    expect(parseClientMessage(JSON.stringify(withoutAge), 'player')).toEqual(withoutAge)
  })
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
  it('validates gameplay shape and refuses cumulative progress or forged fields', () => {
    const event = { type: 'gameplay', protocolVersion: LIVE_PROTOCOL_VERSION, roundId: 1,
      sessionId: 'server-session', sequence: 1, levelId: 1, at: 4000, action: 'ready' }
    expect(parseClientMessage(JSON.stringify(event), 'player')).toEqual(event)
    expect(parseClientMessage(JSON.stringify({ ...event, protocolVersion: 99 }), 'player')).toEqual({ ...event, protocolVersion: 99 })
    expect(parseClientMessage(JSON.stringify({ ...event, action: 'direction', direction: 'right' }), 'player')).toEqual({ ...event, action: 'direction', direction: 'right' })
    for (const invalid of [{ score: 100000 }, { stars: 3 }, { levelsCompleted: 50 }, { bestCombo: 50 },
      { sequence: 0 }, { sequence: 1.1 }, { at: -1 }, { at: 4000.1 }, { at: null },
      { action: 'direction' }, { action: 'direction', direction: 'diagonal' }, { direction: 'right' },
      { action: 'complete' }, { sessionId: '' }, { protocolVersion: '1' }]) {
      expect(parseClientMessage(JSON.stringify({ ...event, ...invalid }), 'player')).toBeNull()
    }
    expect(parseClientMessage(JSON.stringify(event), 'screen')).toBeNull()
    expect(parseClientMessage(JSON.stringify(event), 'host')).toBeNull()
    expect(parseClientMessage(JSON.stringify({ type: 'progress', roundId: 1, score: 10, levelsCompleted: 1, bestCombo: 3, combo: 3 }), 'player')).toBeNull()
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
