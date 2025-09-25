import test from 'node:test';
import assert from 'node:assert/strict';

import { generateSilenceBuffer, concatenateAudioBuffers, __TEST_ONLY__ } from '../utils/audio.js';

const { WAV_HEADER_SIZE } = __TEST_ONLY__;

function readWavSampleCount(buffer, { numChannels = 1, bitsPerSample = 16 }) {
  const dataSize = buffer.readUInt32LE(40);
  const bytesPerSample = bitsPerSample / 8;
  return dataSize / (bytesPerSample * numChannels);
}

test('generateSilenceBuffer produces PCM WAV header with expected defaults', () => {
  const durationSeconds = 0.35;
  const buffer = generateSilenceBuffer(durationSeconds);

  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE');
  assert.equal(buffer.toString('ascii', 12, 16), 'fmt ');

  const chunkSize = buffer.readUInt32LE(4);
  assert.equal(chunkSize, buffer.length - 8);

  const audioFormat = buffer.readUInt16LE(20);
  assert.equal(audioFormat, 1, 'PCM format expected');

  const numChannels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);

  assert.equal(numChannels, 1);
  assert.equal(sampleRate, 44100);
  assert.equal(bitsPerSample, 16);

  const sampleCount = readWavSampleCount(buffer, { numChannels, bitsPerSample });
  const expectedSamples = Math.floor(sampleRate * durationSeconds);
  assert.equal(sampleCount, expectedSamples);

  for (let i = WAV_HEADER_SIZE; i < buffer.length; i += 1) {
    assert.equal(buffer[i], 0, 'Silence buffer should contain zeroed audio data');
  }
});

test('generateSilenceBuffer supports custom audio settings', () => {
  const buffer = generateSilenceBuffer(0.1, {
    sampleRate: 22050,
    bitsPerSample: 8,
    numChannels: 2
  });

  assert.equal(buffer.readUInt16LE(22), 2);
  assert.equal(buffer.readUInt32LE(24), 22050);
  assert.equal(buffer.readUInt16LE(34), 8);

  const byteRate = buffer.readUInt32LE(28);
  assert.equal(byteRate, 22050 * 2 * (8 / 8));

  const blockAlign = buffer.readUInt16LE(32);
  assert.equal(blockAlign, 2 * (8 / 8));
});

test('concatenateAudioBuffers handles edge cases and updates header metadata', () => {
  const emptyResult = concatenateAudioBuffers([]);
  assert.equal(emptyResult.length, 0);

  const single = generateSilenceBuffer(0.05);
  const singleResult = concatenateAudioBuffers([single]);
  assert.notEqual(singleResult, single, 'Should return copy for single buffer');
  assert.equal(singleResult.length, single.length);

  const another = generateSilenceBuffer(0.05);
  const combined = concatenateAudioBuffers([single, another]);
  const expectedLength = single.length + another.length - WAV_HEADER_SIZE;
  assert.equal(combined.length, expectedLength);

  assert.equal(combined.toString('ascii', 0, 4), 'RIFF');
  assert.equal(combined.readUInt32LE(4), combined.length - 8);
  assert.equal(combined.readUInt32LE(40), combined.length - WAV_HEADER_SIZE);

  for (let i = WAV_HEADER_SIZE; i < combined.length; i += 1) {
    assert.equal(combined[i], 0);
  }
});

