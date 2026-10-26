import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOADS_DIR = path.resolve(__dirname, '../../../data/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ── Allowed MIME types and extensions ──────────────────────────────────────────

const ALLOWED_IMAGES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const ALLOWED_DOCS = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/zip',
  'application/x-zip-compressed',
  'text/markdown',
  'application/json',
  'text/csv',
  'text/javascript',
  'application/javascript',
  'text/html',
  'text/css',
  'text/x-python',
  'application/x-python-code',
  'text/x-c',
  'text/x-c++',
  'text/x-java-source',
]);

const ALLOWED_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.pdf', '.docx', '.doc', '.xlsx', '.xls',
  '.txt', '.md', '.json', '.csv',
  '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.cpp', '.h', '.hpp', '.c', '.java', '.sql',
  '.zip',
]);

function sanitizeFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
  return `${base || 'file'}${ext}`;
}

export function getAttachmentType(mimeType: string, filename: string): 'image' | 'file' {
  if (ALLOWED_IMAGES.has(mimeType.toLowerCase()) || /\.(png|jpe?g|webp|gif)$/i.test(filename)) {
    return 'image';
  }
  return 'file';
}

// ── Multer Storage & Filter Configuration ──────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = sanitizeFilename(file.originalname);
    const uniqueName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req: any, file: any, cb: any) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  const isAllowedExt = ALLOWED_EXTS.has(ext);
  const isAllowedMime = ALLOWED_IMAGES.has(mime) || ALLOWED_DOCS.has(mime) || mime.startsWith('text/');

  if (isAllowedExt || isAllowedMime) {
    cb(null, true);
  } else {
    cb(new Error(`File type "${ext || mime}" is not allowed. Supported formats: .py, .js, .jsx, .ts, .tsx, .html, .css, .cpp, .java, .pdf, .docx, .xlsx, .zip, .txt, .md, .json, .csv, and images (.png, .jpg, .webp).`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file
    files: 10,
  },
});

export interface UploadedAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: 'image' | 'file';
  mimeType: string;
  storedFilename: string;
}

// ── Route: POST /api/upload ───────────────────────────────────────────────────

router.post('/upload', (req: Request, res: Response, next: NextFunction) => {
  upload.array('files', 10)(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum allowed size is 10MB per file.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Too many files uploaded at once. Maximum is 10 files.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded. Provide at least one file.' });
    }

    const uploaded: UploadedAttachment[] = files.map(f => {
      const type = getAttachmentType(f.mimetype, f.originalname);
      return {
        id: randomUUID(),
        name: f.originalname,
        url: `/uploads/${f.filename}`,
        size: f.size,
        type,
        mimeType: f.mimetype,
        storedFilename: f.filename,
      };
    });

    return res.json({
      success: true,
      files: uploaded,
    });
  });
});

export default router;
