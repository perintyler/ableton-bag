import { defineTool } from "@barry/tools";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { getConnection } from "./ableton-service.js";
import { Browser } from "ableton-js/ns/browser";
import { BrowserItem } from "ableton-js/ns/browser-item";
import {
  analyzeTimbre,
  compareTimbre,
  suggestMacroValues,
  spectralCorrectionCurve,
  extractDrumMidi,
  drumNotesToBatches,
  timbreSimilarity,
  extractDrumFeatures,
  drumFeatureDistance,
  detectHarshness,
  detectClashes,
  type AbletonNote,
  type AudioAnalysisResult,
  type ClashSource,
} from "@barry/music";

const execFileAsync = promisify(execFile);

function svc() {
  return getConnection();
}

// -- Status & Launch --

export const abletonStatus = defineTool({
  namespace: "ableton",
  access: "read",
  name: "ableton_status",
  description: "Check connection status to Ableton Live. Returns whether the ableton-js MIDI Remote Script is reachable.",
  schema: {},
  handler: async () => {
    const service = svc();
    try {
      const ab = await service.ensureConnected();
      const tempo = await ab.song.get("tempo");
      return { connected: true, tempo };
    } catch (err) {
      return { connected: false, error: (err as Error).message };
    }
  },
});

export const abletonOpen = defineTool({
  namespace: "ableton",
  access: "write",
  name: "open_ableton",
  description: "Open Ableton Live. If a project path is provided, opens that project; otherwise launches Ableton with no project.",
  schema: {
    project_path: z.string().optional().describe("Path to an .als project file to open"),
  },
  handler: async ({ project_path }) => {
    const app = process.env.ABLETON_APP || "Ableton Live 11 Suite";
    const args = ["-a", app];
    if (project_path) args.push(project_path);
    await execFileAsync("open", args);
    return { opened: true, project: project_path ?? null };
  },
});

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAppleScript(script: string): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  return stdout.trim();
}

async function click(x: number, y: number): Promise<void> {
  await execFileAsync("cliclick", ["c:" + Math.round(x) + "," + Math.round(y)]);
}

export const abletonSetup = defineTool({
  namespace: "ableton",
  access: "write",
  name: "setup_ableton",
  description:
    "Automate enabling the AbletonJS MIDI Remote Script as a Control Surface in Ableton Live's preferences. " +
    "Uses cliclick and AppleScript to navigate the Preferences UI. Requires cliclick to be installed (brew install cliclick).",
  schema: {},
  handler: async () => {
    // 1. Check cliclick is installed
    try {
      await execFileAsync("which", ["cliclick"]);
    } catch {
      return {
        success: false,
        error: "cliclick is not installed. Run: brew install cliclick",
      };
    }

    const app = process.env.ABLETON_APP || "Ableton Live 11 Suite";

    // 2. Ensure Ableton is running
    try {
      const { stdout } = await execFileAsync("pgrep", ["-x", "Live"]);
      if (!stdout.trim()) throw new Error("not running");
    } catch {
      await execFileAsync("open", ["-a", app]);
      await sleep(5000);
    }

    // 3. Bring Ableton to the front
    await runAppleScript(
      'tell application "System Events" to tell process "Live" to set frontmost to true',
    );
    await sleep(500);

    // 4. Open Preferences with Cmd+,
    await runAppleScript(
      'tell application "System Events" to keystroke "," using command down',
    );
    await sleep(1500);

    // 5. Get Preferences window position and click the Link Tempo MIDI tab
    let winX: number;
    let winY: number;
    try {
      const posStr = await runAppleScript(
        'tell application "System Events" to tell process "Live" to get position of window "Preferences"',
      );
      const parts = posStr.split(",").map((s) => parseInt(s.trim(), 10));
      winX = parts[0];
      winY = parts[1];
    } catch (err) {
      return {
        success: false,
        error: `Failed to get Preferences window position: ${(err as Error).message}`,
      };
    }

    // Click the "Link Tempo MIDI" tab (left column, approximately x+40, y+107)
    await click(winX + 40, winY + 107);
    await sleep(1000);

    // 6. Click the first Control Surface dropdown (approximately x+170, y+224)
    await click(winX + 170, winY + 224);
    await sleep(800);

    // 7. Press arrow-down once then Return to select "AbletonJS" (first item after "None")
    await runAppleScript(
      'tell application "System Events" to key code 125',
    );
    await sleep(200);
    await runAppleScript(
      'tell application "System Events" to key code 36',
    );
    await sleep(2000);

    // 8. Close Preferences
    await runAppleScript(
      'tell application "System Events" to keystroke "," using command down',
    );
    await sleep(3000);

    // 9. Try to connect to the Remote Script
    try {
      await svc().ensureConnected();
      return { success: true, message: "AbletonJS Control Surface enabled and connected." };
    } catch (err) {
      return {
        success: false,
        error: `Control Surface was configured but connection failed: ${(err as Error).message}`,
      };
    }
  },
});

// -- Read Tools --

export const abletonGetSessionInfo = defineTool({
  namespace: "ableton",
  access: "read",
  name: "ableton_get_session_info",
  description: "Get Ableton Live session info: tempo, time signature, track count, is_playing, song length, and more.",
  schema: {},
  handler: async () => {
    const ab = await svc().ensureConnected();
    const [tempo, sigNum, sigDen, isPlaying, songLength, tracks, returnTracks] = await Promise.all([
      ab.song.get("tempo"),
      ab.song.get("signature_numerator"),
      ab.song.get("signature_denominator"),
      ab.song.get("is_playing"),
      ab.song.get("song_length"),
      ab.song.get("tracks"),
      ab.song.get("return_tracks"),
    ]);
    return {
      tempo,
      time_signature: `${sigNum}/${sigDen}`,
      is_playing: isPlaying,
      song_length: songLength,
      track_count: tracks.length,
      return_track_count: returnTracks.length,
    };
  },
});

export const abletonGetTrackInfo = defineTool({
  namespace: "ableton",
  access: "read",
  name: "get_track_info",
  description: "Get detailed info about a track: name, clips, devices, mute/solo/arm state, and clip slots.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
  },
  handler: async ({ track_index }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const track = tracks[track_index];
    const [clipSlots, devices, name, mute, solo, arm] = await Promise.all([
      track.get("clip_slots"),
      track.get("devices"),
      track.get("name"),
      track.get("mute"),
      track.get("solo"),
      track.get("arm").catch(() => false),
    ]);
    const clipSlotInfo = await Promise.all(
      clipSlots.map(async (cs) => {
        const hasClip = await cs.get("has_clip");
        if (!hasClip) return { has_clip: false };
        const clip = await cs.get("clip");
        if (!clip) return { has_clip: false };
        const [clipName, length, isPlaying] = await Promise.all([
          clip.get("name"),
          clip.get("length"),
          clip.get("is_playing"),
        ]);
        return { has_clip: true, name: clipName, length, is_playing: isPlaying };
      })
    );
    return {
      name,
      mute,
      solo,
      arm,
      device_count: devices.length,
      devices: devices.map((d) => ({ id: d.raw.id, name: d.raw.name })),
      clip_slots: clipSlotInfo,
    };
  },
});

export const abletonGetBrowserCategories = defineTool({
  namespace: "ableton",
  access: "read",
  name: "get_browser_categories",
  description: "List the top-level browser categories: instruments, audio_effects, drums, midi_effects, sounds, packs, plugins, samples, clips, etc.",
  schema: {},
  handler: async () => {
    const ab = await svc().ensureConnected();
    const browser = ab.internal;
    // The browser is available via ab.song but categories are accessed via the internal API
    // Use the direct browser namespace
    const categories = [
      "instruments", "audio_effects", "drums", "midi_effects",
      "sounds", "packs", "plugins", "samples", "clips",
    ] as const;
    const results: Record<string, { name: string; children_count: number }[]> = {};
    for (const cat of categories) {
      try {
        const items = await ab.sendCachedCommand({ ns: "browser", name: "get_prop", args: { prop: cat } });
        results[cat] = Array.isArray(items) ? items.map((item: any) => ({
          name: item.name,
          children_count: item.children?.length ?? 0,
        })) : [];
      } catch {
        results[cat] = [];
      }
    }
    return results;
  },
});

