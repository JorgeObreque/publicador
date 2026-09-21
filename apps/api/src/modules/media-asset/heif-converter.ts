import { Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface HeifConversionResult {
  buffer: Buffer;
  outputPath: string;
  outputMime: 'image/jpeg';
  outputBytes: number;
  sourceBytes: number;
  durationMs: number;
}

export class HeifConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HeifConversionError';
  }
}

const CONVERT_BIN = process.env.PUBLICADOR_HEIF_CONVERT_BIN ?? 'heif-convert';
const TARGET_QUALITY = Number(process.env.PUBLICADOR_HEIF_JPEG_QUALITY ?? '90');
const OUTPUT_MIME: HeifConversionResult['outputMime'] = 'image/jpeg';

export async function convertHeifToJpeg(source: Buffer): Promise<HeifConversionResult> {
  const started = Date.now();
  const tempDir = await mkdtemp(join(tmpdir(), 'publicador-heif-'));
  const inputPath = join(tempDir, 'input');
  const outputPath = join(tempDir, 'output.jpg');
  const { writeFile, unlink } = await import('node:fs/promises');
  try {
    await writeFile(inputPath, source);
    await runHeifConvert(inputPath, outputPath);
    const buffer = await readFile(outputPath);
    const sourceStats = await stat(inputPath);
    return {
      buffer,
      outputPath,
      outputMime: OUTPUT_MIME,
      outputBytes: buffer.byteLength,
      sourceBytes: sourceStats.size,
      durationMs: Date.now() - started,
    };
  } finally {
    await Promise.allSettled([unlink(inputPath).catch(() => undefined), unlink(outputPath).catch(() => undefined)]);
    const { rmdir } = await import('node:fs/promises');
    await rmdir(tempDir).catch(() => undefined);
  }
}

async function runHeifConvert(inputPath: string, outputPath: string): Promise<void> {
  const logger = new Logger('HeifConverter');
  return new Promise((resolve, reject) => {
    const child = spawn(CONVERT_BIN, [inputPath, outputPath, '-q', String(TARGET_QUALITY)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stderr: Buffer[] = [];
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) =>
      reject(new HeifConversionError(`No se pudo invocar ${CONVERT_BIN}: ${error.message}`)),
    );
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const message = stderr.length > 0 ? Buffer.concat(stderr).toString('utf8').trim() : `exit ${code}`;
      logger.warn(`heif-convert finalizó con código ${code}: ${message}`);
      reject(
        new HeifConversionError(`Conversión HEIC fallida (${CONVERT_BIN} exit ${code}): ${message}`),
      );
    });
  });
}