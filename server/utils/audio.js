/**
 * Audio buffer helpers shared across meditation and radio generation flows.
 */

const WAV_HEADER_SIZE = 44;

/**
 * Create a PCM WAV buffer filled with silence for the requested duration.
 *
 * @param {number} durationSeconds - Length of the silence chunk in seconds.
 * @param {object} options - Optional audio settings overrides.
 * @param {number} [options.sampleRate=44100] - Samples per second.
 * @param {number} [options.bitsPerSample=16] - Bit depth of the audio.
 * @param {number} [options.numChannels=1] - Number of audio channels (mono by default).
 * @returns {Buffer} Allocated WAV buffer representing silence.
 */
export function generateSilenceBuffer(durationSeconds = 0.35, options = {}) {
  const {
    sampleRate = 44100,
    bitsPerSample = 16,
    numChannels = 1
  } = options;

  const bytesPerSample = bitsPerSample / 8;
  const samples = Math.floor(sampleRate * durationSeconds);
  const dataSize = samples * bytesPerSample * numChannels;
  const bufferSize = WAV_HEADER_SIZE + dataSize;

  const buffer = Buffer.alloc(bufferSize);

  // WAV header (PCM)
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(bufferSize - 8, 4); // ChunkSize
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Remaining bytes are zero-filled which represents silence.
  return buffer;
}

/**
 * Join multiple PCM WAV buffers into a single continuous buffer.
 *
 * @param {Buffer[]} buffers - Individual WAV buffers to concatenate.
 * @returns {Buffer} Combined WAV buffer (handles header updates automatically).
 */
export function concatenateAudioBuffers(buffers = []) {
  if (!Array.isArray(buffers) || buffers.length === 0) {
    return Buffer.alloc(0);
  }

  if (buffers.length === 1) {
    return Buffer.from(buffers[0]);
  }

  let totalSize = buffers[0].length;
  for (let i = 1; i < buffers.length; i += 1) {
    totalSize += Math.max(0, buffers[i].length - WAV_HEADER_SIZE);
  }

  const result = Buffer.alloc(totalSize);
  let offset = buffers[0].copy(result, 0);

  for (let i = 1; i < buffers.length; i += 1) {
    const buffer = buffers[i];
    buffer.copy(result, offset, WAV_HEADER_SIZE);
    offset += Math.max(0, buffer.length - WAV_HEADER_SIZE);
  }

  // Update RIFF chunk sizes.
  result.writeUInt32LE(totalSize - 8, 4);
  result.writeUInt32LE(totalSize - WAV_HEADER_SIZE, 40);

  return result;
}

export const __TEST_ONLY__ = {
  WAV_HEADER_SIZE
};

