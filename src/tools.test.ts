import { describe, it, expect, afterAll } from "vitest";
import {
  abletonStatus,
  abletonOpen,
  abletonGetSessionInfo,
  abletonGetTrackInfo,
  abletonGetBrowserCategories,
  abletonGetBrowserItems,
  abletonCreateMidiTrack,
  abletonCreateAudioTrack,
  abletonSetTrackName,
  abletonCreateClip,
  abletonAddNotesToClip,
  abletonSetClipName,
  abletonSetTempo,
  abletonFireClip,
  abletonStopClip,
  abletonStartPlayback,
  abletonStopPlayback,
  abletonDeleteTrack,
  abletonSetTrackMute,
  abletonSetTrackSolo,
  abletonSetTrackArm,
  abletonStopAllClips,
  abletonUndoRedo,
} from "./tools.js";
import { getConnection } from "./ableton-service.js";

/*
 * Acceptance tests — require a running Ableton Live instance with the
 * AbletonJS MIDI Remote Script enabled.
 *
 * Run with: ABLETON=1 pnpm test -- src/ableton
 */
const SKIP = !process.env.ABLETON;

describe.skipIf(SKIP)("Ableton tools", () => {
  afterAll(async () => {
    await getConnection().close();
  });

  // -- Connection --

  it("reports connected status", async () => {
    const result = (await abletonStatus.handler({})) as any;
    expect(result.connected).toBe(true);
    expect(result.tempo).toBeGreaterThan(0);
  });

  // -- Session Info --

  it("returns session info with expected fields", async () => {
    const result = (await abletonGetSessionInfo.handler({})) as any;
    expect(result.tempo).toBeGreaterThan(0);
    expect(result.time_signature).toMatch(/^\d+\/\d+$/);
    expect(typeof result.is_playing).toBe("boolean");
    expect(result.track_count).toBeGreaterThan(0);
  });

  // -- Track Info --

  it("returns track details for a valid index", async () => {
    const result = (await abletonGetTrackInfo.handler({ track_index: 0 })) as any;
    expect(result.name).toBeTruthy();
    expect(typeof result.mute).toBe("boolean");
    expect(typeof result.solo).toBe("boolean");
    expect(Array.isArray(result.clip_slots)).toBe(true);
    expect(Array.isArray(result.devices)).toBe(true);
  });

  it("throws on out-of-range track index", async () => {
    await expect(abletonGetTrackInfo.handler({ track_index: 9999 })).rejects.toThrow("out of range");
  });

  // -- Browser --

  it("lists browser categories with items", async () => {
    const result = (await abletonGetBrowserCategories.handler({})) as any;
    expect(result.instruments.length).toBeGreaterThan(0);
    expect(result.audio_effects.length).toBeGreaterThan(0);
    expect(result.instruments[0].name).toBeTruthy();
  });

  it("lists browser items for a category", async () => {
    const result = (await abletonGetBrowserItems.handler({ category: "instruments" })) as any;
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].name).toBeTruthy();
  });

  // -- Tempo --

  it("sets and restores tempo", async () => {
    const before = (await abletonGetSessionInfo.handler({})) as any;
    await abletonSetTempo.handler({ tempo: 142 });
    const during = (await abletonGetSessionInfo.handler({})) as any;
    expect(during.tempo).toBe(142);
    await abletonSetTempo.handler({ tempo: before.tempo });
  });

  // -- MIDI Track CRUD --

  it("creates, renames, mutes, solos, arms, and deletes a MIDI track", async () => {
    const before = (await abletonGetSessionInfo.handler({})) as any;

    // Create
    const created = (await abletonCreateMidiTrack.handler({})) as any;
    expect(created.id).toBeTruthy();
    const afterCreate = (await abletonGetSessionInfo.handler({})) as any;
    expect(afterCreate.track_count).toBe(before.track_count + 1);
    const idx = afterCreate.track_count - 1;

    // Rename
    await abletonSetTrackName.handler({ track_index: idx, name: "Test Track" });
    let info = (await abletonGetTrackInfo.handler({ track_index: idx })) as any;
    expect(info.name).toBe("Test Track");

    // Mute
    await abletonSetTrackMute.handler({ track_index: idx, mute: true });
    info = (await abletonGetTrackInfo.handler({ track_index: idx })) as any;
    expect(info.mute).toBe(true);
    await abletonSetTrackMute.handler({ track_index: idx, mute: false });

    // Solo
    await abletonSetTrackSolo.handler({ track_index: idx, solo: true });
    info = (await abletonGetTrackInfo.handler({ track_index: idx })) as any;
    expect(info.solo).toBe(true);
    await abletonSetTrackSolo.handler({ track_index: idx, solo: false });

    // Arm
    await abletonSetTrackArm.handler({ track_index: idx, arm: true });
    await abletonSetTrackArm.handler({ track_index: idx, arm: false });

    // Delete
    await abletonDeleteTrack.handler({ track_index: idx });
    const afterDelete = (await abletonGetSessionInfo.handler({})) as any;
    expect(afterDelete.track_count).toBe(before.track_count);
  });

  // -- Audio Track CRUD --

  it("creates and deletes an audio track", async () => {
    const before = (await abletonGetSessionInfo.handler({})) as any;
    const created = (await abletonCreateAudioTrack.handler({})) as any;
    expect(created.id).toBeTruthy();
    const after = (await abletonGetSessionInfo.handler({})) as any;
    expect(after.track_count).toBe(before.track_count + 1);
    await abletonDeleteTrack.handler({ track_index: after.track_count - 1 });
  });

  // -- Clip lifecycle --

  it("creates a clip, adds notes, renames it, fires it, and stops it", async () => {
    // Set up a MIDI track
    await abletonCreateMidiTrack.handler({});
    const info = (await abletonGetSessionInfo.handler({})) as any;
    const idx = info.track_count - 1;

    try {
      // Create clip
      await abletonCreateClip.handler({ track_index: idx, clip_index: 0, length: 4 });
      let track = (await abletonGetTrackInfo.handler({ track_index: idx })) as any;
      expect(track.clip_slots[0].has_clip).toBe(true);

      // Add notes
      const result = (await abletonAddNotesToClip.handler({
        track_index: idx,
        clip_index: 0,
        notes: [
          { pitch: 60, time: 0, duration: 0.5, velocity: 100 },
          { pitch: 64, time: 0.5, duration: 0.5, velocity: 90 },
          { pitch: 67, time: 1, duration: 1, velocity: 80 },
        ],
      })) as any;
      expect(result.notes_added).toBe(3);

      // Rename clip
      await abletonSetClipName.handler({ track_index: idx, clip_index: 0, name: "Test Clip" });
      track = (await abletonGetTrackInfo.handler({ track_index: idx })) as any;
      expect(track.clip_slots[0].name).toBe("Test Clip");

      // Fire clip
      await abletonFireClip.handler({ track_index: idx, clip_index: 0 });
      await new Promise((r) => setTimeout(r, 500));

      // Stop clip
      await abletonStopClip.handler({ track_index: idx, clip_index: 0 });
    } finally {
      await abletonDeleteTrack.handler({ track_index: idx });
    }
  });

  it("throws when adding notes to an empty clip slot", async () => {
    await abletonCreateMidiTrack.handler({});
    const info = (await abletonGetSessionInfo.handler({})) as any;
    const idx = info.track_count - 1;
    try {
      await expect(
        abletonAddNotesToClip.handler({ track_index: idx, clip_index: 0, notes: [{ pitch: 60, time: 0, duration: 1 }] }),
      ).rejects.toThrow("No clip");
    } finally {
      await abletonDeleteTrack.handler({ track_index: idx });
    }
  });

  // -- Playback --

  it("starts and stops playback", async () => {
    await abletonStartPlayback.handler({});
    let session = (await abletonGetSessionInfo.handler({})) as any;
    expect(session.is_playing).toBe(true);

    await abletonStopPlayback.handler({});
    session = (await abletonGetSessionInfo.handler({})) as any;
    expect(session.is_playing).toBe(false);
  });

  it("stops all clips", async () => {
    const result = (await abletonStopAllClips.handler({})) as any;
    expect(result.stopped).toBe(true);
  });

  // -- Undo --

  it("undoes the last action", async () => {
    // Make a change to undo
    await abletonSetTempo.handler({ tempo: 133 });
    const result = (await abletonUndoRedo.handler({})) as any;
    expect(result.undone).toBe(true);
  }, 10000);

  // -- Open --

  it("opens Ableton without error when already running", async () => {
    const result = (await abletonOpen.handler({})) as any;
    expect(result.opened).toBe(true);
  });
});
