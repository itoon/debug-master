import { describe, expect, it } from 'vitest'
import { rememberInitialSearch, takeInitialSearch } from '../../app/utils/live/initialSearch'

describe('initial page search', () => {
  it('hands out the search captured at startup once, then nothing', () => {
    rememberInitialSearch('?room=A12')
    expect(takeInitialSearch()).toBe('?room=A12')
    expect(takeInitialSearch()).toBeNull()
  })
  it('returns nothing when startup had no capture', () => {
    expect(takeInitialSearch()).toBeNull()
  })
})
