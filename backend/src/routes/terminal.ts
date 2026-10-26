import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_BASE = path.resolve(__dirname, '../../../projects');

// Maximum time (ms) a spawned command may run before being killed
const COMMAND_TIMEOUT_MS = 60_000;

// ─── Path Containment Check ───────────────────────────────────────────────────

/**
 * Resolves `projectId` to a directory that MUST reside inside PROJECTS_BASE.
 * Returns the resolved path, or null if the id is invalid / traverses outside.
 */
function resolveProjectDir(projectId: string): string | null {
  // Reject ids that contain path separators or ..
  if (/[/\\]|\.\./.test(projectId)) return null;

  const resolved = path.resolve(PROJECTS_BASE, projectId);

  // Must start with PROJECTS_BASE + separator
  if (!resolved.startsWith(PROJECTS_BASE + path.sep) && resolved !== PROJECTS_BASE) {
    return null;
  }

  return resolved;
}

// ─── Command Safety Classification ───────────────────────────────────────────

/**
 * Returns:
 *  'BLOCK' – never execute, even with approval
 *  'C'     – requires explicit user approval (destructive)
 *  'B'     – requires approval (modifying / network)
 *  'A'     – safe read-only inspection
 */
function categorizeCommand(cmd: string): 'BLOCK' | 'A' | 'B' | 'C' {
  const lower = cmd.toLowerCase().trim();

  // ── Absolute blocks ───────────────────────────────────────────────────────
  const blockPatterns = [
    // Shell-injection pivots
    /curl\s.*\|.*sh/,           // curl | sh
    /wget\s.*\|.*sh/,           // wget | sh
    /powershell.*invoke-expression/i,
    /powershell.*iex\s/i,
    /powershell.*downloadstring/i,
    /powershell.*webclient/i,
    /powershell.*invoke-webrequest.*exec/i,
    // Registry / system damage
    /reg\s+(delete|add)\s/i,
    /wmic\s.*delete/i,
    /bcdedit/i,
    /cipher\s.*\/w/i,
    // Ransom-style wipes
    /format\s+[a-z]:/i,
    /diskpart/i,
    // Lateral movement / exfil
    /net\s+user\s+.*\/add/i,
    /schtasks\s.*\/create/i,
    // OS service manipulation
    /sc\s+(create|delete|stop|start)\s/i,
    /shutdown\s/i,
    /taskkill\s.*\/f\s+.*\/im/i,
  ];

  for (const pattern of blockPatterns) {
    if (pattern.test(lower)) return 'BLOCK';
  }

  // ── Category C – destructive but controllable ─────────────────────────────
  if (
    lower.includes('rmdir /s') ||
    lower.includes('rm -rf') ||
    lower.includes('del /f') ||
    lower.includes('drop database') ||
    lower.includes('drop table')
  ) {
    return 'C';
  }

  // ── Category B – modifying / dependency / network ─────────────────────────
  if (
    lower.startsWith('npm install') ||
    lower.startsWith('npm i ') ||
    lower.startsWith('npm run build') ||
    lower.startsWith('npm run dev') ||
    lower.startsWith('npm start') ||
    lower.startsWith('pip install') ||
    lower.startsWith('git push') ||
    lower.startsWith('git clone') ||
    lower.startsWith('curl ') ||
    lower.startsWith('wget ')
  ) {
    return 'B';
  }

  // ── Category A – safe read ────────────────────────────────────────────────
  return 'A';
}

// ─── POST /api/projects/:id/command — Run command inside project workspace ────

router.post('/projects/:id/command', (req, res) => {
  const { command, approved } = req.body;

  if (!command || typeof command !== 'string' || command.trim().length === 0) {
    return res.status(400).json({ error: 'command is required' });
  }

  // ── Resolve + contain project directory ──────────────────────────────────
  const projDir = resolveProjectDir(req.params.id);
  if (!projDir) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  if (!fs.existsSync(projDir)) {
    return res.status(404).json({ error: 'Project workspace does not exist' });
  }

  // ── Classify command ─────────────────────────────────────────────────────
  const category = categorizeCommand(command);

  if (category === 'BLOCK') {
    return res.status(403).json({
      error: 'This command is not permitted for security reasons.',
      category: 'BLOCK',
    });
  }

  if ((category === 'B' || category === 'C') && !approved) {
    return res.status(403).json({
      requireApproval: true,
      category,
      message: `Action requires Category ${category} approval: "${command}"`,
    });
  }

  // ── Stream response ──────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (line: string) =>
    res.write(`data: ${JSON.stringify({ line })}\n\n`);

  send(`$ ${command}`);

  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'powershell.exe' : 'bash';
  const shellArgs = isWindows
    ? ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-Command', command]
    : ['-c', command];

  const proc = spawn(shell, shellArgs, {
    cwd: projDir,
    env: { ...process.env, CI: 'true' },
  });

  // ── Timeout: kill after COMMAND_TIMEOUT_MS ───────────────────────────────
  const timeout = setTimeout(() => {
    proc.kill('SIGTERM');
    send(`[TIMEOUT] Command exceeded ${COMMAND_TIMEOUT_MS / 1000}s limit and was killed.`);
  }, COMMAND_TIMEOUT_MS);

  proc.stdout.on('data', (data) => {
    for (const line of data.toString().split('\n')) {
      if (line.trim()) send(line.trim());
    }
  });

  proc.stderr.on('data', (data) => {
    for (const line of data.toString().split('\n')) {
      if (line.trim()) send(`[ERROR] ${line.trim()}`);
    }
  });

  proc.on('close', (code) => {
    clearTimeout(timeout);
    send(`[PROCESS FINISHED with code ${code}]`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  proc.on('error', (err) => {
    clearTimeout(timeout);
    send(`[SPAWN ERROR] ${err.message}`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  // Kill process if client disconnects mid-stream
  req.on('close', () => {
    clearTimeout(timeout);
    proc.kill('SIGTERM');
  });
});

export default router;
