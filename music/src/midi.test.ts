import { describe, it, expect } from 'vitest'
import { quantize, quantizeNotes, onsetsToNotes, createMidiBuffer, GM_DRUMS } from './midi.js'

describe('quantize', () => {
  it('quantizes to nearest 16th note at 120 BPM', () => {
    // At 120 BPM, beat = 0.5s, 16th = 0.125s
    expect(quantize(0.13, 120, 16)).toBeCloseTo(0.125, 4)
    expect(quantize(0.0, 120, 16)).toBe(0)
    expect(quantize(0.5, 120, 16)).toBeCloseTo(0.5, 4)
  })

  it('quantizes to nearest 8th note', () => {
    expect(quantize(0.26, 120, 8)).toBeCloseTo(0.25, 4)
  })
})

describe('quantizeNotes', () => {
  it('removes duplicates on same grid position', () => {
    const notes = [
      { pitch: 42, start: 0.0, duration: 0.05, velocity: 100, channel: 9 },
      { pitch: 42, start: 0.01, duration: 0.05, velocity: 80, channel: 9 },
    ]
    const result = quantizeNotes(notes, 120, 16)
    expect(result.length).toBe(1)
  })

  it('keeps notes on different grid positions', () => {
    const notes = [
      { pitch: 42, start: 0.0, duration: 0.05, velocity: 100, channel: 9 },
      { pitch: 42, start: 0.25, duration: 0.05, velocity: 80, channel: 9 },
    ]
    const result = quantizeNotes(notes, 120, 16)
    expect(result.length).toBe(2)
  })
})

describe('onsetsToNotes', () => {
  it('converts onset times to MidiNote objects', () => {
    const onsets = [{ time: 0.0, velocity: 100 }, { time: 0.5, velocity: 80 }]
    const notes = onsetsToNotes(onsets, GM_DRUMS.CLOSED_HIHAT)
    expect(notes.length).toBe(2)
    expect(notes[0].pitch).toBe(42)
    expect(notes[0].channel).toBe(9)
  })
})

describe('createMidiBuffer', () => {
  it('creates valid MIDI file header', () => {
    const buf = createMidiBuffer({
      tempo: 120,
      tracks: [{ name: 'Test', notes: [], isDrum: true }],
    })
    expect(buf[0]).toBe(0x4D) // 'M'
    expect(buf[1]).toBe(0x54) // 'T'
    expect(buf[2]).toBe(0x68) // 'h'
    expect(buf[3]).toBe(0x64) // 'd'
  })

  it('creates a buffer with notes', () => {
    const buf = createMidiBuffer({
      tempo: 120,
      tracks: [{
        name: 'Drums',
        isDrum: true,
        notes: [
          { pitch: 36, start: 0, duration: 0.5, velocity: 100, channel: 9 },
          { pitch: 38, start: 0.5, duration: 0.5, velocity: 90, channel: 9 },
        ],
      }],
    })
    expect(buf.length).toBeGreaterThan(14) // header is 14 bytes minimum
  })

  it('includes tempo track', () => {
    const buf = createMidiBuffer({
      tempo: 120,
      tracks: [{ name: 'Test', notes: [], isDrum: true }],
    })
    // Format 1, 2 tracks (tempo + 1 data track)
    expect(buf[8]).toBe(0) // format high byte
    expect(buf[9]).toBe(1) // format 1
    expect(buf[10]).toBe(0) // track count high byte
    expect(buf[11]).toBe(2) // 2 tracks
  })
})

describe('GM_DRUMS', () => {
  it('has correct MIDI note numbers', () => {
    expect(GM_DRUMS.KICK).toBe(36)
    expect(GM_DRUMS.SNARE).toBe(38)
    expect(GM_DRUMS.CLOSED_HIHAT).toBe(42)
    expect(GM_DRUMS.OPEN_HIHAT).toBe(46)
    expect(GM_DRUMS.CRASH_1).toBe(49)
    expect(GM_DRUMS.RIDE).toBe(51)
  })
})
