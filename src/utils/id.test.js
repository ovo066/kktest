import { describe, expect, it } from 'vitest'
import { makeId } from './id'

describe('makeId', () => {
  it('prefixes ids', () => {
    const id = makeId('msg')
    expect(id.startsWith('msg_')).toBe(true)
  })

  it('generates unique ids', () => {
    const set = new Set()
    for (let i = 0; i < 200; i += 1) {
      set.add(makeId('t'))
    }
    expect(set.size).toBe(200)
  })
})