export const abletonGetBrowserItems = defineTool({
  namespace: "ableton",
  access: "read",
  name: "get_browser_items",
  description: "Browse items in a specific browser category. Returns names, URIs, and whether items are loadable.",
  schema: {
    category: z.enum([
      "instruments", "audio_effects", "drums", "midi_effects",
      "sounds", "packs", "plugins", "samples", "clips",
    ]).describe("Browser category to list items from"),
  },
  handler: async ({ category }) => {
    const ab = await svc().ensureConnected();
    const items = await ab.sendCachedCommand({ ns: "browser", name: "get_prop", args: { prop: category } });
    if (!Array.isArray(items)) return { items: [] };
    return {
      items: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        uri: item.uri,
        is_loadable: item.is_loadable,
        is_folder: item.is_folder,
        children_count: item.children?.length ?? 0,
      })),
    };
  },
});

// -- Write Tools --

export const abletonCreateMidiTrack = defineTool({
  namespace: "ableton",
  access: "write",
  name: "create_midi_track",
  description: "Create a new MIDI track in the Ableton session.",
  schema: {
    index: z.number().optional().describe("Position to insert the track (default: end)"),
  },
  handler: async ({ index }) => {
    const ab = await svc().ensureConnected();
    const track = await ab.song.createMidiTrack(index ?? -1);
    return { id: track.raw.id, name: track.raw.name };
  },
});

export const abletonCreateAudioTrack = defineTool({
  namespace: "ableton",
  access: "write",
  name: "create_audio_track",
  description: "Create a new audio track in the Ableton session.",
  schema: {
    index: z.number().optional().describe("Position to insert the track (default: end)"),
  },
  handler: async ({ index }) => {
    const ab = await svc().ensureConnected();
    const track = await ab.song.createAudioTrack(index ?? -1);
    return { id: track.raw.id, name: track.raw.name };
  },
});

export const abletonSetTrackName = defineTool({
  namespace: "ableton",
  access: "write",
  name: "set_track_name",
  description: "Rename a track in the Ableton session.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    name: z.string().describe("New name for the track"),
  },
  handler: async ({ track_index, name }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    await tracks[track_index].set("name", name);
    return { track_index, name };
  },
});

export const abletonCreateClip = defineTool({
  namespace: "ableton",
  access: "write",
  name: "create_clip",
  description: "Create a new empty MIDI clip in a track's clip slot.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    clip_index: z.number().describe("Zero-based index of the clip slot"),
    length: z.number().optional().describe("Length of the clip in beats (default: 4)"),
  },
  handler: async ({ track_index, clip_index, length }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const clipSlots = await tracks[track_index].get("clip_slots");
    if (clip_index < 0 || clip_index >= clipSlots.length) {
      throw new Error(`Clip slot index ${clip_index} out of range (0-${clipSlots.length - 1})`);
    }
    await clipSlots[clip_index].createClip(length ?? 4);
    return { track_index, clip_index, length: length ?? 4 };
  },
});

export const abletonAddNotesToClip = defineTool({
  namespace: "ableton",
  access: "write",
  name: "add_notes_to_clip",
  description: "Add MIDI notes to an existing clip. Each note has pitch, time (start in beats), duration, and velocity.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    clip_index: z.number().describe("Zero-based index of the clip slot"),
    notes: z.array(z.object({
      pitch: z.number().min(0).max(127).describe("MIDI note number (0-127, e.g. 60 = C4)"),
      time: z.number().describe("Start time in beats"),
      duration: z.number().describe("Duration in beats"),
      velocity: z.number().min(0).max(127).optional().describe("Note velocity (0-127, default: 100)"),
    })).describe("Array of MIDI notes to add"),
  },
  handler: async ({ track_index, clip_index, notes }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const clipSlots = await tracks[track_index].get("clip_slots");
    if (clip_index < 0 || clip_index >= clipSlots.length) {
      throw new Error(`Clip slot index ${clip_index} out of range (0-${clipSlots.length - 1})`);
    }
    const clip = await clipSlots[clip_index].get("clip");
    if (!clip) throw new Error(`No clip in slot ${clip_index} of track ${track_index}`);

    const formattedNotes = notes.map((n) => ({
      pitch: n.pitch,
      time: n.time,
      duration: n.duration,
      velocity: n.velocity ?? 100,
      muted: false,
    }));
    await clip.setNotes(formattedNotes);
    return { track_index, clip_index, notes_added: notes.length };
  },
});

export const abletonSetClipName = defineTool({
  namespace: "ableton",
  access: "write",
  name: "set_clip_name",
  description: "Rename a clip in a track's clip slot.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    clip_index: z.number().describe("Zero-based index of the clip slot"),
    name: z.string().describe("New name for the clip"),
  },
  handler: async ({ track_index, clip_index, name }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const clipSlots = await tracks[track_index].get("clip_slots");
    if (clip_index < 0 || clip_index >= clipSlots.length) {
      throw new Error(`Clip slot index ${clip_index} out of range (0-${clipSlots.length - 1})`);
    }
    const clip = await clipSlots[clip_index].get("clip");
    if (!clip) throw new Error(`No clip in slot ${clip_index} of track ${track_index}`);
    await clip.set("name", name);
    return { track_index, clip_index, name };
  },
});

export const abletonSetTempo = defineTool({
  namespace: "ableton",
  access: "write",
  name: "set_tempo",
  description: "Set the session tempo (BPM).",
  schema: {
    tempo: z.number().min(20).max(999).describe("Tempo in BPM (20-999)"),
  },
  handler: async ({ tempo }) => {
    const ab = await svc().ensureConnected();
    await ab.song.set("tempo", tempo);
    return { tempo };
  },
});

export const abletonFireClip = defineTool({
  namespace: "ableton",
  access: "write",
  name: "fire_clip",
  description: "Trigger playback of a clip in a track's clip slot.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    clip_index: z.number().describe("Zero-based index of the clip slot"),
  },
  handler: async ({ track_index, clip_index }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const clipSlots = await tracks[track_index].get("clip_slots");
    if (clip_index < 0 || clip_index >= clipSlots.length) {
      throw new Error(`Clip slot index ${clip_index} out of range (0-${clipSlots.length - 1})`);
    }
    await clipSlots[clip_index].fire();
    return { track_index, clip_index, fired: true };
  },
});

export const abletonStopClip = defineTool({
  namespace: "ableton",
  access: "write",
  name: "stop_clip",
  description: "Stop playback of a clip in a track's clip slot.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    clip_index: z.number().describe("Zero-based index of the clip slot"),
  },
  handler: async ({ track_index, clip_index }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const clipSlots = await tracks[track_index].get("clip_slots");
    if (clip_index < 0 || clip_index >= clipSlots.length) {
      throw new Error(`Clip slot index ${clip_index} out of range (0-${clipSlots.length - 1})`);
    }
    await clipSlots[clip_index].stop();
    return { track_index, clip_index, stopped: true };
  },
});

export const abletonDeleteClipFromSlot = defineTool({
  namespace: "ableton",
  access: "write",
  name: "delete_clip_from_slot",
  description: "Delete/clear a clip from a session view clip slot.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    clip_index: z.number().describe("Zero-based index of the clip slot"),
  },
  handler: async ({ track_index, clip_index }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const clipSlots = await tracks[track_index].get("clip_slots");
    if (clip_index < 0 || clip_index >= clipSlots.length) {
      throw new Error(`Clip slot index ${clip_index} out of range (0-${clipSlots.length - 1})`);
    }
    await clipSlots[clip_index].deleteClip();
    return { track_index, clip_index, deleted: true };
  },
});

export const abletonStartPlayback = defineTool({
  namespace: "ableton",
  access: "write",
  name: "start_playback",
  description: "Start session playback in Ableton Live.",
  schema: {},
  handler: async () => {
    const ab = await svc().ensureConnected();
    await ab.song.startPlaying();
    return { playing: true };
  },
});

