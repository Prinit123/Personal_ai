// src/utils/fileParsers.ts — Secure, Zero-Dependency Multi-Format Document & Project Archive Parsers
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

export interface ParsedDocumentResult {
  success: boolean;
  filename: string;
  fileType: string;
  sizeBytes: number;
  extractedText: string;
  error?: string;
  isProjectArchive?: boolean;
  fileTree?: string[];
  summary?: string;
}

// ── Low-Level ZIP Archive Reader (Zero-Dependency) ──────────────────────────

export interface ZipEntry {
  path: string;
  uncompressedSize: number;
  compressedSize: number;
  compressionMethod: number; // 0 = stored, 8 = deflated
  isDirectory: boolean;
  dataOffset: number;
}

/**
 * Parses central directory of a ZIP buffer and returns all entries safely.
 * Protects against Zip Slip, invalid offsets, and path traversal.
 */
export function readZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const len = buffer.length;

  if (len < 22) {
    throw new Error('File is too small to be a valid ZIP archive.');
  }

  // Find End of Central Directory (EOCD) record from end of buffer
  let eocdOffset = -1;
  const maxSearch = Math.min(len - 22, 65536 + 22);
  for (let i = len - 22; i >= len - maxSearch; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Corrupted or invalid ZIP archive (EOCD signature not found).');
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdSize = buffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (cdOffset + cdSize > len) {
    throw new Error('Corrupted ZIP archive: Central directory extends beyond file bounds.');
  }

  let pos = cdOffset;
  for (let i = 0; i < totalEntries && pos < cdOffset + cdSize; i++) {
    const sig = buffer.readUInt32LE(pos);
    if (sig !== 0x02014b50) break; // End of entries or mismatch

    const compressionMethod = buffer.readUInt16LE(pos + 10);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const uncompressedSize = buffer.readUInt32LE(pos + 24);
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const localHeaderOffset = buffer.readUInt32LE(pos + 42);

    const nameRaw = buffer.toString('utf8', pos + 46, pos + 46 + nameLen);
    // Sanitize path against Zip Slip
    const safePath = path.normalize(nameRaw).replace(/\\/g, '/').replace(/^(\.\.\/)+/, '');
    const isDirectory = safePath.endsWith('/') || uncompressedSize === 0 && nameRaw.endsWith('/');

    // Locate local header to compute exact data offset
    let dataOffset = 0;
    if (!isDirectory && localHeaderOffset + 30 <= len) {
      const localSig = buffer.readUInt32LE(localHeaderOffset);
      if (localSig === 0x04034b50) {
        const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
        const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
        dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;
      }
    }

    entries.push({
      path: safePath,
      uncompressedSize,
      compressedSize,
      compressionMethod,
      isDirectory,
      dataOffset,
    });

    pos += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

/**
 * Extracts a specific entry from a ZIP buffer into a Buffer.
 */
export function extractZipEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  if (entry.isDirectory || entry.dataOffset <= 0) {
    return Buffer.alloc(0);
  }

  const end = entry.dataOffset + entry.compressedSize;
  if (end > buffer.length) {
    throw new Error(`Corrupted ZIP entry "${entry.path}": data extends beyond file bounds.`);
  }

  const rawChunk = buffer.subarray(entry.dataOffset, end);

  if (entry.compressionMethod === 0) {
    // Stored (no compression)
    return rawChunk;
  }

  if (entry.compressionMethod === 8) {
    // Deflate
    return zlib.inflateRawSync(rawChunk);
  }

  throw new Error(`Unsupported compression method ${entry.compressionMethod} in entry "${entry.path}".`);
}

// ── Document Parsers ────────────────────────────────────────────────────────

/**
 * Parse Microsoft Word (.docx) document text using built-in ZIP & XML extraction
 */
export function parseDocxBuffer(buffer: Buffer): string {
  const entries = readZipEntries(buffer);
  const docEntry = entries.find(e => e.path === 'word/document.xml' || e.path.endsWith('/document.xml'));

  if (!docEntry) {
    throw new Error('Invalid .docx file: word/document.xml not found.');
  }

  const xmlBuf = extractZipEntry(buffer, docEntry);
  const xml = xmlBuf.toString('utf8');

  // Parse paragraphs and runs
  const paragraphs: string[] = [];
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch;

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[1];
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let tMatch;
    let pText = '';
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      pText += tMatch[1];
    }
    const clean = pText.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
    if (clean) paragraphs.push(clean);
  }

  return paragraphs.join('\n\n');
}

