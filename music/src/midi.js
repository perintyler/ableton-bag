import { writeFile } from 'node:fs/promises';
/**
 * General MIDI Drum Map (Channel 10)
 * https://www.midi.org/specifications-old/item/gm-level-1-sound-set
 */
export const GM_DRUMS = {
    KICK: 36,
    SNARE: 38,
    SIDE_STICK: 37,
    CLOSED_HIHAT: 42,
    OPEN_HIHAT: 46,
    PEDAL_HIHAT: 44,
    CRASH_1: 49,
    CRASH_2: 57,
    RIDE: 51,
    RIDE_BELL: 53,
    HIGH_TOM: 50,
    MID_TOM: 47,
    LOW_TOM: 45,
    FLOOR_TOM: 43,
    CLAP: 39,
    RIMSHOT: 37,
    COWBELL: 56,
    TAMBOURINE: 54,
};
/**
 * Quantize a time value to the nearest grid division.
 */
export function quantize(timeInSeconds, tempo, division = 16) {
    const beatDuration = 60 / tempo;
    const gridSize = (beatDuration * 4) / division; // grid in seconds
    return Math.round(timeInSeconds / gridSize) * gridSize;
}
/**
 * Quantize an array of notes to the tempo grid, removing duplicates
 * that land on the same grid position.
 */
export function quantizeNotes(notes, tempo, division = 16) {
    const seen = new Set();
    const result = [];
    for (const note of notes) {
        const qStart = quantize(note.start, tempo, division);
        const key = `${note.pitch}:${qStart.toFixed(6)}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push({ ...note, start: qStart });
    }
    return result.sort((a, b) => a.start - b.start);
}
/**
 * Convert onset times and velocities into MidiNote objects.
 */
export function onsetsToNotes(onsets, pitch, options) {
    const duration = options?.duration ?? 0.05;
    const channel = options?.channel ?? 9;
    return onsets.map((onset) => ({
        pitch,
        start: onset.time,
        duration,
        velocity: onset.velocity ?? 100,
        channel,
    }));
}
// --- Standard MIDI File Writer ---
function writeVarLen(value) {
    if (value < 0)
        throw new Error('Negative var-length value');
    const bytes = [];
    bytes.unshift(value & 0x7f);
    value >>= 7;
    while (value > 0) {
        bytes.unshift((value & 0x7f) | 0x80);
        value >>= 7;
    }
    return bytes;
}
function stringToBytes(str) {
    return Array.from(Buffer.from(str, 'ascii'));
}
function uint16BE(value) {
    return [(value >> 8) & 0xff, value & 0xff];
}
function uint32BE(value) {
    return [
        (value >> 24) & 0xff,
        (value >> 16) & 0xff,
        (value >> 8) & 0xff,
        value & 0xff,
    ];
}
function buildTrackChunk(events) {
    return [
        ...stringToBytes('MTrk'),
        ...uint32BE(events.length),
        ...events,
    ];
}
/**
 * Create a Standard MIDI File (SMF Format 1) from tracks.
 * Returns a Buffer that can be written to a .mid file.
 */
export function createMidiBuffer(options) {
    const { tempo, tracks, timeSignature = [4, 4] } = options;
    const ticksPerBeat = 480;
    // Header chunk: Format 1, N+1 tracks (tempo track + data tracks), 480 ticks/beat
    const header = [
        ...stringToBytes('MThd'),
        ...uint32BE(6),
        ...uint16BE(1), // format 1
        ...uint16BE(tracks.length + 1), // track count (includes tempo track)
        ...uint16BE(ticksPerBeat),
    ];
    // Tempo track
    const tempoMicros = Math.round(60_000_000 / tempo);
    const tempoTrackEvents = [
        // Time signature meta event at tick 0
        ...writeVarLen(0),
        0xff, 0x58, 0x04,
        timeSignature[0],
        Math.log2(timeSignature[1]),
        24, 8,
        // Tempo meta event at tick 0
        ...writeVarLen(0),
        0xff, 0x51, 0x03,
        (tempoMicros >> 16) & 0xff,
        (tempoMicros >> 8) & 0xff,
        tempoMicros & 0xff,
        // End of track
        ...writeVarLen(0),
        0xff, 0x2f, 0x00,
    ];
    const allChunks = [...header, ...buildTrackChunk(tempoTrackEvents)];
    for (const track of tracks) {
        const channel = track.isDrum ? 9 : (track.notes[0]?.channel ?? 0);
        const events = [];
        // Track name meta event
        const nameBytes = stringToBytes(track.name);
        events.push(...writeVarLen(0), 0xff, 0x03, ...writeVarLen(nameBytes.length), ...nameBytes);
        // Sort notes by start time
        const sorted = [...track.notes].sort((a, b) => a.start - b.start);
        const timedEvents = [];
        for (const note of sorted) {
            const startTick = Math.round(note.start * (ticksPerBeat * tempo) / 60);
            const endTick = Math.round((note.start + note.duration) * (ticksPerBeat * tempo) / 60);
            const ch = note.channel ?? channel;
            const vel = Math.max(0, Math.min(127, Math.round(note.velocity)));
            timedEvents.push({ tick: startTick, data: [0x90 | ch, note.pitch, vel] }, { tick: endTick, data: [0x80 | ch, note.pitch, 0] });
        }
        // Sort by tick, note-offs before note-ons at same tick
        timedEvents.sort((a, b) => {
            if (a.tick !== b.tick)
                return a.tick - b.tick;
            const aIsOff = (a.data[0] & 0xf0) === 0x80 ? 0 : 1;
            const bIsOff = (b.data[0] & 0xf0) === 0x80 ? 0 : 1;
            return aIsOff - bIsOff;
        });
        // Convert to delta-time events
        let lastTick = 0;
        for (const evt of timedEvents) {
            const delta = evt.tick - lastTick;
            events.push(...writeVarLen(delta), ...evt.data);
            lastTick = evt.tick;
        }
        // End of track
        events.push(...writeVarLen(0), 0xff, 0x2f, 0x00);
        allChunks.push(...buildTrackChunk(events));
    }
    return Buffer.from(allChunks);
}
/**
 * Write a MIDI file to disk.
 */
export async function writeMidiFile(path, options) {
    const buffer = createMidiBuffer(options);
    await writeFile(path, buffer);
    return path;
}
/**
 * Create a simple drum pattern MIDI file from onset data.
 * Convenience function combining onsetsToNotes + quantizeNotes + writeMidiFile.
 */
export async function writeOnsetsMidi(path, onsets, options) {
    const { tempo, pitch = GM_DRUMS.CLOSED_HIHAT, trackName = 'Onsets', quantizeTo = 16, } = options;
    let notes = onsetsToNotes(onsets, pitch);
    notes = quantizeNotes(notes, tempo, quantizeTo);
    return writeMidiFile(path, {
        tempo,
        tracks: [{ name: trackName, notes, isDrum: true }],
    });
}