export const abletonStopPlayback = defineTool({
  namespace: "ableton",
  access: "write",
  name: "stop_playback",
  description: "Stop session playback in Ableton Live.",
  schema: {},
  handler: async () => {
    const ab = await svc().ensureConnected();
    await ab.song.stopPlaying();
    return { playing: false };
  },
});

export const abletonDeleteTrack = defineTool({
  namespace: "ableton",
  access: "write",
  name: "delete_track",
  description: "Delete a track from the Ableton session.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track to delete"),
  },
  handler: async ({ track_index }) => {
    const ab = await svc().ensureConnected();
    await ab.song.deleteTrack(track_index);
    return { deleted: true, track_index };
  },
});

export const abletonSetTrackMute = defineTool({
  namespace: "ableton",
  access: "write",
  name: "set_track_mute",
  description: "Mute or unmute a track.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    mute: z.boolean().describe("True to mute, false to unmute"),
  },
  handler: async ({ track_index, mute }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    await tracks[track_index].set("mute", mute);
    return { track_index, mute };
  },
});

export const abletonSetTrackSolo = defineTool({
  namespace: "ableton",
  access: "write",
  name: "set_track_solo",
  description: "Solo or unsolo a track.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    solo: z.boolean().describe("True to solo, false to unsolo"),
  },
  handler: async ({ track_index, solo }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    await tracks[track_index].set("solo", solo);
    return { track_index, solo };
  },
});

export const abletonSetTrackArm = defineTool({
  namespace: "ableton",
  access: "write",
  name: "set_track_arm",
  description: "Arm or disarm a track for recording.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    arm: z.boolean().describe("True to arm, false to disarm"),
  },
  handler: async ({ track_index, arm }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    await tracks[track_index].set("arm", arm);
    return { track_index, arm };
  },
});

export const abletonStopAllClips = defineTool({
  namespace: "ableton",
  access: "write",
  name: "stop_all_clips",
  description: "Stop all playing clips in the session.",
  schema: {},
  handler: async () => {
    const ab = await svc().ensureConnected();
    await ab.song.stopAllClips();
    return { stopped: true };
  },
});

export const abletonUndoRedo = defineTool({
  namespace: "ableton",
  access: "write",
  name: "undo",
  description: "Undo the last action in Ableton Live.",
  schema: {},
  handler: async () => {
    const ab = await svc().ensureConnected();
    await ab.song.undo();
    return { undone: true };
  },
});

// -- Clip Info --

