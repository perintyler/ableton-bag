import { describe, it, expect } from 'vitest'
import { drumNotesToBatches, type AbletonNote } from './drum-parts.js'

function makeNotes(count: number): AbletonNote[] {
  return Array.from({ length: count }, (_, i) => ({
    pitch: 36,
    time: i * 0.25,
    duration: 0.25,
    velocity: 100,
  }))
}

describe('drumNotesToBatches', () => {
  it('splits 500 notes into 3 batches of 200+200+100', () => {
    const notes = makeNotes(500)
    const batches = drumNotesToBatches(notes, 200)

    expect(batches.length).toBe(3)
    expect(batches[0].length).toBe(200)
    expect(batches[1].length).toBe(200)
    expect(batches[2].length).toBe(100)

    // Verify all notes are preserved
    const total = batches.reduce((sum, b) => sum + b.length, 0)
    expect(total).toBe(500)
  })

  it('returns empty array for empty input', () => {
    const batches = drumNotesToBatches([])
    expect(batches).toEqual([])
  })

  it('handles batch size 1 — returns individual notes', () => {
    const notes = makeNotes(5)
    const batches = drumNotesToBatches(notes, 1)

    expect(batches.length).toBe(5)
    for (const batch of batches) {
      expect(batch.length).toBe(1)
    }
  })

  it('uses default batch size of 200', () => {
    const notes = makeNotes(300)
    const batches = drumNotesToBatches(notes)

    expect(batches.length).toBe(2)
    expect(batches[0].length).toBe(200)
    expect(batches[1].length).toBe(100)
  })

  it('returns single batch when notes fit within batch size', () => {
    const notes = makeNotes(50)
    const batches = drumNotesToBatches(notes, 200)

    expect(batches.length).toBe(1)
    expect(batches[0].length).toBe(50)
  })
})
