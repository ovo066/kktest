import { describe, expect, it } from 'vitest'
import { useMeetParser } from './useMeetParser'

describe('useMeetParser dialog parsing', () => {
  it('parses bracket dialog with loose separators and resolves mapped character id', () => {
    const { parse } = useMeetParser()
    const instructions = parse('- [「小雨」]: 你好呀', {
      characters: [{ vnName: '小雨', contactId: 'c_1' }]
    })

    expect(instructions).toHaveLength(1)
    expect(instructions[0]).toMatchObject({
      type: 'dialog',
      vnName: '「小雨」',
      characterId: 'c_1',
      text: '你好呀'
    })
  })

  it('parses bracket dialog without mandatory whitespace', () => {
    const { parse } = useMeetParser()
    const instructions = parse('[小雨]你好', {
      characters: [{ vnName: '小雨', contactId: 'c_1' }]
    })

    expect(instructions[0]).toMatchObject({
      type: 'dialog',
      characterId: 'c_1',
      text: '你好'
    })
  })

  it('does not treat instruction keywords as old-style dialog names', () => {
    const { parse } = useMeetParser()
    const instructions = parse('location: 校园门口')

    expect(instructions[0]).toMatchObject({
      type: 'narration',
      text: 'location: 校园门口'
    })
  })
})