export const abletonGetClipInfo = defineTool({
  namespace: "ableton",
  access: "read",
  name: "get_arrangement_clip_info",
  description: "Get detailed properties of an arrangement clip including warp settings, loop settings, and timing info.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    clip_id: z.string().describe("ID of the arrangement clip"),
  },
  handler: async ({ track_index, clip_id }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range`);
    }
    const clips = await tracks[track_index].get("arrangement_clips");
    const clip = clips.find(c => c.raw.id === clip_id);
    if (!clip) throw new Error(`Clip ${clip_id} not found`);

    const [warping, warpMode, looping, loopStart, loopEnd, startMarker, endMarker, gain, name] = await Promise.all([
      clip.get("warping"),
      clip.get("warp_mode"),
      clip.get("looping"),
      clip.get("loop_start"),
      clip.get("loop_end"),
      clip.get("start_marker"),
      clip.get("end_marker"),
      clip.get("gain"),
      clip.get("name"),
    ]);

    const warpModeNames = ["Beats", "Tones", "Texture", "Repitch", "Complex", undefined, "ComplexPro"];

    return {
      name,
      warping,
      warp_mode: warpModeNames[warpMode] ?? `Unknown(${warpMode})`,
      looping,
      loop_start: loopStart,
      loop_end: loopEnd,
      start_marker: startMarker,
      end_marker: endMarker,
      gain,
    };
  },
});

// -- Browser / Device Loading --

/**
 * Recursively search browser items for a matching name.
 * Returns the first loadable item whose name matches (case-insensitive substring).
 */
async function findBrowserItem(
  items: BrowserItem[],
  name: string,
  maxDepth: number = 3,
  currentDepth: number = 0,
): Promise<BrowserItem | null> {
  const lowerName = name.toLowerCase();
  for (const item of items) {
    const itemName = item.raw.name.toLowerCase();
    if (itemName.includes(lowerName) && item.raw.is_loadable) {
      return item;
    }
  }
  if (currentDepth >= maxDepth) return null;
  for (const item of items) {
    // Live 12 uses query-based categories (uri starts with "query:") that report
    // is_folder=false and have no pre-serialized children, but DO have children
    // accessible via the API. We must also recurse into these.
    const hasPreloadedChildren = item.raw.is_folder && item.raw.children?.length > 0;
    const isQueryCategory = item.raw.uri?.startsWith("query:") && !item.raw.is_loadable;
    if (hasPreloadedChildren || isQueryCategory) {
      const children = await item.get("children");
      if (children && children.length > 0) {
        const found = await findBrowserItem(children, name, maxDepth, currentDepth + 1);
        if (found) return found;
      }
    }
  }
  return null;
}

/**
 * Collect all loadable items from browser items up to a given depth.
 */
async function collectLoadableItems(
  items: BrowserItem[],
  maxDepth: number = 2,
  currentDepth: number = 0,
): Promise<{ name: string; uri: string; is_device: boolean; source: string }[]> {
  const results: { name: string; uri: string; is_device: boolean; source: string }[] = [];
  for (const item of items) {
    if (item.raw.is_loadable) {
      results.push({
        name: item.raw.name,
        uri: item.raw.uri,
        is_device: item.raw.is_device,
        source: item.raw.source,
      });
    }
    if (currentDepth < maxDepth) {
      // Live 12 uses query-based categories (uri starts with "query:") that report
      // is_folder=false and have no pre-serialized children, but DO have children
      // accessible via the API. We must also recurse into these.
      const hasPreloadedChildren = item.raw.is_folder && item.raw.children?.length > 0;
      const isQueryCategory = item.raw.uri?.startsWith("query:") && !item.raw.is_loadable;
      if (hasPreloadedChildren || isQueryCategory) {
        const children = await item.get("children");
        if (children && children.length > 0) {
          const childResults = await collectLoadableItems(children, maxDepth, currentDepth + 1);
          results.push(...childResults);
        }
      }
    }
  }
  return results;
}

export const abletonLoadBrowserItem = defineTool({
  namespace: "ableton",
  access: "write",
  name: "load_browser_item",
  description:
    "Load a browser item (instrument, audio effect, drum rack, MIDI effect, etc.) onto the currently selected track in Ableton Live. " +
    "You can specify a category to search in and a name to match. The tool searches recursively through browser folders " +
    "to find a loadable item matching the given name (case-insensitive substring match). " +
    "Use get_browser_items or get_browser_categories first to discover available items. " +
    "To load onto a specific track, select it first by index using the track_index parameter.",
  schema: {
    category: z.enum([
      "instruments", "audio_effects", "drums", "midi_effects",
      "sounds", "packs", "plugins", "samples", "clips",
      "max_for_live", "user_library", "user_folders",
    ]).describe("Browser category to search in"),
    name: z.string().describe("Name (or partial name) of the item to load, e.g. 'Drum Rack', 'Simpler', 'Compressor'"),
    track_index: z.number().optional().describe(
      "Zero-based index of the track to load the item onto. If provided, the track will be selected before loading. " +
      "If omitted, the item loads onto the currently selected track.",
    ),
    max_depth: z.number().optional().describe(
      "Maximum folder depth to search (default: 3). Increase if the item is deeply nested.",
    ),
  },
  handler: async ({ category, name, track_index, max_depth }) => {
    const ab = await svc().ensureConnected();
    const browser = new Browser(ab);

    // If a track_index is specified, select that track first
    if (track_index !== undefined) {
      const tracks = await ab.song.get("tracks");
      if (track_index < 0 || track_index >= tracks.length) {
        throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
      }
      await ab.song.view.set("selected_track", tracks[track_index].raw.id);
    }

    // Get category items from browser
    const items = await browser.get(category as any);
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error(`No items found in category '${category}'`);
    }

    // Search for the item by name
    const item = await findBrowserItem(items, name, max_depth ?? 3);
    if (!item) {
      // Provide helpful error with available top-level item names
      const topNames = items.slice(0, 20).map((i) => i.raw.name);
      throw new Error(
        `No loadable item matching '${name}' found in '${category}'. ` +
        `Top-level items: ${topNames.join(", ")}`,
      );
    }

    // Load the item onto the selected track
    await browser.loadItem(item);

    return {
      loaded: true,
      item_name: item.raw.name,
      item_uri: item.raw.uri,
      category,
      track_index: track_index ?? null,
    };
  },
});

// -- Device Parameter Tools --

export const abletonListDeviceParameters = defineTool({
  namespace: "ableton",
  access: "read",
  name: "list_device_parameters",
  description: "List all parameters of a device on a track. Returns parameter names, values, ranges, and quantization info.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    device_index: z.number().default(0).describe("Zero-based index of the device on the track (default: 0)"),
  },
  handler: async ({ track_index, device_index }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const devices = await tracks[track_index].get("devices");
    if (device_index < 0 || device_index >= devices.length) {
      throw new Error(`Device index ${device_index} out of range (0-${devices.length - 1})`);
    }
    const parameters = await devices[device_index].get("parameters");
    const paramInfo = await Promise.all(
      parameters.map(async (p) => {
        const [name, value, min, max, is_quantized] = await Promise.all([
          p.get("name"),
          p.get("value"),
          p.get("min"),
          p.get("max"),
          p.get("is_quantized"),
        ]);
        const result: { name: string; value: number; min: number; max: number; is_quantized: boolean; value_items?: string[] } = {
          name,
          value,
          min,
          max,
          is_quantized,
        };
        if (is_quantized) {
          const value_items = await p.get("value_items");
          if (value_items && value_items.length > 0) {
            result.value_items = value_items;
          }
        }
        return result;
      }),
    );
    return { device_name: devices[device_index].raw.name, parameters: paramInfo };
  },
});

export const abletonSetDeviceParameter = defineTool({
  namespace: "ableton",
  access: "write",
  name: "set_device_parameter",
  description: "Set a device parameter value by name. Use list_device_parameters to discover available parameters and their ranges.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    device_index: z.number().describe("Zero-based index of the device on the track"),
    parameter_name: z.string().describe("Name of the parameter to set"),
    value: z.number().describe("New value for the parameter (must be within the parameter's min/max range)"),
  },
  handler: async ({ track_index, device_index, parameter_name, value }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const devices = await tracks[track_index].get("devices");
    if (device_index < 0 || device_index >= devices.length) {
      throw new Error(`Device index ${device_index} out of range (0-${devices.length - 1})`);
    }
    const parameters = await devices[device_index].get("parameters");
    const param = await (async () => {
      for (const p of parameters) {
        const name = await p.get("name");
        if (name === parameter_name) return p;
      }
      return null;
    })();
    if (!param) {
      const names = await Promise.all(parameters.map((p) => p.get("name")));
      throw new Error(`Parameter '${parameter_name}' not found. Available: ${names.join(", ")}`);
    }
    const old_value = await param.get("value");
    await param.set("value", value);
    return { parameter_name, old_value, new_value: value };
  },
});

export const abletonGetDeviceParameters = defineTool({
  namespace: "ableton",
  access: "read",
  name: "get_device_parameters",
  description: "Get all devices on a track with their parameters. Provides a complete overview of every device and its parameter values.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
  },
  handler: async ({ track_index }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const devices = await tracks[track_index].get("devices");
    const deviceInfo = await Promise.all(
      devices.map(async (device, idx) => {
        const parameters = await device.get("parameters");
        const paramInfo = await Promise.all(
          parameters.map(async (p) => {
            const [name, value, min, max] = await Promise.all([
              p.get("name"),
              p.get("value"),
              p.get("min"),
              p.get("max"),
            ]);
            return { name, value, min, max };
          }),
        );
        return {
          device_index: idx,
          name: device.raw.name,
          type: device.raw.type,
          parameters: paramInfo,
        };
      }),
    );
    return { track_index, devices: deviceInfo };
  },
});

// -- Device Chain Tools --

export const abletonListDevices = defineTool({
  namespace: "ableton",
  access: "read",
  name: "list_devices",
  description:
    "List all devices (effects, instruments) on a track. Returns device names, types, and indices without fetching all parameter details. " +
    "Use this to see the device chain, then use list_device_parameters for detailed parameter info on a specific device.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
  },
  handler: async ({ track_index }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const devices = await tracks[track_index].get("devices");
    return {
      track_index,
      track_name: tracks[track_index].raw.name,
      devices: devices.map((d, idx) => ({
        device_index: idx,
        name: d.raw.name,
        type: d.raw.type,
        class_name: d.raw.class_name,
      })),
    };
  },
});

export const abletonDeleteDevice = defineTool({
  namespace: "ableton",
  access: "write",
  name: "delete_device",
  description:
    "Delete a device from a track's device chain by its index. " +
    "Set target to 'master' to delete from the master track instead of a regular track.",
  schema: {
    track_index: z.number().optional().describe("Zero-based index of the track (ignored if target is 'master')"),
    device_index: z.number().describe("Zero-based index of the device to delete"),
    target: z.enum(["track", "master"]).optional().describe("Target track type: 'track' (default) or 'master'"),
  },
  handler: async ({ track_index, device_index, target }) => {
    const ab = await svc().ensureConnected();

    let track;
    let trackName: string;

    if (target === "master") {
      track = await ab.song.get("master_track");
      trackName = "Master";
    } else {
      const tracks = await ab.song.get("tracks");
      const idx = track_index ?? 0;
      if (idx < 0 || idx >= tracks.length) {
        throw new Error(`Track index ${idx} out of range (0-${tracks.length - 1})`);
      }
      track = tracks[idx];
      trackName = track.raw.name;
    }

    const devices = await track.get("devices");
    if (device_index < 0 || device_index >= devices.length) {
      throw new Error(`Device index ${device_index} out of range (0-${devices.length - 1})`);
    }
    const deviceName = devices[device_index].raw.name;
    await track.deleteDevice(device_index);
    return { deleted: true, device_name: deviceName, track: trackName, device_index };
  },
});

export const abletonSetupDrumProcessing = defineTool({
  namespace: "ableton",
  access: "write",
  name: "setup_drum_processing",
  description:
    "Load a complete drum processing chain onto a track: EQ Eight, Compressor, and Saturator. " +
    "Each effect is loaded from the browser and configured with sensible drum-focused defaults. " +
    "EQ Eight: high-pass at 60Hz, slight mid scoop, presence boost. " +
    "Compressor: moderate ratio, medium attack, fast release for punch. " +
    "Saturator: gentle warmth with analog-style drive. " +
    "Returns the device indices so you can further tweak parameters with set_device_parameter.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track to add the processing chain to"),
  },
  handler: async ({ track_index }) => {
    const ab = await svc().ensureConnected();
    const browser = new Browser(ab);

    // Select the target track
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    await ab.song.view.set("selected_track", tracks[track_index].raw.id);

    // Get audio_effects category items
    const categoryItems = await browser.get("audio_effects" as any);
    if (!categoryItems || !Array.isArray(categoryItems) || categoryItems.length === 0) {
      throw new Error("No audio effects found in browser");
    }

    const effectNames = ["EQ Eight", "Compressor", "Saturator"];
    const loaded: { name: string; device_index: number }[] = [];

    for (const effectName of effectNames) {
      // Re-select track before each load (loading an effect can change selection)
      await ab.song.view.set("selected_track", tracks[track_index].raw.id);

      const item = await findBrowserItem(categoryItems, effectName, 5);
      if (!item) {
        throw new Error(
          `Could not find '${effectName}' in audio_effects browser. ` +
          `The browser fix for Live 12 query categories may not be working.`,
        );
      }
      await browser.loadItem(item);

      // Get the current device count to determine the new device's index
      const updatedDevices = await tracks[track_index].get("devices");
      loaded.push({
        name: effectName,
        device_index: updatedDevices.length - 1,
      });
    }

    // Now configure the devices with drum-focused defaults
    const updatedDevices = await tracks[track_index].get("devices");
    const results: { effect: string; device_index: number; params_set: string[] }[] = [];

    for (const { name: effectName, device_index } of loaded) {
      if (device_index >= updatedDevices.length) continue;
      const device = updatedDevices[device_index];
      const params = await device.get("parameters");
      const paramsByName = new Map(params.map((p) => [p.raw.name, p]));
      const paramsSet: string[] = [];

      if (effectName === "EQ Eight") {
        // Band 1: HPF at ~30-60Hz, Band 2: mid scoop at ~300-500Hz, Band 3: presence boost at ~2-4kHz
        // Note: Frequency is normalized 0-1, Gain is -15 to 15, Filter Type 0-7 (1=HP), Resonance 0-1
        const eqSettings: Record<string, number> = {
          "1 Filter On A": 1,      // Enable band 1
          "1 Frequency A": 0.1,    // ~30-60Hz (normalized 0-1)
          "1 Filter Type A": 1,    // High-pass filter
          "1 Gain A": 0,
          "2 Filter On A": 1,      // Enable band 2
          "2 Frequency A": 0.35,   // ~300-500Hz (normalized 0-1)
          "2 Gain A": -2.5,        // Slight mid scoop
          "3 Filter On A": 1,      // Enable band 3
          "3 Frequency A": 0.6,    // ~2-4kHz presence (normalized 0-1)
          "3 Gain A": 2.5,         // Subtle boost
        };
        for (const [pName, pValue] of Object.entries(eqSettings)) {
          const param = paramsByName.get(pName);
          if (param) {
            await param.set("value", pValue);
            paramsSet.push(pName);
          }
        }
      } else if (effectName === "Compressor") {
        // Note: Threshold, Ratio, Attack, Release are normalized 0-1; Output Gain is -36 to 36
        const compSettings: Record<string, number> = {
          "Threshold": 0.65,   // Moderate threshold (normalized 0-1)
          "Ratio": 0.5,        // ~4:1 ratio (normalized 0-1)
          "Attack": 0.3,       // Medium attack, lets transients through (normalized 0-1)
          "Release": 0.25,     // Medium-fast release for drum punch (normalized 0-1)
          "Output Gain": 3,    // Makeup gain (range -36 to 36)
        };
        for (const [pName, pValue] of Object.entries(compSettings)) {
          const param = paramsByName.get(pName);
          if (param) {
            await param.set("value", pValue);
            paramsSet.push(pName);
          }
        }
      } else if (effectName === "Saturator") {
        // Note: Drive is -36 to 36, Output is -36 to 0, Dry/Wet is 0-1, Type is 0-6
        const satSettings: Record<string, number> = {
          "Type": 1,           // Soft Sine - gentle analog warmth
          "Drive": 4,          // Subtle drive (range -36 to 36)
          "Output": -4,        // Compensate for added gain (range -36 to 0)
          "Dry/Wet": 0.75,     // Mostly wet but keep some clean signal (range 0-1)
        };
        for (const [pName, pValue] of Object.entries(satSettings)) {
          const param = paramsByName.get(pName);
          if (param) {
            await param.set("value", pValue);
            paramsSet.push(pName);
          }
        }
      }

      results.push({ effect: effectName, device_index, params_set: paramsSet });
    }

    return {
      track_index,
      track_name: tracks[track_index].raw.name,
      devices_loaded: results,
      tip: "Use list_device_parameters to see all available parameters and fine-tune values with set_device_parameter.",
    };
  },
});

// -- Mix Bus / Master Track Tools --

export const abletonSetupMixBus = defineTool({
  namespace: "ableton",
  access: "write",
  name: "setup_mix_bus",
  description:
    "Load a mix bus processing chain onto the master track: Glue Compressor and EQ Eight with mix bus defaults. " +
    "Glue Compressor: 2:1 ratio, slow attack, auto release, 1-3dB gain reduction. " +
    "EQ Eight: subtle corrective moves. Returns device indices for further tweaking.",
  schema: {},
  handler: async () => {
    const ab = await svc().ensureConnected();
    const browser = new Browser(ab);

    // Select the master track
    const masterTrack = await ab.song.get("master_track");
    await ab.song.view.set("selected_track", masterTrack.raw.id);

    const effectNames = ["EQ Eight", "Glue Compressor"];
    const loaded: { name: string; device_index: number }[] = [];

    // Get audio_effects category items
    const categoryItems = await browser.get("audio_effects" as any);
    if (!categoryItems || !Array.isArray(categoryItems) || categoryItems.length === 0) {
      throw new Error("No audio effects found in browser");
    }

    for (const effectName of effectNames) {
      await ab.song.view.set("selected_track", masterTrack.raw.id);
      const item = await findBrowserItem(categoryItems, effectName, 5);
      if (!item) {
        throw new Error(`Could not find '${effectName}' in audio_effects browser.`);
      }
      await browser.loadItem(item);

      const updatedDevices = await masterTrack.get("devices");
      loaded.push({
        name: effectName,
        device_index: updatedDevices.length - 1,
      });
    }

    // Configure Glue Compressor with mix bus defaults
    const updatedDevices = await masterTrack.get("devices");
    const results: { effect: string; device_index: number; params_set: string[] }[] = [];

    for (const { name: effectName, device_index } of loaded) {
      if (device_index >= updatedDevices.length) continue;
      const device = updatedDevices[device_index];
      const params = await device.get("parameters");
      const paramsByName = new Map(params.map((p) => [p.raw.name, p]));
      const paramsSet: string[] = [];

      if (effectName === "EQ Eight") {
        // Subtle corrective EQ: HPF below 30Hz, gentle air boost
        const settings: Record<string, number> = {
          "1 Filter On A": 1,
          "1 Filter Type A": 1,     // High-pass
          "1 Frequency A": 0.06,    // ~25-30Hz
          "1 Gain A": 0,
          "4 Filter On A": 1,
          "4 Filter Type A": 4,     // High shelf
          "4 Frequency A": 0.75,    // ~8kHz
          "4 Gain A": 1,            // Subtle +1dB air
        };
        for (const [pName, pValue] of Object.entries(settings)) {
          const param = paramsByName.get(pName);
          if (param) {
            await param.set("value", pValue);
            paramsSet.push(pName);
          }
        }
      } else if (effectName === "Glue Compressor") {
        // SSL-style glue: gentle, transparent
        // Glue Compressor params: Threshold -40..0, Ratio 0/1/2 (2:1/4:1/10:1),
        // Attack 0-6 (0.01/0.1/0.3/1/3/10/30ms), Release 0-6 (0.1/0.2/0.4/0.6/0.8/1.2s/Auto),
        // Range 0-70 (max GR limit, 70=unlimited), Makeup 0-20dB
        const settings: Record<string, number> = {
          "Threshold": -10,         // Moderate threshold (-40 to 0 dB)
          "Ratio": 0,              // 2:1 (index 0)
          "Attack": 5,             // 10ms (index 5) — slow for mix bus
          "Release": 6,            // Auto release (index 6)
          "Range": 60,             // Limit max GR to ~10dB (0-70, 70=unlimited)
          "Makeup": 2,             // Subtle makeup gain (0-20 dB)
        };
        for (const [pName, pValue] of Object.entries(settings)) {
          const param = paramsByName.get(pName);
          if (param) {
            await param.set("value", pValue);
            paramsSet.push(pName);
          }
        }
      }

      results.push({ effect: effectName, device_index, params_set: paramsSet });
    }

    // Re-select the first regular track so user isn't stuck on master
    const tracks = await ab.song.get("tracks");
    if (tracks.length > 0) {
      await ab.song.view.set("selected_track", tracks[0].raw.id);
    }

    return {
      target: "master_track",
      devices_loaded: results,
    };
  },
});

// -- Arrangement View Tools --

export const abletonCreateArrangementClip = defineTool({
  namespace: "ableton",
  access: "write",
  name: "create_arrangement_clip",
  description: "Create an empty MIDI clip in the arrangement timeline at a specific position.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    start_time: z.number().describe("Start time in beats"),
    length: z.number().describe("Length of the clip in beats"),
  },
  handler: async ({ track_index, start_time, length }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const clip = await tracks[track_index].createMidiClip(start_time, length);
    return { clip_id: clip.raw.id, start_time, length };
  },
});

export const abletonAddNotesToArrangementClip = defineTool({
  namespace: "ableton",
  access: "write",
  name: "add_notes_to_arrangement_clip",
  description: "Add MIDI notes to an arrangement clip. Each note has pitch, time (start in beats), duration, and velocity.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    clip_id: z.string().describe("ID of the arrangement clip"),
    notes: z.array(z.object({
      pitch: z.number().min(0).max(127).describe("MIDI note number (0-127, e.g. 60 = C4)"),
      time: z.number().describe("Start time in beats"),
      duration: z.number().describe("Duration in beats"),
      velocity: z.number().min(0).max(127).optional().describe("Note velocity (0-127, default: 100)"),
    })).describe("Array of MIDI notes to add"),
  },
  handler: async ({ track_index, clip_id, notes }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const arrangementClips = await tracks[track_index].get("arrangement_clips");
    const clip = arrangementClips.find((c) => c.raw.id === clip_id);
    if (!clip) {
      throw new Error(`No arrangement clip with id '${clip_id}' found on track ${track_index}`);
    }
    const formattedNotes = notes.map((n) => ({
      pitch: n.pitch,
      time: n.time,
      duration: n.duration,
      velocity: n.velocity ?? 100,
      muted: false,
    }));
    await clip.setNotes(formattedNotes);
    return { clip_id, notes_added: notes.length };
  },
});

export const abletonListArrangementClips = defineTool({
  namespace: "ableton",
  access: "read",
  name: "list_arrangement_clips",
  description: "List all clips in the arrangement view for a track.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
  },
  handler: async ({ track_index }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const arrangementClips = await tracks[track_index].get("arrangement_clips");
    return arrangementClips.map((c) => ({
      id: c.raw.id,
      name: c.raw.name,
      start_time: c.raw.start_time,
      end_time: c.raw.end_time,
      is_midi_clip: c.raw.is_midi_clip,
      is_audio_clip: c.raw.is_audio_clip,
      muted: c.raw.muted,
    }));
  },
});

export const abletonDuplicateClipToArrangement = defineTool({
  namespace: "ableton",
  access: "write",
  name: "duplicate_clip_to_arrangement",
  description: "Copy a session clip from a clip slot to the arrangement timeline at a specified time.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    clip_index: z.number().describe("Zero-based index of the session clip slot"),
    time: z.number().describe("Destination time in beats in the arrangement"),
  },
  handler: async ({ track_index, clip_index, time }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const clipSlots = await tracks[track_index].get("clip_slots");
    if (clip_index < 0 || clip_index >= clipSlots.length) {
      throw new Error(`Clip slot index ${clip_index} out of range (0-${clipSlots.length - 1})`);
    }
    const clip = await clipSlots[clip_index].get("clip");
    if (!clip) throw new Error(`No clip in slot ${clip_index} of track ${track_index}`);
    const newClip = await tracks[track_index].duplicateClipToArrangement(clip, time);
    return { clip_id: newClip.raw.id, time };
  },
});

export const abletonCreateAudioArrangementClip = defineTool({
  namespace: "ableton",
  access: "write",
  name: "create_audio_arrangement_clip",
  description: "Place an audio file in the arrangement timeline at a specified position.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    file_path: z.string().describe("Absolute path to the audio file"),
    position: z.number().describe("Position in beats in the arrangement"),
  },
  handler: async ({ track_index, file_path, position }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    await tracks[track_index].createAudioClip(file_path, position);
    return { file_path, position };
  },
});

export const abletonListLoadableItems = defineTool({
  namespace: "ableton",
  access: "read",
  name: "list_loadable_items",
  description:
    "List all loadable items (instruments, effects, presets) in a browser category. " +
    "Returns names and URIs of items that can be loaded onto a track. " +
    "Searches up to max_depth levels deep into folders.",
  schema: {
    category: z.enum([
      "instruments", "audio_effects", "drums", "midi_effects",
      "sounds", "packs", "plugins", "samples", "clips",
      "max_for_live", "user_library", "user_folders",
    ]).describe("Browser category to list items from"),
    max_depth: z.number().optional().describe("Maximum folder depth to search (default: 2)"),
    filter: z.string().optional().describe("Optional name filter (case-insensitive substring match)"),
  },
  handler: async ({ category, max_depth, filter }) => {
    const ab = await svc().ensureConnected();
    const browser = new Browser(ab);

    const items = await browser.get(category as any);
    if (!items || !Array.isArray(items) || items.length === 0) {
      return { items: [], count: 0 };
    }

    let loadable = await collectLoadableItems(items, max_depth ?? 2);

    if (filter) {
      const lowerFilter = filter.toLowerCase();
      loadable = loadable.filter((item) => item.name.toLowerCase().includes(lowerFilter));
    }

    return {
      items: loadable,
      count: loadable.length,
    };
  },
});

// -- Sonic Matching Tools (bridge between @barry/music and Ableton) --

export const abletonMatchTimbre = defineTool({
  namespace: "ableton",
  access: "write",
  name: "match_timbre_to_track",
  description:
    "Analyze a target audio file and automatically adjust a track's drum rack EQ macros (Low Gain, Mid Gain, High Gain) to match the target's sonic character. Uses @barry/music spectral analysis to compare the target against a source audio file (e.g. an isolated drum sample), then applies the recommended macro values to the specified device.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    device_index: z.number().default(0).describe("Zero-based index of the device (default: 0)"),
    target_file: z.string().describe("Path to the target audio file to match (e.g. isolated drums from a reference track)"),
    source_file: z.string().describe("Path to the source audio file (e.g. the drum kit sample currently loaded)"),
  },
  handler: async ({ track_index, device_index, target_file, source_file }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const track = tracks[track_index];

    // Analyze and compare
    const comparison = await compareTimbre(source_file, target_file);
    const macros = comparison.eq.macroValues;

    // Get device and its parameters
    const devices = await track.get("devices");
    if (device_index < 0 || device_index >= devices.length) {
      throw new Error(`Device index ${device_index} out of range (0-${devices.length - 1})`);
    }
    const device = devices[device_index];
    const params = await device.get("parameters");

    // Apply macro values to Low/Mid/High Gain parameters
    const applied: Array<{ name: string; oldValue: number; newValue: number }> = [];
    const macroMap: Record<string, number> = {
      "Low Gain": macros.low,
      "Low Gain  ": macros.low,  // some kits have trailing spaces
      "Mid Gain": macros.mid,
      "High Gain": macros.high,
    };

    for (const param of params) {
      const name = param.raw.name;
      if (name in macroMap) {
        const oldValue = param.raw.value;
        const newValue = macroMap[name];
        await param.set("value", newValue);
        applied.push({ name: name.trim(), oldValue, newValue });
      }
    }

    return {
      track_index,
      device_index,
      comparison: {
        centroidShift: comparison.eq.centroidShiftHz,
        brightness: comparison.eq.brightnessDirection,
        bands: comparison.eq.bands,
      },
      macrosApplied: applied,
      correctionCurve: {
        low_dB: Math.round((macros.low - 63.5) / 5 * 10) / 10,
        mid_dB: Math.round((macros.mid - 63.5) / 5 * 10) / 10,
        high_dB: Math.round((macros.high - 63.5) / 5 * 10) / 10,
      },
    };
  },
});

export const abletonAnalyzeTrackTimbre = defineTool({
  namespace: "ableton",
  access: "read",
  name: "analyze_track_timbre",
  description:
    "Analyze the timbral/sonic characteristics of an audio file using @barry/music spectral analysis. Returns spectral centroid, bandwidth, flatness, energy bands, attack/decay times, and a human-readable summary. Useful for understanding a sound before matching it.",
  schema: {
    file_path: z.string().describe("Absolute path to the audio file to analyze"),
  },
  handler: async ({ file_path }) => {
    const result = await analyzeTimbre(file_path);
    return result;
  },
});

export const abletonCompareTimbres = defineTool({
  namespace: "ableton",
  access: "read",
  name: "compare_timbres",
  description:
    "Compare two audio files and get detailed EQ recommendations, spectral correction curve, and similarity score. Returns per-band energy differences, recommended Ableton macro values, and a 1/3 octave correction curve.",
  schema: {
    source_file: z.string().describe("Path to the source audio file (current sound)"),
    target_file: z.string().describe("Path to the target audio file (desired sound)"),
  },
  handler: async ({ source_file, target_file }) => {
    const [comparison, similarity, correctionCurve] = await Promise.all([
      compareTimbre(source_file, target_file),
      timbreSimilarity(source_file, target_file),
      spectralCorrectionCurve(source_file, target_file),
    ]);

    return {
      similarity: similarity,
      eq: comparison.eq,
      correctionCurve: {
        frequencies: correctionCurve.frequencies,
        corrections_dB: correctionCurve.smoothed_dB,
      },
      source: comparison.source.summary,
      target: comparison.target.summary,
    };
  },
});

export const abletonExtractAndLoadDrums = defineTool({
  namespace: "ableton",
  access: "write",
  name: "extract_and_load_drums",
  description:
    "Extract kick, snare, and hihat MIDI from a drums audio file and load them into session clips on a specified track. Uses @barry/music onset detection with frequency-based drum part isolation. Creates one clip containing all drum parts with GM drum pitches (36=kick, 38=snare, 42=hihat).",
  schema: {
    track_index: z.number().describe("Zero-based index of the target MIDI track"),
    clip_index: z.number().describe("Zero-based index of the clip slot to use"),
    drums_file: z.string().describe("Path to the drums audio file (e.g. demucs-isolated drums stem)"),
    output_dir: z.string().describe("Directory to save intermediate files (isolated parts, MIDI)"),
    tempo: z.number().describe("Tempo in BPM for quantization"),
    quantize: z.enum(["4", "8", "16", "32"]).default("16").describe("Quantization grid (default: 16th notes)"),
    clip_length: z.number().optional().describe("Clip length in beats (auto-detected from audio if omitted)"),
  },
  handler: async ({ track_index, clip_index, drums_file, output_dir, tempo, quantize, clip_length }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    const track = tracks[track_index];

    // Extract drum MIDI using @barry/music
    const quantizeNum = parseInt(quantize) as 4 | 8 | 16 | 32;
    const drumNotes = await extractDrumMidi(drums_file, output_dir, {
      tempo,
      quantize: quantizeNum,
    });

    // Combine all parts
    const allNotes: AbletonNote[] = [
      ...drumNotes.kick,
      ...drumNotes.snare,
      ...drumNotes.hihat,
    ].sort((a, b) => a.time - b.time);

    // Determine clip length
    const maxTime = allNotes.length > 0 ? allNotes[allNotes.length - 1].time : 0;
    const finalLength = clip_length ?? Math.ceil(maxTime / 4) * 4;

    // Get clip slots and create clip
    const clipSlots = await track.get("clip_slots");
    if (clip_index < 0 || clip_index >= clipSlots.length) {
      throw new Error(`Clip index ${clip_index} out of range (0-${clipSlots.length - 1})`);
    }

    const slot = clipSlots[clip_index];
    await slot.createClip(finalLength);
    const clip = await slot.get("clip");
    if (!clip) throw new Error("Failed to create clip");

    await clip.set("name", "Extracted Drums");

    // Add notes in batches.
    // Note: ableton-js's clip.setNotes() ADDS notes to the clip (it does not
    // replace existing notes), so batching works correctly here.
    const batches = drumNotesToBatches(allNotes, 200);
    let totalAdded = 0;
    for (const batch of batches) {
      const notes = batch.map((n) => ({
        pitch: n.pitch,
        time: n.time,
        duration: n.duration,
        velocity: n.velocity,
        muted: false,
      }));
      await clip.setNotes(notes);
      totalAdded += notes.length;
    }

    return {
      track_index,
      clip_index,
      clip_length: finalLength,
      notes: {
        kick: drumNotes.kick.length,
        snare: drumNotes.snare.length,
        hihat: drumNotes.hihat.length,
        total: totalAdded,
      },
      output_dir,
    };
  },
});

export const abletonAnalyzeDrumFeatures = defineTool({
  namespace: "ableton",
  access: "read",
  name: "analyze_drum_features",
  description:
    "Extract DrumGAN-style perceptual features from a drum audio file: brightness, hardness, depth, roughness, boominess, warmth, sharpness (each 0-100). Useful for comparing drum sounds in a perceptual feature space.",
  schema: {
    file_path: z.string().describe("Path to the drum audio file to analyze"),
    compare_to: z.string().optional().describe("Optional path to a second file to compare against. Returns the distance between the two."),
  },
  handler: async ({ file_path, compare_to }) => {
    const features = await extractDrumFeatures(file_path);

    if (compare_to) {
      const targetFeatures = await extractDrumFeatures(compare_to);
      const distance = drumFeatureDistance(features, targetFeatures);
      return {
        source: features,
        target: targetFeatures,
        distance,
        similarity: Math.round((1 - distance) * 100) / 100,
      };
    }

    return { features };
  },
});

// -- Clip Warp Control --

export const abletonSetClipWarping = defineTool({
  namespace: "ableton",
  access: "write",
  name: "set_clip_warping",
  description: "Enable or disable warping on an arrangement audio clip. Also allows setting the warp mode.",
  schema: {
    track_index: z.number().describe("Zero-based index of the track"),
    clip_id: z.string().describe("ID of the arrangement clip"),
    warping: z.boolean().describe("Enable (true) or disable (false) warping"),
    warp_mode: z.number().optional().describe("Warp mode: 0=Beats, 1=Tones, 2=Texture, 3=Repitch, 4=Complex, 6=ComplexPro"),
  },
  handler: async ({ track_index, clip_id, warping, warp_mode }) => {
    const ab = await svc().ensureConnected();
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range`);
    }
    const clips = await tracks[track_index].get("arrangement_clips");
    const clip = clips.find(c => c.raw.id === clip_id);
    if (!clip) throw new Error(`Clip ${clip_id} not found`);

    const oldWarping = await clip.get("warping");
    await clip.set("warping", warping);

    if (warp_mode !== undefined) {
      await clip.set("warp_mode", warp_mode);
    }

    const newWarping = await clip.get("warping");
    const currentMode = await clip.get("warp_mode");
    const warpModeNames = ["Beats", "Tones", "Texture", "Repitch", "Complex", undefined, "ComplexPro"];

    return {
      clip_id,
      warping: { old: oldWarping, new: newWarping },
      warp_mode: warpModeNames[currentMode] ?? `Unknown(${currentMode})`,
    };
  },
});

