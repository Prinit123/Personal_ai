import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_BASE = path.resolve(__dirname, '../../../projects');

// Tree node interface
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

function buildTree(dir: string, baseDir: string, maxDepth = 4): FileNode[] {
  if (maxDepth <= 0 || !fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(baseDir, full).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: rel,
        type: 'directory',
        children: buildTree(full, baseDir, maxDepth - 1),
      });
    } else {
      nodes.push({
        name: entry.name,
        path: rel,
        type: 'file',
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

// Get file tree for project
router.get('/projects/:id/files', (req, res) => {
  const projDir = path.join(PROJECTS_BASE, req.params.id);
  if (!fs.existsSync(projDir)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const tree = buildTree(projDir, projDir);
    res.json(tree);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Read file content
router.get('/projects/:id/file', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  const projDir = path.join(PROJECTS_BASE, req.params.id);
  const target = path.resolve(projDir, filePath);

  // Security: prevent path traversal outside workspace
  if (!target.startsWith(projDir)) {
    return res.status(403).json({ error: 'Access denied: Path outside workspace' });
  }

  if (!fs.existsSync(target)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const content = fs.readFileSync(target, 'utf-8');
    res.json({ path: filePath, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Write / edit file content
router.post('/projects/:id/file', (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'path and content are required' });
  }

  const projDir = path.join(PROJECTS_BASE, req.params.id);
  const target = path.resolve(projDir, filePath);

  // Security: prevent path traversal outside workspace
  if (!target.startsWith(projDir)) {
    return res.status(403).json({ error: 'Access denied: Path outside workspace' });
  }

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf-8');
    res.json({ success: true, path: filePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
