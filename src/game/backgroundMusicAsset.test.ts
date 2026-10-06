/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BACKGROUND_MUSIC_PUBLIC_PATH } from './backgroundMusic';

const publicDirectory = new URL('../../public/', import.meta.url);

interface WavInfo {
  fileBytes: number;
  riffBytes: number;
  chunkIds: string[];
  audioFormat: number;
  channels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  dataOffset: number;
  dataBytes: number;
}

type WavFormat = Pick<
  WavInfo,
  | 'audioFormat'
  | 'channels'
  | 'sampleRate'
  | 'byteRate'
  | 'blockAlign'
  | 'bitsPerSample'
>;

function parseWav(file: Buffer): WavInfo {
  if (
    file.toString('ascii', 0, 4) !== 'RIFF' ||
    file.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error('The background music is not a RIFF/WAVE file.');
  }

  const chunkIds: string[] = [];
  let format: WavFormat | undefined;
  let data: { offset: number; bytes: number } | undefined;

  // Walk the chunk list instead of assuming a canonical 44-byte header.
  let offset = 12;
  while (offset + 8 <= file.length) {
    const id = file.toString('ascii', offset, offset + 4);
    const size = file.readUInt32LE(offset + 4);
    const body = offset + 8;
    chunkIds.push(id);

    if (id === 'fmt ') {
      format = {
        audioFormat: file.readUInt16LE(body),
        channels: file.readUInt16LE(body + 2),
        sampleRate: file.readUInt32LE(body + 4),
        byteRate: file.readUInt32LE(body + 8),
        blockAlign: file.readUInt16LE(body + 12),
        bitsPerSample: file.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = { offset: body, bytes: size };
    }

    // RIFF chunks are padded to an even number of bytes.
    offset = body + size + (size % 2);
  }

  if (!format || !data) {
    throw new Error('The WAV file is missing its fmt or data chunk.');
  }

  return {
    fileBytes: file.length,
    riffBytes: file.readUInt32LE(4),
    chunkIds,
    ...format,
    dataOffset: data.offset,
    dataBytes: data.bytes,
  };
}

const wavFile = readFileSync(
  new URL(BACKGROUND_MUSIC_PUBLIC_PATH, publicDirectory),
);
const wav = parseWav(wavFile);
const frameCount = wav.dataBytes / wav.blockAlign;

/** Interleaved signed 16-bit samples, read byte-wise so alignment never matters. */
function readSamples(): Int16Array {
  const samples = new Int16Array(wav.dataBytes / 2);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = wavFile.readInt16LE(wav.dataOffset + index * 2);
  }
  return samples;
}

describe('shared background music asset', () => {
  it('is the only audio file shipped, so every level plays the same track', () => {
    expect(readdirSync(new URL('audio/', publicDirectory))).toEqual([
      'runner-theme-loop.wav',
    ]);
    expect(BACKGROUND_MUSIC_PUBLIC_PATH).toBe('audio/runner-theme-loop.wav');
  });

  it('is a well-formed RIFF/WAVE file whose declared sizes match its bytes', () => {
    expect(wav.chunkIds).toEqual(['fmt ', 'data']);
    expect(wav.riffBytes).toBe(wav.fileBytes - 8);
    expect(wav.dataOffset + wav.dataBytes).toBe(wav.fileBytes);
    expect(wav.fileBytes).toBe(5_292_044);
  });

  it('is 16-bit stereo PCM at 44.1 kHz', () => {
    expect(wav.audioFormat).toBe(1);
    expect(wav.channels).toBe(2);
    expect(wav.sampleRate).toBe(44_100);
    expect(wav.bitsPerSample).toBe(16);
    expect(wav.blockAlign).toBe((wav.channels * wav.bitsPerSample) / 8);
    expect(wav.byteRate).toBe(wav.sampleRate * wav.blockAlign);
  });

  it('lasts exactly 30 seconds', () => {
    expect(wav.dataBytes % wav.blockAlign).toBe(0);
    expect(frameCount).toBe(1_323_000);
    expect(frameCount / wav.sampleRate).toBe(30);
  });

  it('is audible and does not clip', () => {
    const samples = readSamples();
    let peak = 0;
    let clipped = 0;
    let sumOfSquares = 0;
    for (const sample of samples) {
      peak = Math.max(peak, Math.abs(sample));
      sumOfSquares += sample * sample;
      if (sample >= 32_767 || sample <= -32_768) {
        clipped += 1;
      }
    }
    const rms = Math.sqrt(sumOfSquares / samples.length);

    expect(peak).toBeGreaterThan(8_000);
    expect(rms).toBeGreaterThan(1_000);
    expect(clipped).toBe(0);
  });

  it('wraps around without a click at the loop seam', () => {
    const samples = readSamples();
    const lastFrame = (frameCount - 1) * wav.channels;

    // What the listener hears at the wrap: the jump from the final frame back
    // to the first one, per channel.
    let seamStep = 0;
    for (let channel = 0; channel < wav.channels; channel += 1) {
      seamStep = Math.max(
        seamStep,
        Math.abs(samples[channel] - samples[lastFrame + channel]),
      );
    }

    // Ordinary sample-to-sample movement inside the track, as a yardstick.
    const stepCounts = new Uint32Array(65_536);
    for (let index = wav.channels; index < samples.length; index += 1) {
      const step = Math.abs(samples[index] - samples[index - wav.channels]);
      stepCounts[step] += 1;
    }
    const comparedSteps = samples.length - wav.channels;
    let cumulative = 0;
    let interiorP999 = 0;
    for (let step = 0; step < stepCounts.length; step += 1) {
      cumulative += stepCounts[step];
      if (cumulative >= comparedSteps * 0.999) {
        interiorP999 = step;
        break;
      }
    }

    // Measured: seam 107 counts against an interior p99.9 of 1,722. A hard cut
    // would land in the thousands, so 256 (<1% of full scale) leaves headroom
    // while still catching a regenerated asset that lost its crossfade.
    expect(seamStep).toBeLessThanOrEqual(256);
    expect(seamStep).toBeLessThan(interiorP999);
  });
});