// -- Harshness Detection & Auto-EQ --

export const abletonDetectAndFixHarshness = defineTool({
  namespace: "ableton",
  access: "write",
  name: "detect_and_fix_harshness",
  description:
    "Detect harsh frequencies (resonant peaks in 2-8kHz) in an audio file and optionally apply corrective EQ. " +
    "Analyzes the file using spectral peak detection, classifies regions as resonance/sibilance/buildup, " +
    "and generates EQ Eight recommendations. If apply=true, loads EQ Eight onto the specified track " +
    "and configures up to 8 bell-cut bands at the detected frequencies.",
  schema: {
    file_path: z.string().describe("Absolute path to the audio file to analyze"),
    track_index: z.number().optional().describe("Zero-based index of the track to apply EQ to (required if apply=true)"),
    apply: z.boolean().default(false).describe("If true, load EQ Eight and apply the recommended cuts"),
    sensitivity_db: z.number().optional().describe("Sensitivity threshold in dB (default: 6). Lower = more detections."),
  },
  handler: async ({ file_path, track_index, apply, sensitivity_db }) => {
    const analysis = await detectHarshness(file_path, {
      sensitivityDb: sensitivity_db,
    });

    if (!apply || analysis.eqRecommendations.length === 0) {
      return { analysis, applied: false };
    }

    if (track_index === undefined) {
      throw new Error("track_index is required when apply=true");
    }

    const ab = await svc().ensureConnected();
    const browser = new Browser(ab);

    // Select the target track
    const tracks = await ab.song.get("tracks");
    if (track_index < 0 || track_index >= tracks.length) {
      throw new Error(`Track index ${track_index} out of range (0-${tracks.length - 1})`);
    }
    await ab.song.view.set("selected_track", tracks[track_index].raw.id);

    // Load EQ Eight
    const categoryItems = await browser.get("audio_effects" as any);
    if (!categoryItems || !Array.isArray(categoryItems) || categoryItems.length === 0) {
      throw new Error("No audio effects found in browser");
    }
    const eqItem = await findBrowserItem(categoryItems, "EQ Eight", 5);
    if (!eqItem) {
      throw new Error("Could not find EQ Eight in audio_effects browser");
    }
    await browser.loadItem(eqItem);

    // Get the newly loaded device
    const updatedDevices = await tracks[track_index].get("devices");
    const eqDeviceIndex = updatedDevices.length - 1;
    const eqDevice = updatedDevices[eqDeviceIndex];
    const params = await eqDevice.get("parameters");
    const paramsByName = new Map(params.map((p) => [p.raw.name, p]));

    // Configure each band as a bell cut
    const appliedBands: { band: number; frequency: number; gain: number; q: number }[] = [];

    for (let i = 0; i < Math.min(analysis.eqRecommendations.length, 8); i++) {
      const rec = analysis.eqRecommendations[i];
      const bandNum = i + 1;

      const settings: Record<string, number> = {
        [`${bandNum} Filter On A`]: 1,
        [`${bandNum} Frequency A`]: rec.eq8Value,
        [`${bandNum} Filter Type A`]: 3, // Bell
        [`${bandNum} Gain A`]: rec.gain,
        [`${bandNum} Resonance A`]: Math.min(rec.q / 18, 1), // Normalize Q to 0-1 range
      };

      for (const [pName, pValue] of Object.entries(settings)) {
        const param = paramsByName.get(pName);
        if (param) {
          await param.set("value", pValue);
        }
      }

      appliedBands.push({
        band: bandNum,
        frequency: rec.frequency,
        gain: rec.gain,
        q: rec.q,
      });
    }

    return {
      analysis,
      applied: true,
      track_index,
      track_name: tracks[track_index].raw.name,
      eq_device_index: eqDeviceIndex,
      bands_configured: appliedBands,
      tip: "Use list_device_parameters to see all EQ Eight parameters and fine-tune with set_device_parameter.",
    };
  },
});

