// src/routes/projects.ts — Secure Project Workspace Management and File Operations
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_BASE = path.resolve(__dirname, '../../../projects');

// Ensure base projects dir exists
if (!fs.existsSync(PROJECTS_BASE)) {
  fs.mkdirSync(PROJECTS_BASE, { recursive: true });
}

export interface ProjectMetadata {
  id: string;
  name: string;
  description: string;
  path: string;
  createdAt: number;
  updatedAt: number;
  status: 'idle' | 'running' | 'error';
  filesCount?: number;
}

// ── GET /api/projects — List all projects ──────────────────────────────────────

router.get('/projects', (_req, res) => {
  try {
    const entries = fs.readdirSync(PROJECTS_BASE, { withFileTypes: true });
    const projects: ProjectMetadata[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projDir = path.join(PROJECTS_BASE, entry.name);
        const metaFile = path.join(projDir, '.mypersonalai.json');

        let meta: ProjectMetadata;
        if (fs.existsSync(metaFile)) {
          try {
            meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
          } catch {
            meta = {
              id: entry.name,
              name: entry.name,
              description: 'Project in MyPersonalAI workspace',
              path: projDir,
              createdAt: fs.statSync(projDir).birthtimeMs,
              updatedAt: fs.statSync(projDir).mtimeMs,
              status: 'idle',
            };
          }
        } else {
          meta = {
            id: entry.name,
            name: entry.name,
            description: 'Project in MyPersonalAI workspace',
            path: projDir,
            createdAt: fs.statSync(projDir).birthtimeMs,
            updatedAt: fs.statSync(projDir).mtimeMs,
            status: 'idle',
          };
        }
        projects.push(meta);
      }
    }

    projects.sort((a, b) => b.updatedAt - a.updatedAt);
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/projects — Create a new project workspace ───────────────────────

router.post('/projects', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Valid project name is required' });
    }

    const sanitized = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
    if (!sanitized) {
      return res.status(400).json({ error: 'Project name must contain alphanumeric characters' });
    }

    const projDir = path.join(PROJECTS_BASE, sanitized);
    if (fs.existsSync(projDir)) {
      return res.status(409).json({ error: 'A project with that name already exists' });
    }

    fs.mkdirSync(projDir, { recursive: true });

    const meta: ProjectMetadata = {
      id: sanitized,
      name: name.trim(),
      description: description || 'Created with Nilesh',
      path: projDir,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'idle',
    };

    fs.writeFileSync(
      path.join(projDir, '.mypersonalai.json'),
      JSON.stringify(meta, null, 2),
      'utf-8'
    );

    res.status(201).json(meta);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects/:id/summary-files — Flat list files in a project ────────
router.get('/projects/:id/summary-files', (req, res) => {
  const { id } = req.params;
  const projDir = path.join(PROJECTS_BASE, id);

  if (!fs.existsSync(projDir) || !projDir.startsWith(PROJECTS_BASE)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const fileList: Array<{ path: string; size: number; isDir: boolean }> = [];

  function scan(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(projDir, fullPath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          fileList.push({ path: relPath, size: 0, isDir: true });
          scan(fullPath);
        } else {
          fileList.push({ path: relPath, size: fs.statSync(fullPath).size, isDir: false });
        }
      }
    } catch { /* skip */ }
  }

  scan(projDir);
  res.json({ projectId: id, files: fileList });
});

// ── POST /api/projects/apply-files — Safe file generator with review & approval ───

router.post('/projects/apply-files', (req, res) => {
  const { projectId, projectName, files } = req.body;

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'Files array is required and cannot be empty.' });
  }

  const targetId = projectId || (projectName ? projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-') : 'kict-website');
  const projDir = path.join(PROJECTS_BASE, targetId);

  // Security check: ensure path is strictly inside PROJECTS_BASE
  if (!projDir.startsWith(PROJECTS_BASE)) {
    return res.status(403).json({ error: 'Security violation: invalid project directory.' });
  }

  // Create project dir if it doesn't exist yet
  if (!fs.existsSync(projDir)) {
    fs.mkdirSync(projDir, { recursive: true });
    const meta: ProjectMetadata = {
      id: targetId,
      name: projectName || targetId,
      description: 'Project generated by Nilesh',
      path: projDir,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'idle',
    };
    fs.writeFileSync(path.join(projDir, '.mypersonalai.json'), JSON.stringify(meta, null, 2), 'utf-8');
  }

  const createdFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const item of files) {
    if (!item.path || typeof item.content !== 'string') continue;

    // Sanitize path against directory traversal
    const safeRel = path.normalize(item.path).replace(/^(\.\.[\\/])+/, '').replace(/^([a-zA-Z]:[\\/])+/, '');
    const fullPath = path.join(projDir, safeRel);

    if (!fullPath.startsWith(projDir)) {
      errors.push({ file: item.path, error: 'Path traversal disallowed' });
      continue;
    }

    try {
      const exists = fs.existsSync(fullPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, item.content, 'utf-8');

      if (exists) {
        modifiedFiles.push(safeRel.replace(/\\/g, '/'));
      } else {
        createdFiles.push(safeRel.replace(/\\/g, '/'));
      }
    } catch (err: any) {
      errors.push({ file: safeRel, error: err.message });
    }
  }

  // Update metadata
  const metaFile = path.join(projDir, '.mypersonalai.json');
  try {
    const meta: ProjectMetadata = fs.existsSync(metaFile)
      ? JSON.parse(fs.readFileSync(metaFile, 'utf-8'))
      : { id: targetId, name: targetId, description: '', path: projDir, createdAt: Date.now(), updatedAt: Date.now(), status: 'idle' };
    meta.updatedAt = Date.now();
    meta.filesCount = (meta.filesCount ?? 0) + createdFiles.length;
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf-8');
  } catch { /* non-fatal */ }

  return res.json({
    success: true,
    projectId: targetId,
    projectDir: projDir,
    createdFiles,
    modifiedFiles,
    totalFilesProcessed: createdFiles.length + modifiedFiles.length,
    errors,
  });
});

export default router;