/**
 * Parse Microsoft Excel (.xlsx) spreadsheet into Markdown table format
 */
export function parseXlsxBuffer(buffer: Buffer): string {
  const entries = readZipEntries(buffer);

  // 1. Extract shared strings if present
  const sharedStrings: string[] = [];
  const sharedEntry = entries.find(e => e.path === 'xl/sharedStrings.xml');
  if (sharedEntry) {
    try {
      const sharedXml = extractZipEntry(buffer, sharedEntry).toString('utf8');
      const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
      let siMatch;
      while ((siMatch = siRegex.exec(sharedXml)) !== null) {
        const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let tMatch;
        let s = '';
        while ((tMatch = tRegex.exec(siMatch[1])) !== null) {
          s += tMatch[1];
        }
        sharedStrings.push(s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
      }
    } catch {}
  }

  // 2. Extract first sheet
  const sheetEntry = entries.find(e => e.path === 'xl/worksheets/sheet1.xml') || entries.find(e => e.path.startsWith('xl/worksheets/'));
  if (!sheetEntry) {
    throw new Error('Invalid .xlsx file: No worksheet found.');
  }

  const sheetXml = extractZipEntry(buffer, sheetEntry).toString('utf8');
  const rows: string[][] = [];

  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowContent = rowMatch[1];
    const cRegex = /<c\b[^>]*?(?:\bt="([^"]*)")?[^>]*>(?:[\s\S]*?<v>([\s\S]*?)<\/v>)?/g;
    let cMatch;
    const rowCells: string[] = [];

    while ((cMatch = cRegex.exec(rowContent)) !== null) {
      const type = cMatch[1];
      const val = cMatch[2] !== undefined ? cMatch[2].trim() : '';

      if (!val && !type) {
        rowCells.push('');
        continue;
      }

      if (type === 's') {
        const idx = parseInt(val, 10);
        rowCells.push(!isNaN(idx) && sharedStrings[idx] !== undefined ? sharedStrings[idx] : val);
      } else {
        rowCells.push(val.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
      }
    }

    if (rowCells.some(cell => cell.trim().length > 0)) {
      rows.push(rowCells);
    }
  }

  if (rows.length === 0) return '(Empty Spreadsheet)';

  // Format as Markdown table (up to 50 rows, 10 cols)
  const maxCols = Math.min(10, Math.max(...rows.map(r => r.length)));
  const slicedRows = rows.slice(0, 50).map(r => {
    const pad = [...r];
    while (pad.length < maxCols) pad.push('');
    return pad.slice(0, maxCols);
  });

  const header = `| ${slicedRows[0].map(c => c || ' ').join(' | ')} |`;
  const sep = `| ${slicedRows[0].map(() => '---').join(' | ')} |`;
  const body = slicedRows.slice(1).map(r => `| ${r.map(c => c || ' ').join(' | ')} |`).join('\n');

  return `${header}\n${sep}\n${body}` + (rows.length > 50 ? `\n\n*(Showing 50 of ${rows.length} rows)*` : '');
}

/**
 * Pure Node.js PDF Text Extractor
 * Decompresses FlateDecode content streams and extracts text blocks
 */
