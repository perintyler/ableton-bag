/**
 * EQ Eight in Ableton uses a normalized 0-1 range for frequency.
 * This maps approximately to 20Hz-20kHz on a logarithmic scale.
 *
 * The mapping follows: freq = 20 * (1000 ^ value)
 * So: value = log(freq/20) / log(1000)
 */

/** Convert Hz to EQ Eight normalized frequency (0-1) */
export function hzToEQ8(hz: number): number {
  const value = Math.log(hz / 20) / Math.log(1000)
  return Math.max(0, Math.min(1, value))
}

/** Convert EQ Eight normalized frequency (0-1) to Hz */
export function eq8ToHz(value: number): number {
  return 20 * Math.pow(1000, value)
}

/** Common frequency presets for quick access */
export const EQ8_PRESETS = {
  // High-pass filter frequencies
  HPF_30: hzToEQ8(30),
  HPF_60: hzToEQ8(60),
  HPF_80: hzToEQ8(80),
  HPF_100: hzToEQ8(100),
  HPF_120: hzToEQ8(120),
  HPF_200: hzToEQ8(200),
  HPF_300: hzToEQ8(300),
  HPF_500: hzToEQ8(500),

  // Common EQ frequencies
  SUB_BASS: hzToEQ8(60),
  BASS_BODY: hzToEQ8(100),
  MUD: hzToEQ8(300),
  BOXINESS: hzToEQ8(500),
  NASAL: hzToEQ8(1000),
  PRESENCE: hzToEQ8(3000),
  SNAP: hzToEQ8(5000),
  AIR: hzToEQ8(10000),
  BRILLIANCE: hzToEQ8(12000),

  // Low-pass filter frequencies
  LPF_4K: hzToEQ8(4000),
  LPF_8K: hzToEQ8(8000),
  LPF_12K: hzToEQ8(12000),
  LPF_16K: hzToEQ8(16000),
  LPF_17K: hzToEQ8(17000),
} as const

/** EQ Eight filter types */
export const EQ8_FILTER_TYPES = {
  LOW_CUT_48: 0,
  LOW_CUT_12: 1,
  LOW_SHELF: 2,
  BELL: 3,
  HIGH_SHELF: 4,
  HIGH_CUT_12: 5,
  HIGH_CUT_48: 6,
  NOTCH: 7,
} as const
