// src/routes/fileManager.ts — Robust Project Scanner, File Generator, Downloads & Save As Manager
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { db, getSetting, setSetting } from '../db.ts';
import { createZipBuffer, collectDirectoryFiles } from '../utils/zip.ts';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_BASE = path.resolve(__dirname, '../../../projects');

// ─── Dynamic Windows Paths & Organization Detection ──────────────────────────

export function getSystemPaths() {
  const home = os.homedir();
  const userProfile = process.platform === 'win32' ? (process.env.USERPROFILE || home) : home;
  const username = os.userInfo().username || path.basename(userProfile);
  
  // Custom downloads dir from SQLite settings if configured
  const customDownloads = getSetting('downloads_dir');
  const downloadsDir = customDownloads && fs.existsSync(customDownloads)
    ? path.resolve(customDownloads)
    : path.join(userProfile, 'Downloads');

  const nileshBase = path.join(downloadsDir, 'NileshAI');

  const subFolders = {
    projects:     path.join(nileshBase, 'Projects'),
    documents:    path.join(nileshBase, 'Documents'),
    mlProjects:   path.join(nileshBase, 'MLProjects'),
    codeExamples: path.join(nileshBase, 'CodeExamples'),
    backups:      path.join(nileshBase, 'Backups'),
  };

  return {
    home,
    userProfile,
    username,
    platform: process.platform,
    downloads: downloadsDir,
    nileshBase,
    subFolders,
    workspaceProjects: PROJECTS_BASE,
  };
}

/**
 * Ensure default Downloads\NileshAI folders exist safely
 */
export function ensureNileshFolders(): void {
  try {
    const paths = getSystemPaths();
    if (!fs.existsSync(paths.downloads)) {
      fs.mkdirSync(paths.downloads, { recursive: true });
    }
    if (!fs.existsSync(paths.nileshBase)) {
      fs.mkdirSync(paths.nileshBase, { recursive: true });
    }
    for (const folder of Object.values(paths.subFolders)) {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }
    }
  } catch (err: any) {
    console.warn('[FileManager] Warning: Could not initialize all Nilesh folders:', err.message);
  }
}

// Initialize on startup
ensureNileshFolders();

// ─── Path Sanitization & Traversal Prevention ────────────────────────────────

/**
 * Resolve `targetPath` and verify it sits inside one of the `allowedRoots`.
 * Throws if the resolved path escapes all allowed roots.
 * Pass `allowedRoots = []` to skip root-containment (use only for explicit
 * user-chosen paths that don't need containment, e.g. custom downloads dir).
 */
export function sanitizePath(
  targetPath: string,
  allowedRoots: string[] = []
): string {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Path must be a non-empty string');
  }

  const resolved = path.resolve(targetPath);

  // Reject null bytes (always malicious)
  if (resolved.includes('\0')) {
    throw new Error('Path contains null byte');
  }

  if (allowedRoots.length === 0) {
    // No root restriction requested — just return the resolved path
    return resolved;
  }

  // Ensure resolved path is inside at least one of the allowed roots
  const isAllowed = allowedRoots.some((root) => {
    const normalRoot = path.resolve(root);
    return (
      resolved === normalRoot ||
      resolved.startsWith(normalRoot + path.sep)
    );
  });

  if (!isAllowed) {
    throw new Error('Path traversal denied: target is outside allowed directories');
  }

  return resolved;
}

// ─── File MIME Type Helper ───────────────────────────────────────────────────

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.py':    'text/x-python; charset=utf-8',
    '.js':    'application/javascript; charset=utf-8',
    '.jsx':   'text/jsx; charset=utf-8',
    '.ts':    'application/typescript; charset=utf-8',
    '.tsx':   'text/tsx; charset=utf-8',
    '.html':  'text/html; charset=utf-8',
    '.css':   'text/css; charset=utf-8',
    '.json':  'application/json; charset=utf-8',
    '.md':    'text/markdown; charset=utf-8',
    '.txt':   'text/plain; charset=utf-8',
    '.csv':   'text/csv; charset=utf-8',
    '.pdf':   'application/pdf',
    '.zip':   'application/zip',
    '.png':   'image/png',
    '.jpg':   'image/jpeg',
    '.jpeg':  'image/jpeg',
    '.svg':   'image/svg+xml',
    '.sql':   'text/x-sql; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

