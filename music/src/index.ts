export {
  getAudioInfo,
  filter,
  isolateFrequencyBands,
  convertToWav,
  DRUM_BANDS,
  type AudioInfo,
  type FilterOptions,
  type IsolateFrequencyBandOptions,
} from './audio.js'

export {
  separate,
  type SeparateOptions,
  type StemResult,
  type StemModel,
  type TwoStems,
} from './stems.js'

export {
  createMidiBuffer,
  writeMidiFile,
  writeOnsetsMidi,
  quantize,
  quantizeNotes,
  onsetsToNotes,
  GM_DRUMS,
  type MidiNote,
  type MidiTrack,
  type CreateMidiOptions,
} from './midi.js'

export {
  detectOnsets,
  detectOnsetsAubio,
  type Onset,
  type OnsetDetectionOptions,
} from './onset.js'

export {
  analyzeTimbre,
  type AudioAnalysisResult,
  type SpectralAnalysis,
  type TransientAnalysis,
} from './analyze.js'

export {
  compareTimbre,
  suggestMacroValues,
  spectralCorrectionCurve,
  type TimbreComparison,
  type EQRecommendation,
  type EQBandRecommendation,
  type SpectralCorrectionCurve,
} from './compare.js'

export {
  isolateDrumParts,
  extractDrumMidi,
  drumNotesToBatches,
  type DrumParts,
  type DrumPartNotes,
  type AbletonNote,
} from './drum-parts.js'

export {
  extractDrumFeatures,
  drumFeatureDistance,
  findClosestSample,
  type DrumFeatures,
  type SampleMatch,
} from './drum-features.js'

export {
  timbreSimilarity,
  mfccDistance,
  type SimilarityResult,
  type MfccDistanceResult,
} from './similarity.js'

export {
  hzToEQ8,
  eq8ToHz,
  EQ8_PRESETS,
  EQ8_FILTER_TYPES,
} from './eq-mapping.js'

export {
  fft,
  ifft,
  magnitudeSpectrum,
  powerSpectrum,
  stft,
  stftComplex,
  istft,
  fftFrequencies,
  spectralCentroid,
  spectralBandwidth,
  spectralFlatness,
  spectralRolloff,
  bandEnergy,
  hzToMel,
  melToHz,
  melFilterbank,
  dctII,
  mfcc,
  loadAudio,
  hannWindow,
  hammingWindow,
  type STFTOptions,
} from './dsp.js'

export {
  transcribePolyphonic,
  type TranscriptionResult,
  type TranscribedNote,
  type TranscribeOptions,
} from './transcribe.js'

export {
  checkHealth,
  type HealthCheckResult,
} from './health.js'

export {
  detectHarshness,
  type HarshnessSummary,
  type HarshRegion,
  type HarshnessBand,
  type EQFix,
  type HarshnessOptions,
} from './harshness.js'

export {
  detectClashes,
  type ClashSource,
  type ClashOptions,
  type ClashRegion,
  type ClashFix,
  type ClashSummary,
  type SourceProfile,
} from './clash.js'