export function parsePdfBuffer(buffer: Buffer): string {
  const content = buffer.toString('binary');
  const textChunks: string[] = [];

  // Match all stream objects
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamRegex.exec(content)) !== null) {
    const rawStream = Buffer.from(match[1], 'binary');
    let decompressed: string | null = null;

    try {
      decompressed = zlib.inflateSync(rawStream).toString('utf8');
    } catch {
      try {
        decompressed = zlib.inflateRawSync(rawStream).toString('utf8');
      } catch {
        // Maybe uncompressed plain text stream
        if (/BT[\s\S]*?ET/.test(match[1])) {
          decompressed = match[1];
        }
      }
    }

    if (decompressed) {
      // Extract text from BT ... ET blocks
      const btRegex = /BT([\s\S]*?)ET/g;
      let btMatch;
      while ((btMatch = btRegex.exec(decompressed)) !== null) {
        const block = btMatch[1];
        // Match (string) Tj or [(array)] TJ
        const tjRegex = /\((.*?)\)\s*Tj/g;
        let tjMatch;
        while ((tjMatch = tjRegex.exec(block)) !== null) {
          const str = tjMatch[1].replace(/\\([()\\])/g, '$1');
          if (str.trim()) textChunks.push(str);
        }

        const arrayRegex = /\[(.*?)\]\s*TJ/g;
        let arrMatch;
        while ((arrMatch = arrayRegex.exec(block)) !== null) {
          const inner = arrMatch[1];
          const partRegex = /\((.*?)\)/g;
          let pMatch;
          let word = '';
          while ((pMatch = partRegex.exec(inner)) !== null) {
            word += pMatch[1].replace(/\\([()\\])/g, '$1');
          }
          if (word.trim()) textChunks.push(word);
        }
      }
    }
  }

  const result = textChunks.join(' ').replace(/\s+/g, ' ').trim();
  if (!result) {
    // If stream parsing was empty, search for raw text strings as fallback
    const rawMatches = content.match(/\(([^()]{3,100})\)\s*Tj/g);
    if (rawMatches && rawMatches.length > 0) {
      return rawMatches.map(m => m.replace(/^\(/, '').replace(/\)\s*Tj$/, '')).join(' ');
    }
    return '[PDF Document: Structured document uploaded. No raw extractable text stream found; document may contain scanned imagery or custom font glyphs.]';
  }

  return result;
}

// ── Project ZIP File Analyzer ───────────────────────────────────────────────

const CODE_EXTENSIONS = new Set([
  '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css',
  '.json', '.md', '.csv', '.cpp', '.h', '.hpp', '.c',
  '.java', '.sql', '.yml', '.yaml', '.txt', '.env.example'
]);

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  '.cache', '.vscode', '.idea', 'coverage', 'venv', '.venv'
]);

/**
 * Safely inspects a project ZIP archive, building file tree and extracting
 * relevant code files with size and count limits.
 */
export function parseProjectZip(buffer: Buffer, archiveName: string): ParsedDocumentResult {
  try {
    const entries = readZipEntries(buffer);
    if (entries.length === 0) {
      return {
        success: false,
        filename: archiveName,
        fileType: 'application/zip',
        sizeBytes: buffer.length,
        extractedText: '',
        error: 'ZIP archive is empty.',
      };
    }

    const fileTree: string[] = [];
    const extractedSnippets: string[] = [];
    let totalCodeBytesExtracted = 0;
    const MAX_CODE_BYTES = 150_000; // 150KB limit to avoid context blowup

    // Collect tree
    for (const entry of entries) {
      const parts = entry.path.split('/');
      if (parts.some(p => IGNORED_DIRS.has(p.toLowerCase()))) continue;

      fileTree.push(entry.isDirectory ? `📁 ${entry.path}` : `📄 ${entry.path} (${(entry.uncompressedSize / 1024).toFixed(1)} KB)`);

      if (!entry.isDirectory) {
        const ext = path.extname(entry.path).toLowerCase();
        if (CODE_EXTENSIONS.has(ext) && totalCodeBytesExtracted < MAX_CODE_BYTES) {
          try {
            const raw = extractZipEntry(buffer, entry);
            const text = raw.toString('utf8');
            const snippet = text.slice(0, 10_000); // 10KB per file
            totalCodeBytesExtracted += snippet.length;

            extractedSnippets.push(`--- Project File: "${entry.path}" ---\n${snippet}\n--- End of file ---`);
          } catch {
            // skip unreadable
          }
        }
      }
    }

    const summary = `Project ZIP Archive: "${archiveName}" (${(buffer.length / 1024).toFixed(1)} KB, ${entries.length} items total)`;
    const treeText = `PROJECT DIRECTORY TREE:\n${fileTree.slice(0, 60).join('\n')}${fileTree.length > 60 ? `\n... (+${fileTree.length - 60} more files)` : ''}`;
    const codeText = extractedSnippets.length > 0
      ? `\n\nPROJECT SOURCE CODE SAMPLES (${extractedSnippets.length} files extracted):\n${extractedSnippets.join('\n\n')}`
      : '\n\n(No readable source code files found in archive)';

    return {
      success: true,
      filename: archiveName,
      fileType: 'application/zip',
      sizeBytes: buffer.length,
      isProjectArchive: true,
      fileTree,
      summary,
      extractedText: `${summary}\n\n${treeText}${codeText}`,
    };
  } catch (err: any) {
    return {
      success: false,
      filename: archiveName,
      fileType: 'application/zip',
      sizeBytes: buffer.length,
      extractedText: '',
      error: `Failed to inspect project ZIP archive: ${err.message}`,
    };
  }
}

