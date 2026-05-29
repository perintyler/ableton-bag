import { describe, it, expect, afterAll } from 'vitest'
import { quantize, quantizeNotes, onsetsToNotes, createMidiBuffer, writeMidiFile, writeOnsetsMidi, GM_DRUMS } from './midi.js'
import { existsSync, unlinkSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

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

// --- writeMidiFile and writeOnsetsMidi tests ---

const midiTestDir = join(tmpdir(), `midi-test-${Date.now()}`)
const writeMidiPath = join(midiTestDir, 'test-write.mid')
const onsetsMidiPath = join(midiTestDir, 'test-onsets.mid')

import { mkdirSync } from 'node:fs'
mkdirSync(midiTestDir, { recursive: true })

afterAll(() => {
  for (const f of [writeMidiPath, onsetsMidiPath]) {
    if (existsSync(f)) {
      try { unlinkSync(f) } catch { /* ignore */ }
    }
  }
  try { require('node:fs').rmdirSync(midiTestDir) } catch { /* ignore */ }
})

describe('writeMidiFile', () => {
  it('writes a file that exists and has correct MThd header bytes', async () => {
    const result = await writeMidiFile(writeMidiPath, {
      tempo: 120,
      tracks: [{
        name: 'Kick',
        isDrum: true,
        notes: [
          { pitch: 36, start: 0, duration: 0.25, velocity: 100, channel: 9 },
          { pitch: 36, start: 0.5, duration: 0.25, velocity: 90, channel: 9 },
        ],
      }],
    })

    expect(result).toBe(writeMidiPath)
    expect(existsSync(writeMidiPath)).toBe(true)

    // Verify MIDI header magic bytes: "MThd"
    const bytes = readFileSync(writeMidiPath)
    expect(bytes[0]).toBe(0x4D) // M
    expect(bytes[1]).toBe(0x54) // T
    expect(bytes[2]).toBe(0x68) // h
    expect(bytes[3]).toBe(0x64) // d

    // Header chunk size should be 6
    expect(bytes[7]).toBe(6)

    // File should contain at least one MTrk chunk
    const content = bytes.toString('ascii')
    expect(content).toContain('MTrk')
  })
})

describe('writeOnsetsMidi', () => {
  it('creates a file with expected MIDI structure', async () => {
    const onsets = [
      { time: 0.0, velocity: 100 },
      { time: 0.25, velocity: 80 },
      { time: 0.5, velocity: 110 },
      { time: 0.75, velocity: 90 },
    ]

    const result = await writeOnsetsMidi(onsetsMidiPath, onsets, {
      tempo: 120,
      pitch: GM_DRUMS.CLOSED_HIHAT,
      trackName: 'HiHats',
      quantizeTo: 16,
    })

    expect(result).toBe(onsetsMidiPath)
    expect(existsSync(onsetsMidiPath)).toBe(true)

    const bytes = readFileSync(onsetsMidiPath)
    // Valid MIDI header
    expect(bytes[0]).toBe(0x4D)
    expect(bytes[1]).toBe(0x54)
    expect(bytes[2]).toBe(0x68)
    expect(bytes[3]).toBe(0x64)

    // Should be non-trivial size (header + tempo track + data track)
    expect(bytes.length).toBeGreaterThan(50)
  })
})
