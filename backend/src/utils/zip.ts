// src/utils/zip.ts — Zero-dependency, low-RAM ZIP archive creator using Node.js built-in zlib
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface ZipFileInput {
  path: string;
  content: string | Buffer;
}

/**
 * Standard CRC32 calculation table
 */
function createCrc32Table(): Int32Array {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

export function calculateCrc32(buf: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

export function toDosDateTime(d: Date = new Date()): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = Math.floor(d.getSeconds() / 2);

  const date = ((year - 1980) << 9) | (month << 5) | day;
  const time = (hours << 11) | (minutes << 5) | seconds;
  return { time, date };
}

/**
 * Creates a valid PKZIP Buffer in memory from a list of files.
 * Uses Node.js native zlib deflateRawSync.
 */
export function createZipBuffer(files: ZipFileInput[]): Buffer {
  const fileRecords: Buffer[] = [];
  const centralDirectoryHeaders: Buffer[] = [];
  let offset = 0;
  const now = new Date();
  const { time: dosTime, date: dosDate } = toDosDateTime(now);

  for (const file of files) {
    // Normalize path with forward slashes, stripping leading slash
    const normalizedPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const nameBuf = Buffer.from(normalizedPath, 'utf8');
    const dataBuf = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');

    // Deflate raw (no zlib headers)
    const compressedBuf = zlib.deflateRawSync(dataBuf, { level: 6 });
    const crc = calculateCrc32(dataBuf);

    // If compression is not smaller, store uncompressed (method 0)
    const useCompressed = compressedBuf.length < dataBuf.length;
    const compressionMethod = useCompressed ? 8 : 0;
    const bodyBuf = useCompressed ? compressedBuf : dataBuf;

    // Local file header (30 bytes + nameBuf.length)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4);         // Version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // General purpose bit flag (UTF-8 name)
    localHeader.writeUInt16LE(compressionMethod, 8); // Compression method
    localHeader.writeUInt16LE(dosTime, 10);   // Last mod file time
    localHeader.writeUInt16LE(dosDate, 12);   // Last mod file date
    localHeader.writeUInt32LE(crc, 14);       // CRC-32
    localHeader.writeUInt32LE(bodyBuf.length, 18); // Compressed size
    localHeader.writeUInt32LE(dataBuf.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26); // Filename length
    localHeader.writeUInt16LE(0, 28);        // Extra field length

    fileRecords.push(localHeader, nameBuf, bodyBuf);

    // Central directory file header (46 bytes + nameBuf.length)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Signature
    centralHeader.writeUInt16LE(20, 4);         // Version made by
    centralHeader.writeUInt16LE(20, 6);         // Version needed
    centralHeader.writeUInt16LE(0x0800, 8);     // General purpose bit flag (UTF-8)
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(dosTime, 12); // Last mod file time
    centralHeader.writeUInt16LE(dosDate, 14); // Last mod file date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(bodyBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);        // Extra field length
    centralHeader.writeUInt16LE(0, 32);        // File comment length
    centralHeader.writeUInt16LE(0, 34);        // Disk number start
    centralHeader.writeUInt16LE(0, 36);        // Internal file attributes
    centralHeader.writeUInt32LE(0, 38);        // External file attributes
    centralHeader.writeUInt32LE(offset, 42);   // Relative offset of local header

    centralDirectoryHeaders.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + bodyBuf.length;
  }

  const centralDirectoryOffset = offset;
  let centralDirectorySize = 0;
  for (const b of centralDirectoryHeaders) {
    centralDirectorySize += b.length;
  }

  // End of central directory record (EOCD, 22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // Signature
  eocd.writeUInt16LE(0, 4);          // Number of this disk
  eocd.writeUInt16LE(0, 6);          // Disk where central directory starts
  eocd.writeUInt16LE(files.length, 8);  // Number of central directory records on this disk
  eocd.writeUInt16LE(files.length, 10); // Total number of central directory records
  eocd.writeUInt32LE(centralDirectorySize, 12);   // Size of central directory
  eocd.writeUInt32LE(centralDirectoryOffset, 16); // Offset of start of central directory
  eocd.writeUInt16LE(0, 20);         // Comment length

  return Buffer.concat([...fileRecords, ...centralDirectoryHeaders, eocd]);
}

/**
 * Collects files recursively from a directory on disk, excluding sensitive and bulky paths.
 */
export function collectDirectoryFiles(dirPath: string, baseDir: string = dirPath): ZipFileInput[] {
  const IGNORED_NAMES = new Set([
    'node_modules',
    '.git',
    '.venv',
    'venv',
    '__pycache__',
    '.pytest_cache',
    'dist',
    'build',
    '.next',
    '.cache',
    '.mypersonalai.json',
  ]);

  const files: ZipFileInput[] = [];

  function scan(current: string) {
    if (!fs.existsSync(current)) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name)) continue;

      // Exclude secret environment files from downloaded ZIPs
      if (entry.name === '.env' || entry.name.startsWith('.env.')) {
        if (entry.name !== '.env.example') continue;
      }

      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          // Skip extremely large binary files (> 50MB) in zip bundles
          if (stat.size > 50 * 1024 * 1024) continue;
          const content = fs.readFileSync(fullPath);
          files.push({ path: relativePath, content });
        } catch {
          // ignore unreadable files
        }
      }
    }
  }

  scan(dirPath);
  return files;
}

/**
 * Creates a ZIP archive file on disk from a directory using pure Node or PowerShell Compress-Archive.
 */
export async function zipDirectoryToFile(sourceDir: string, destZipPath: string): Promise<{ size: number; path: string }> {
  // Ensure destination directory exists
  fs.mkdirSync(path.dirname(destZipPath), { recursive: true });

  try {
    const files = collectDirectoryFiles(sourceDir);
    const zipBuf = createZipBuffer(files);
    fs.writeFileSync(destZipPath, zipBuf);
    const stat = fs.statSync(destZipPath);
    return { size: stat.size, path: destZipPath };
  } catch (err: any) {
    // Windows PowerShell fallback
    if (process.platform === 'win32') {
      const psCommand = `Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${destZipPath}' -Force`;
      await execFileAsync('powershell.exe', ['-NoProfile', '-Command', psCommand]);
      const stat = fs.statSync(destZipPath);
      return { size: stat.size, path: destZipPath };
    }
    throw err;
  }
}