// ── Unified Master File Extractor ──────────────────────────────────────────

/**
 * Parses any supported document or source code file from disk safely.
 */
export function extractFileContent(filePath: string, originalName: string): ParsedDocumentResult {
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      filename: originalName,
      fileType: 'unknown',
      sizeBytes: 0,
      extractedText: '',
      error: 'Uploaded file could not be found on server disk.',
    };
  }

  const stat = fs.statSync(filePath);
  const sizeBytes = stat.size;

  if (sizeBytes === 0) {
    return {
      success: false,
      filename: originalName,
      fileType: 'empty',
      sizeBytes: 0,
      extractedText: '',
      error: `The file "${originalName}" is empty (0 bytes).`,
    };
  }

  if (sizeBytes > 15 * 1024 * 1024) {
    return {
      success: false,
      filename: originalName,
      fileType: 'oversized',
      sizeBytes,
      extractedText: '',
      error: `The file "${originalName}" is too large (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB). Maximum supported size is 15 MB.`,
    };
  }

  const ext = path.extname(originalName).toLowerCase();

  try {
    const buffer = fs.readFileSync(filePath);

    // 1. Project ZIP archive
    if (ext === '.zip') {
      return parseProjectZip(buffer, originalName);
    }

    // 2. Microsoft Word DOCX
    if (ext === '.docx' || ext === '.doc') {
      const text = parseDocxBuffer(buffer);
      return {
        success: true,
        filename: originalName,
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes,
        extractedText: text ? `--- Content of Word Document "${originalName}" ---\n${text.slice(0, 50_000)}\n--- End of document ---` : '(Word document contains no readable text)',
      };
    }

    // 3. Microsoft Excel XLSX
    if (ext === '.xlsx' || ext === '.xls') {
      const text = parseXlsxBuffer(buffer);
      return {
        success: true,
        filename: originalName,
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes,
        extractedText: `--- Content of Spreadsheet "${originalName}" ---\n${text}\n--- End of spreadsheet ---`,
      };
    }

    // 4. PDF Document
    if (ext === '.pdf') {
      const text = parsePdfBuffer(buffer);
      return {
        success: true,
        filename: originalName,
        fileType: 'application/pdf',
        sizeBytes,
        extractedText: `--- Content of PDF Document "${originalName}" ---\n${text.slice(0, 50_000)}\n--- End of PDF ---`,
      };
    }

    // 5. Source Code & Text files (.py, .js, .jsx, .ts, .tsx, .html, .css, .cpp, .java, .sql, .json, .csv, .md, .txt)
    if (CODE_EXTENSIONS.has(ext) || ext === '.c' || ext === '.h' || ext === '.hpp') {
      const text = buffer.toString('utf8');
      const truncated = text.length > 50_000 ? text.slice(0, 50_000) + `\n\n... [Truncated: File is ${text.length} chars, showing first 50,000]` : text;
      return {
        success: true,
        filename: originalName,
        fileType: 'text/plain',
        sizeBytes,
        extractedText: `--- Content of source file "${originalName}" ---\n${truncated}\n--- End of file ---`,
      };
    }

    // Unsupported format
    return {
      success: false,
      filename: originalName,
      fileType: ext || 'unknown',
      sizeBytes,
      extractedText: '',
      error: `Unsupported file format "${ext}". Supported formats: .py, .js, .jsx, .ts, .tsx, .html, .css, .cpp, .java, .pdf, .docx, .xlsx, .zip, .txt, .md, .json, .csv.`,
    };
  } catch (err: any) {
    return {
      success: false,
      filename: originalName,
      fileType: ext,
      sizeBytes,
      extractedText: '',
      error: `Failed to read file "${originalName}": ${err.message}`,
    };
  }
}