// ─── GET /api/file-manager/config — Returns platform info and save directories ─

router.get('/file-manager/config', (_req, res) => {
  try {
    ensureNileshFolders();
    const paths = getSystemPaths();
    const orgMode = getSetting('downloads_org_mode') || 'organized';
    const autoSave = getSetting('auto_save_enabled') !== 'false';
    const saveToDownloads = getSetting('save_to_downloads') !== 'false';

    res.json({
      success: true,
      username: paths.username,
      platform: paths.platform,
      downloadsDir: paths.downloads,
      nileshBaseDir: paths.nileshBase,
      subFolders: paths.subFolders,
      workspaceProjectsDir: paths.workspaceProjects,
      downloadsOrgMode: orgMode,
      autoSaveEnabled: autoSave,
      saveToDownloads,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/file-manager/config — Update preferences ───────────────────────

router.post('/file-manager/config', (req, res) => {
  try {
    const { downloadsDir, downloadsOrgMode, autoSaveEnabled, saveToDownloads } = req.body;

    if (downloadsDir && typeof downloadsDir === 'string') {
      const sanitized = sanitizePath(downloadsDir);
      if (fs.existsSync(sanitized)) {
        setSetting('downloads_dir', sanitized);
      }
    }
    if (downloadsOrgMode) {
      setSetting('downloads_org_mode', downloadsOrgMode === 'direct' ? 'direct' : 'organized');
    }
    if (autoSaveEnabled !== undefined) {
      setSetting('auto_save_enabled', String(autoSaveEnabled));
    }
    if (saveToDownloads !== undefined) {
      setSetting('save_to_downloads', String(saveToDownloads));
    }

    ensureNileshFolders();
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/file-manager/scan — Project Scanner & Context Engine ───────────

router.post('/file-manager/scan', async (req, res) => {
  try {
    const { projectPath } = req.body;
    if (!projectPath || typeof projectPath !== 'string') {
      return res.status(400).json({ error: 'Valid projectPath string is required' });
    }

    const safePath = sanitizePath(projectPath, [PROJECTS_BASE, os.homedir()]);
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: `Directory does not exist: "${safePath}"` });
    }

    const stat = fs.statSync(safePath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: `Path is not a directory: "${safePath}"` });
    }

    const IGNORED = new Set([
      'node_modules', '.git', '.venv', 'venv', '__pycache__',
      'dist', 'build', '.next', '.cache', '.turbo', '.idea', '.vscode'
    ]);

    const languageCounts: Record<string, number> = {};
    const frameworkSet = new Set<string>();
    const entryPoints: string[] = [];
    const configFiles: string[] = [];
    const dependencies: Record<string, string> = {};
    const missingConfigs: string[] = [];
    const likelyErrors: string[] = [];
    const fileList: Array<{ name: string; path: string; size: number; ext: string }> = [];

    let hasPackageJson = false;
    let hasRequirementsTxt = false;
    let hasPyproject = false;
    let hasGitignore = false;
    let hasEnv = false;
    let hasEnvExample = false;
    let hasNodeModules = false;
    let totalBytes = 0;

    function walk(currentDir: string, depth = 0) {
      if (depth > 6) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (IGNORED.has(entry.name)) {
          if (entry.name === 'node_modules') hasNodeModules = true;
          continue;
        }

        const full = path.join(currentDir, entry.name);
        const rel = path.relative(safePath, full).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          walk(full, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const fsize = fs.statSync(full).size;
          totalBytes += fsize;

          fileList.push({ name: entry.name, path: rel, size: fsize, ext });

          // Track languages
          if (ext) {
            languageCounts[ext] = (languageCounts[ext] || 0) + 1;
          }

          // Check entry points
          if (['index.html', 'main.py', 'app.py', 'server.js', 'server.ts', 'src/index.ts', 'src/main.tsx', 'src/App.tsx', 'src/App.jsx'].includes(rel)) {
            entryPoints.push(rel);
          }

          // Check config files
          if (entry.name === 'package.json') {
            hasPackageJson = true;
            configFiles.push(rel);
            try {
              const pkg = JSON.parse(fs.readFileSync(full, 'utf8'));
              const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
              Object.assign(dependencies, allDeps);

              if (allDeps.react) frameworkSet.add('React');
              if (allDeps.next) frameworkSet.add('Next.js');
              if (allDeps.express) frameworkSet.add('Express');
              if (allDeps.vite) frameworkSet.add('Vite');
              if (allDeps.vue) frameworkSet.add('Vue');
              if (allDeps.mongoose) frameworkSet.add('MongoDB/Mongoose');
              if (allDeps.tailwindcss) frameworkSet.add('TailwindCSS');
              if (allDeps.typescript) frameworkSet.add('TypeScript');
            } catch {
              likelyErrors.push(`Failed to parse ${rel} as valid JSON`);
            }
          }

          if (entry.name === 'requirements.txt') {
            hasRequirementsTxt = true;
            configFiles.push(rel);
            try {
              const lines = fs.readFileSync(full, 'utf8').split('\n');
              for (const l of lines) {
                const clean = l.trim().split('#')[0].trim();
                if (!clean) continue;
                const pkgName = clean.split(/[=<>~]/)[0].trim();
                dependencies[pkgName] = clean;
                if (/django/i.test(pkgName)) frameworkSet.add('Django');
                if (/flask/i.test(pkgName)) frameworkSet.add('Flask');
                if (/fastapi/i.test(pkgName)) frameworkSet.add('FastAPI');
                if (/pandas/i.test(pkgName)) frameworkSet.add('Pandas');
                if (/numpy/i.test(pkgName)) frameworkSet.add('NumPy');
                if (/torch|pytorch/i.test(pkgName)) frameworkSet.add('PyTorch');
                if (/tensorflow/i.test(pkgName)) frameworkSet.add('TensorFlow');
                if (/scikit-learn|sklearn/i.test(pkgName)) frameworkSet.add('Scikit-learn');
              }
            } catch {}
          }

          if (entry.name === 'pyproject.toml') {
            hasPyproject = true;
            configFiles.push(rel);
          }
          if (entry.name === '.gitignore') hasGitignore = true;
          if (entry.name === '.env') hasEnv = true;
          if (entry.name === '.env.example') hasEnvExample = true;
        }
      }
    }

    walk(safePath);

    // Diagnostics & Missing Configurations
    if (hasPackageJson && !hasNodeModules) {
      missingConfigs.push('Dependencies not installed (node_modules is missing). Run: npm install');
    }
    if (hasEnv && !hasEnvExample) {
      missingConfigs.push('Missing .env.example (shared template for environment variables).');
    }
    if (hasEnv && !hasGitignore) {
      likelyErrors.push('.env file detected without a .gitignore! Risk of leaking secrets.');
    }
    if (!hasPackageJson && !hasRequirementsTxt && !hasPyproject && fileList.length > 5) {
      missingConfigs.push('No standard package manager manifest found (package.json or requirements.txt).');
    }

    // Determine primary run instructions
    const runInstructions: string[] = [];
    if (hasPackageJson) {
      runInstructions.push('1. Install dependencies: npm install');
      runInstructions.push('2. Start development: npm run dev (or npm start)');
    } else if (hasRequirementsTxt || hasPyproject) {
      runInstructions.push('1. Create virtual environment: python -m venv venv');
      runInstructions.push('2. Activate: .\\venv\\Scripts\\activate (Windows)');
      runInstructions.push('3. Install dependencies: pip install -r requirements.txt');
      runInstructions.push('4. Run main program: python main.py (or app.py)');
    } else if (fileList.some(f => f.name.endsWith('.html'))) {
      runInstructions.push('Double-click index.html or open with Live Server');
    }

    const primaryLangs = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ext, count]) => ({ ext, count }));

    res.json({
      success: true,
      projectPath: safePath,
      projectName: path.basename(safePath),
      totalFiles: fileList.length,
      totalBytes,
      primaryLanguages: primaryLangs,
      frameworks: Array.from(frameworkSet),
      entryPoints,
      configFiles,
      dependenciesCount: Object.keys(dependencies).length,
      dependenciesList: Object.keys(dependencies).slice(0, 30),
      missingConfigs,
      likelyErrors,
      runInstructions,
      scannedAt: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/file-manager/save-to-disk — Verified Local File & Project Saver ─

router.post('/file-manager/save-to-disk', async (req, res) => {
  try {
    const {
      projectName,
      files,
      category = 'projects',
      overwrite = false,
      customTargetDir,
    } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files array is required and cannot be empty' });
    }

    const paths = getSystemPaths();
    ensureNileshFolders();

    const cleanProjectName = (projectName || 'GeneratedProject')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '-');

    const orgMode = getSetting('downloads_org_mode') || 'organized';

    let targetDir: string;

    if (customTargetDir && typeof customTargetDir === 'string') {
      targetDir = sanitizePath(customTargetDir);
    } else if (orgMode === 'direct') {
      // Direct in Downloads
      targetDir = path.join(paths.downloads, cleanProjectName);
    } else {
      // Organized in subfolders
      const sub = category === 'ml' ? paths.subFolders.mlProjects
        : category === 'document' ? paths.subFolders.documents
        : category === 'code-example' ? paths.subFolders.codeExamples
        : paths.subFolders.projects;
      targetDir = path.join(sub, cleanProjectName);
    }

    // Overwrite prevention: if directory exists and overwrite is false, find unique name
    if (fs.existsSync(targetDir) && !overwrite) {
      let counter = 1;
      let candidate = `${targetDir}-${counter}`;
      while (fs.existsSync(candidate)) {
        counter++;
        candidate = `${targetDir}-${counter}`;
      }
      targetDir = candidate;
    }

    // Ensure target folder exists
    fs.mkdirSync(targetDir, { recursive: true });

    const createdFiles: string[] = [];
    const verifiedFiles: Array<{ path: string; size: number }> = [];
    const errors: Array<{ file: string; error: string }> = [];

    // Ensure README.md exists with instructions if this is a project
    const hasReadme = files.some(f => /readme\.md$/i.test(f.path));
    const allFilesToWrite = [...files];

    if (!hasReadme && files.length > 1) {
      const isPython = files.some(f => f.path.endsWith('.py'));
      const isNode = files.some(f => f.path.endsWith('package.json') || f.path.endsWith('.jsx') || f.path.endsWith('.tsx'));
      let readmeContent = `# ${path.basename(targetDir)}\n\nGenerated with Nilesh AI.\n\n## Quick Start\n\n`;

      if (isNode) {
        readmeContent += `\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`;
      } else if (isPython) {
        readmeContent += `\`\`\`bash\npython -m venv venv\n.\\venv\\Scripts\\activate\npip install -r requirements.txt\npython main.py\n\`\`\`\n`;
      } else {
        readmeContent += `Open index.html in your browser.\n`;
      }
      allFilesToWrite.push({ path: 'README.md', content: readmeContent });
    }

    // Write every file with path verification
    for (const f of allFilesToWrite) {
      if (!f.path || f.content === undefined) continue;

      const safeRel = path.normalize(f.path)
        .replace(/^(\.\.[/\\])+/, '')
        .replace(/^[a-zA-Z]:[/\\]+/, '');

      const fullPath = path.join(targetDir, safeRel);

      // Path traversal security check
      if (!fullPath.startsWith(targetDir)) {
        errors.push({ file: f.path, error: 'Path traversal denied' });
        continue;
      }

      try {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        const contentStr = typeof f.content === 'string' ? f.content : String(f.content);
        fs.writeFileSync(fullPath, contentStr, 'utf8');

        // VERIFY on disk immediately
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          createdFiles.push(safeRel.replace(/\\/g, '/'));
          verifiedFiles.push({ path: safeRel.replace(/\\/g, '/'), size: stat.size });
        } else {
          errors.push({ file: safeRel, error: 'File verification failed after write' });
        }
      } catch (err: any) {
        errors.push({ file: safeRel, error: err.message });
      }
    }

    // Total size verified
    const totalSize = verifiedFiles.reduce((sum, f) => sum + f.size, 0);

    // Save to operation history in SQLite
    const opId = 'op-' + Date.now().toString(36);
    try {
      db.prepare(`
        INSERT INTO file_operations (id, type, name, target_path, file_count, size_bytes, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        opId,
        'save-to-disk',
        path.basename(targetDir),
        targetDir,
        verifiedFiles.length,
        totalSize,
        errors.length === 0 ? 'verified' : 'partial',
        Date.now()
      );
    } catch {}

    res.json({
      success: true,
      verified: true,
      exactPath: targetDir,
      projectName: path.basename(targetDir),
      totalFiles: verifiedFiles.length,
      filesWritten: verifiedFiles,
      totalSize,
      errors,
      savedAt: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/download/project-zip — Returns Complete Project as ZIP Attachment

router.post('/download/project-zip', async (req, res) => {
  try {
    const { projectName, files } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files array is required and cannot be empty' });
    }

    const cleanProjectName = (projectName || 'Project')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '-') || 'Nilesh-Project';

    // Validate and clean each file
    const validFiles: Array<{ path: string; content: string | Buffer }> = [];
    for (const f of files) {
      if (!f || typeof f !== 'object') continue;
      const rawPath = String(f.path || '').trim();
      if (!rawPath) continue;

      // Sanitize relative path
      const safeRel = rawPath
        .replace(/\\/g, '/')
        .replace(/^(\.\.\/)+/, '')
        .replace(/^[a-zA-Z]:\/+/, '');

      const content = f.content !== undefined ? (typeof f.content === 'string' ? f.content : String(f.content)) : '';
      validFiles.push({ path: safeRel, content });
    }

    if (validFiles.length === 0) {
      return res.status(400).json({ error: 'No valid files provided for ZIP packaging' });
    }

    // Add README.md if missing and multiple files
    const hasReadme = validFiles.some(f => /readme\.md$/i.test(f.path));
    if (!hasReadme && validFiles.length > 1) {
      const isNode = validFiles.some(f => f.path.endsWith('package.json') || f.path.endsWith('.jsx') || f.path.endsWith('.tsx'));
      const isPython = validFiles.some(f => f.path.endsWith('.py'));
      let readme = `# ${cleanProjectName}\n\nGenerated with Nilesh AI.\n\n## Setup & Run Instructions\n\n`;
      if (isNode) {
        readme += `\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`;
      } else if (isPython) {
        readme += `\`\`\`bash\npython -m venv venv\n.\\venv\\Scripts\\activate\npip install -r requirements.txt\npython main.py\n\`\`\`\n`;
      } else {
        readme += `Open index.html in your browser.\n`;
      }
      validFiles.push({ path: 'README.md', content: readme });
    }

    const zipBuffer = createZipBuffer(validFiles);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanProjectName}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.end(zipBuffer);
  } catch (err: any) {
    console.error('[Download project-zip error]', err);
    return res.status(500).json({ error: 'Failed to package project ZIP: ' + err.message });
  }
});

// ─── POST /api/download/single-file — Download Individual File Attachment ─────

router.post('/download/single-file', (req, res) => {
  try {
    const { filename, content } = req.body;
    if (!filename || content === undefined) {
      return res.status(400).json({ error: 'filename and content are required' });
    }

    const cleanName = path.basename(filename).replace(/[\\/:*?"<>|]/g, '_') || 'download.txt';
    const mimeType = getMimeType(cleanName);
    const contentBuf = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${cleanName}"`);
    res.setHeader('Content-Length', contentBuf.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.end(contentBuf);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET fallback for single-file (allows downloading via direct browser link or query)
router.get('/download/single-file', (req, res) => {
  const { filename, content } = req.query;
  if (!filename || content === undefined) {
    return res.status(400).json({ error: 'Query parameters filename and content are required for GET' });
  }
  const cleanName = path.basename(String(filename)).replace(/[\\/:*?"<>|]/g, '_') || 'download.txt';
  const mimeType = getMimeType(cleanName);
  const contentBuf = Buffer.from(String(content), 'utf8');

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${cleanName}"`);
  res.setHeader('Content-Length', contentBuf.length);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  return res.end(contentBuf);
});

// ─── POST /api/download/directory-zip — Package Any Disk Directory as ZIP ─────

router.post('/download/directory-zip', (req, res) => {
  try {
    const { directoryPath, archiveName } = req.body;
    if (!directoryPath || typeof directoryPath !== 'string') {
      return res.status(400).json({ error: 'directoryPath string is required' });
    }

    // Restrict to workspace projects only
    const safePath = sanitizePath(directoryPath, [PROJECTS_BASE]);
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: `Directory does not exist: "${safePath}"` });
    }

    const stat = fs.statSync(safePath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: `Path is not a directory: "${safePath}"` });
    }

    const files = collectDirectoryFiles(safePath);
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files found in directory to zip' });
    }

    const zipName = (archiveName || path.basename(safePath)).trim().replace(/[\\/:*?"<>|]/g, '-') || 'Archive';
    const zipBuffer = createZipBuffer(files);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.end(zipBuffer);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to package directory ZIP: ' + err.message });
  }
});

// ─── GET /api/download/project/:id/zip — Download Existing Project From Workspace

router.get('/download/project/:id/zip', (req, res) => {
  try {
    const { id } = req.params;
    const projDir = path.join(PROJECTS_BASE, id);

    if (!fs.existsSync(projDir)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const files = collectDirectoryFiles(projDir);
    const zipBuf = createZipBuffer(files);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${id}.zip"`);
    res.setHeader('Content-Length', zipBuf.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.end(zipBuf);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/file-manager/open-explorer — Reveal in Windows File Explorer ────

// Allowed roots for open-explorer: workspace projects and user's home folder
function getAllowedExplorerRoots(): string[] {
  return [
    PROJECTS_BASE,
    os.homedir(),
    getSystemPaths().downloads,
  ];
}

router.post('/file-manager/open-explorer', (req, res) => {
  try {
    const { targetPath } = req.body;
    if (!targetPath || typeof targetPath !== 'string') {
      return res.status(400).json({ error: 'targetPath is required' });
    }

    // Restrict to allowed roots — no arbitrary filesystem access
    const safePath = sanitizePath(targetPath, getAllowedExplorerRoots());
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: 'Target path does not exist on disk' });
    }

    if (process.platform === 'win32') {
      const isFile = fs.statSync(safePath).isFile();
      // Use spawn instead of exec to avoid shell injection — args are passed
      // directly to the OS without going through a shell interpreter.
      const explorerArgs = isFile ? ['/select,', safePath] : [safePath];
      spawn('explorer.exe', explorerArgs, { detached: true, stdio: 'ignore' }).unref();
      return res.json({ success: true, message: `Opened File Explorer to: ${safePath}` });
    } else {
      return res.json({ success: true, message: `Path on disk: ${safePath}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/file-manager/create-backup — Pre-modification Snapshot ─────────

router.post('/file-manager/create-backup', (req, res) => {
  try {
    const { sourcePath, projectName } = req.body;
    if (!sourcePath || typeof sourcePath !== 'string') {
      return res.status(400).json({ error: 'sourcePath is required' });
    }

    // Only allow backing up paths inside known safe roots
    let safeSource: string;
    try {
      safeSource = sanitizePath(sourcePath, [
        PROJECTS_BASE,
        getSystemPaths().downloads,
        os.homedir(),
      ]);
    } catch {
      return res.status(403).json({ error: 'sourcePath is outside allowed directories' });
    }

    if (!fs.existsSync(safeSource)) {
      return res.status(400).json({ error: 'Valid existing sourcePath is required' });
    }

    const paths = getSystemPaths();
    ensureNileshFolders();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = projectName || path.basename(sourcePath);
    const backupDir = path.join(paths.subFolders.backups, `${name}_${timestamp}`);

    fs.mkdirSync(backupDir, { recursive: true });

    // Copy files recursively (excluding node_modules & .git)
    const files = collectDirectoryFiles(safeSource);
    for (const f of files) {
      const dest = path.join(backupDir, f.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, f.content);
    }

    try {
      db.prepare(`
        INSERT INTO file_operations (id, type, name, target_path, file_count, size_bytes, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'bak-' + Date.now().toString(36),
        'backup',
        name,
        backupDir,
        files.length,
        0,
        'verified',
        Date.now()
      );
    } catch {}

    res.json({
      success: true,
      backupPath: backupDir,
      filesCopied: files.length,
      timestamp,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/file-manager/history — Recent file operations ───────────────────

router.get('/file-manager/history', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM file_operations
      ORDER BY created_at DESC
      LIMIT 50
    `).all();

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
