import { spawn } from 'child_process';

/**
 * Audio buffer helpers shared across meditation generation flows.
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
 * Derive the runtime (in seconds) of a PCM WAV buffer.
 *
 * @param {Buffer} buffer - WAV buffer to inspect.
 * @returns {number} Duration in seconds (0 when unavailable).
 */
export function getWavDurationSeconds(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < WAV_HEADER_SIZE) {
    return 0;
  }

  if (buffer.toString('ascii', 0, 4) !== 'RIFF') {
    return 0;
  }

  if (buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return 0;
  }

  // Basic PCM header layout checks
  if (buffer.toString('ascii', 12, 16) !== 'fmt ') {
    return 0;
  }

  const numChannels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataChunkId = buffer.toString('ascii', 36, 40);
  const dataSize = buffer.readUInt32LE(40);

  if (dataChunkId !== 'data') {
    return 0;
  }

  if (!numChannels || !sampleRate || !bitsPerSample || !dataSize) {
    return 0;
  }

  const bytesPerSample = bitsPerSample / 8;
  if (!bytesPerSample) {
    return 0;
  }

  const durationSeconds = dataSize / (numChannels * sampleRate * bytesPerSample);
  return Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;
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

function buildAtempoFilters(playbackSpeed) {
  if (typeof playbackSpeed !== 'number' || !Number.isFinite(playbackSpeed) || playbackSpeed <= 0 || playbackSpeed === 1) {
    return [];
  }

  const filters = [];
  let target = playbackSpeed;

  // Clamp extreme values into the supported 0.5-2.0 window using repeated factors.
  while (target < 0.5) {
    filters.push(0.5);
    target /= 0.5;
  }

  while (target > 2) {
    filters.push(2);
    target /= 2;
  }

  filters.push(Number(target.toFixed(4)));
  return filters;
}

/**
 * Transcode a WAV PCM buffer into a compressed audio buffer using ffmpeg.
 * Falls back to returning the original buffer when transcoding fails.
 *
 * @param {Buffer} buffer - Source PCM WAV buffer to transcode.
 * @param {object} options
 * @param {string} [options.ffmpegPath='ffmpeg'] - Path to ffmpeg executable.
 * @param {string} [options.inputFormat='wav'] - Explicit input format for ffmpeg (set to 'auto' to autodetect).
 * @param {string} [options.format='mp3'] - Target audio container/format.
 * @param {string} [options.bitrate='128k'] - Audio bitrate for encoding.
 * @param {number} [options.playbackSpeed=1] - Tempo multiplier applied using ffmpeg atempo filters.
 * @returns {Promise<Buffer>} Transcoded audio buffer.
 */
export async function transcodeAudioBuffer(buffer, { ffmpegPath = 'ffmpeg', inputFormat = 'wav', format = 'mp3', bitrate = '128k', playbackSpeed = 1 } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return buffer;
  }

  return new Promise((resolve, reject) => {
    const args = [];
    const normalizedInputFormat = inputFormat === 'auto' ? null : inputFormat;
    if (normalizedInputFormat) {
      args.push('-f', normalizedInputFormat);
    }
    args.push('-i', 'pipe:0');

    const atempoFilters = buildAtempoFilters(playbackSpeed);
    if (atempoFilters.length > 0) {
      const filterChain = atempoFilters.map((value) => `atempo=${value}`).join(',');
      args.push('-filter:a', filterChain);
    }

    if (format === 'mp3') {
      args.push('-acodec', 'libmp3lame', '-b:a', bitrate);
    }

    args.push('-f', format, 'pipe:1');

    const ffmpeg = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    let stderr = '';

    ffmpeg.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        const error = new Error(`ffmpeg exited with code ${code}${stderr ? `: ${stderr}` : ''}`);
        reject(error);
      }
    });

    ffmpeg.stdin.on('error', (error) => {
      reject(error);
    });

    ffmpeg.stdin.end(buffer);
  });
}

export async function convertAudioToWav(buffer, { ffmpegPath = 'ffmpeg', playbackSpeed = 1, inputFormat = 'auto' } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return buffer;
  }

  const baseOptions = {
    ffmpegPath,
    format: 'wav',
    inputFormat,
  };

  if (playbackSpeed !== 1) {
    try {
      return await transcodeAudioBuffer(buffer, { ...baseOptions, playbackSpeed });
    } catch (error) {
      // Retry without tempo adjustment before surfacing the failure.
      try {
        return await transcodeAudioBuffer(buffer, baseOptions);
      } catch (secondaryError) {
        throw secondaryError;
      }
    }
  }

  return transcodeAudioBuffer(buffer, baseOptions);
}

export function normalizeWavBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < WAV_HEADER_SIZE) {
    return buffer;
  }

  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return buffer;
  }

  let fmtChunk = null;
  let dataChunk = null;
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const paddedSize = chunkSize + (chunkSize % 2); // Chunks are word-aligned

    if (chunkId === 'fmt ') {
      fmtChunk = buffer.subarray(chunkDataStart, chunkDataStart + chunkSize);
    } else if (chunkId === 'data') {
      dataChunk = buffer.subarray(chunkDataStart, chunkDataStart + chunkSize);
      break;
    }

    offset = chunkDataStart + paddedSize;
  }

  if (!fmtChunk || !dataChunk || fmtChunk.length < 16) {
    return buffer;
  }

  const audioFormat = fmtChunk.readUInt16LE(0);
  const numChannels = fmtChunk.readUInt16LE(2);
  const sampleRate = fmtChunk.readUInt32LE(4);
  const byteRate = fmtChunk.readUInt32LE(8);
  const blockAlign = fmtChunk.readUInt16LE(12);
  const bitsPerSample = fmtChunk.length >= 14 ? fmtChunk.readUInt16LE(14) : 16;

  const dataSize = dataChunk.length;
  const result = Buffer.alloc(WAV_HEADER_SIZE + dataSize);

  result.write('RIFF', 0);
  result.writeUInt32LE(result.length - 8, 4);
  result.write('WAVE', 8);
  result.write('fmt ', 12);
  result.writeUInt32LE(16, 16);
  result.writeUInt16LE(audioFormat, 20);
  result.writeUInt16LE(numChannels, 22);
  result.writeUInt32LE(sampleRate, 24);
  result.writeUInt32LE(byteRate, 28);
  result.writeUInt16LE(blockAlign, 32);
  result.writeUInt16LE(bitsPerSample, 34);
  result.write('data', 36);
  result.writeUInt32LE(dataSize, 40);
  dataChunk.copy(result, WAV_HEADER_SIZE);

  return result;
}