// -- Frequency Clash Detection & Auto-EQ --

export const abletonDetectTrackClashes = defineTool({
  namespace: "ableton",
  access: "write",
  name: "detect_track_clashes",
  description:
    "Detect frequency masking between multiple audio sources (stems/tracks) and optionally apply corrective EQ. " +
    "Analyzes 1/3 octave energy profiles, identifies bands where sources compete, and recommends gentle bell cuts " +
    "on the weaker source. If apply=true, loads EQ Eight onto each affected track and configures cuts.",
  schema: {
    sources: z
      .array(
        z.object({
          file_path: z.string().describe("Absolute path to the audio file"),
          label: z.string().optional().describe("Display name for this source"),
          track_index: z.number().optional().describe("Zero-based track index for applying EQ (required if apply=true)"),
          role: z.enum(["lead", "support"]).default("support").describe("Role: 'lead' sources are never cut"),
        })
      )
      .min(2)
      .describe("Audio sources to analyze for clashes (minimum 2)"),
    apply: z.boolean().default(false).describe("If true, load EQ Eight and apply recommended cuts"),
    min_severity: z.number().optional().describe("Minimum severity threshold 0-1 (default: 0.15)"),
    max_cuts_per_source: z.number().optional().describe("Maximum EQ cuts per source (default: 4)"),
  },
  handler: async ({ sources, apply, min_severity, max_cuts_per_source }) => {
    const clashSources: ClashSource[] = sources.map((s, i) => ({
      filePath: s.file_path,
      label: s.label ?? `Track ${i + 1}`,
      role: s.role ?? "support",
    }));

    const analysis = await detectClashes(clashSources, {
      minSeverity: min_severity,
      maxCutsPerSource: max_cuts_per_source,
    });

    if (!apply || analysis.fixes.length === 0) {
      return { analysis, applied: false };
    }

    // Verify all sources that need fixes have track_index
    const sourceTrackMap = new Map<number, number>();
    for (let i = 0; i < sources.length; i++) {
      if (sources[i].track_index !== undefined) {
        sourceTrackMap.set(i, sources[i].track_index!);
      }
    }

    const fixSourceIndices = new Set(analysis.fixes.map((f) => f.sourceIndex));
    for (const idx of fixSourceIndices) {
      if (!sourceTrackMap.has(idx)) {
        throw new Error(
          `track_index is required for source "${clashSources[idx].label}" (index ${idx}) when apply=true`
        );
      }
    }

    const ab = await svc().ensureConnected();
    const browser = new Browser(ab);
    const tracks = await ab.song.get("tracks");

    // Group fixes by source
    const fixesBySource = new Map<number, typeof analysis.fixes>();
    for (const fix of analysis.fixes) {
      const group = fixesBySource.get(fix.sourceIndex) ?? [];
      group.push(fix);
      fixesBySource.set(fix.sourceIndex, group);
    }

    const appliedPerTrack: {
      sourceIndex: number;
      sourceLabel: string;
      trackIndex: number;
      trackName: string;
      bands: { band: number; frequency: number; gain: number; q: number }[];
    }[] = [];

    for (const [sourceIdx, fixes] of fixesBySource) {
      const trackIdx = sourceTrackMap.get(sourceIdx)!;
      if (trackIdx < 0 || trackIdx >= tracks.length) {
        throw new Error(`Track index ${trackIdx} out of range (0-${tracks.length - 1})`);
      }

      // Select the target track
      await ab.song.view.set("selected_track", tracks[trackIdx].raw.id);

      // Load EQ Eight
      const categoryItems = await browser.get("audio_effects" as any);
      if (!categoryItems || !Array.isArray(categoryItems) || categoryItems.length === 0) {
        throw new Error("No audio effects found in browser");
      }
      const eqItem = await findBrowserItem(categoryItems, "EQ Eight", 5);
      if (!eqItem) {
        throw new Error("Could not find EQ Eight in audio_effects browser");
      }
      await browser.loadItem(eqItem);

      // Get the newly loaded device
      const updatedDevices = await tracks[trackIdx].get("devices");
      const eqDevice = updatedDevices[updatedDevices.length - 1];
      const params = await eqDevice.get("parameters");
      const paramsByName = new Map(params.map((p) => [p.raw.name, p]));

      const appliedBands: { band: number; frequency: number; gain: number; q: number }[] = [];

      for (let i = 0; i < Math.min(fixes.length, 8); i++) {
        const fix = fixes[i];
        const bandNum = i + 1;

        const settings: Record<string, number> = {
          [`${bandNum} Filter On A`]: 1,
          [`${bandNum} Frequency A`]: fix.eq8Value,
          [`${bandNum} Filter Type A`]: 3, // Bell
          [`${bandNum} Gain A`]: fix.gain,
          [`${bandNum} Resonance A`]: Math.min(fix.q / 18, 1),
        };

        for (const [pName, pValue] of Object.entries(settings)) {
          const param = paramsByName.get(pName);
          if (param) {
            await param.set("value", pValue);
          }
        }

        appliedBands.push({
          band: bandNum,
          frequency: fix.frequency,
          gain: fix.gain,
          q: fix.q,
        });
      }

      appliedPerTrack.push({
        sourceIndex: sourceIdx,
        sourceLabel: clashSources[sourceIdx].label,
        trackIndex: trackIdx,
        trackName: tracks[trackIdx].raw.name,
        bands: appliedBands,
      });
    }

    return {
      analysis,
      applied: true,
      tracks_configured: appliedPerTrack,
      tip: "Use list_device_parameters to see all EQ Eight parameters and fine-tune with set_device_parameter.",
    };
  },
});
