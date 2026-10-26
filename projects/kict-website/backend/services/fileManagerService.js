const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const archiver = require('archiver');

class FileManagerService {
  constructor() {
    // Dynamically detect user's Downloads directory
    this.userHome = os.homedir();
    this.defaultDownloadsDir = path.join(this.userHome, 'Downloads');
    this.nileshBaseDir = path.join(this.defaultDownloadsDir, 'NileshAI');

    // Preset Subfolders
    this.subFolders = {
      projects: path.join(this.nileshBaseDir, 'Projects'),
      mlProjects: path.join(this.nileshBaseDir, 'MLProjects'),
      codeExamples: path.join(this.nileshBaseDir, 'CodeExamples'),
      documents: path.join(this.nileshBaseDir, 'Documents'),
      backups: path.join(this.nileshBaseDir, 'Backups'),
    };

    this.initDirectories();
  }

  /**
   * Ensure default workspace folders exist
   */
  async initDirectories() {
    try {
      await fs.ensureDir(this.defaultDownloadsDir);
      await fs.ensureDir(this.nileshBaseDir);
      for (const folderPath of Object.values(this.subFolders)) {
        await fs.ensureDir(folderPath);
      }
    } catch (error) {
      console.error('[FileManager] Initialization Error:', error.message);
    }
  }

  /**
   * Security Path Validator - Prevents Path Traversal Attacks
   */
  sanitizePath(targetPath) {
    const resolvedPath = path.resolve(targetPath);
    // Ensure path is inside user profile directory for safety
    if (!resolvedPath.startsWith(this.userHome)) {
      throw new Error(`Access Denied: Path outside safe zone (${this.userHome})`);
    }
    return resolvedPath;
  }

  /**
   * Get default paths for UI
   */
  getPaths() {
    return {
      home: this.userHome,
      downloads: this.defaultDownloadsDir,
      nileshRoot: this.nileshBaseDir,
      structure: this.subFolders,
    };
  }

  /**
   * Create directory safely
   */
  async createDirectory(dirPath) {
    const safePath = this.sanitizePath(dirPath);
    if (await fs.pathExists(safePath)) {
      return { status: 'exists', path: safePath };
    }
    await fs.mkdirp(safePath);
    return { status: 'created', path: safePath };
  }

  /**
   * Write file to disk and verify existence & size
   */
  async writeFile(filePath, content) {
    const safePath = this.sanitizePath(filePath);
    const parentDir = path.dirname(safePath);

    await fs.ensureDir(parentDir);
    await fs.writeFile(safePath, content, 'utf8');

    // Verification step
    const stats = await fs.stat(safePath);
    if (!stats.isFile() || stats.size === 0 && content.length > 0) {
      throw new Error(`File verification failed for: ${safePath}`);
    }

    return {
      success: true,
      path: safePath,
      size: stats.size,
      updatedAt: stats.mtime,
    };
  }

  /**
   * Safe Backup before file modification
   */
  async createBackup(filePath) {
    const safePath = this.sanitizePath(filePath);
    if (await fs.pathExists(safePath)) {
      const fileName = path.basename(safePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.subFolders.backups, `${fileName}_${timestamp}.bak`);
      await fs.copy(safePath, backupPath);
      return backupPath;
    }
    return null;
  }

  /**
   * Scan project directory, filtering sensitive & heavy folders
   */
  async scanProject(projectPath, maxDepth = 4, currentDepth = 0) {
    const safePath = this.sanitizePath(projectPath);

    if (!(await fs.pathExists(safePath))) {
      throw new Error(`Path does not exist: ${safePath}`);
    }

    const ignoredNames = [
      'node_modules',
      '.git',
      '.venv',
      'venv',
      '__pycache__',
      'dist',
      'build',
      '.env',
      '.DS_Store',
    ];

    const stats = await fs.stat(safePath);
    if (!stats.isDirectory()) {
      return { name: path.basename(safePath), type: 'file', size: stats.size };
    }

    if (currentDepth >= maxDepth) {
      return { name: path.basename(safePath), type: 'directory', skipped: true };
    }

    const items = await fs.readdir(safePath);
    const children = [];

    for (const item of items) {
      if (ignoredNames.includes(item)) continue;

      const itemPath = path.join(safePath, item);
      try {
        const itemStats = await fs.stat(itemPath);
        if (itemStats.isDirectory()) {
          const subTree = await this.scanProject(itemPath, maxDepth, currentDepth + 1);
          children.push(subTree);
        } else {
          children.push({
            name: item,
            type: 'file',
            size: itemStats.size,
            extension: path.extname(item),
          });
        }
      } catch (err) {
        // Skip restricted/unreadable files
        continue;
      }
    }

    return {
      name: path.basename(safePath),
      path: safePath,
      type: 'directory',
      children,
    };
  }

  /**
   * Read file safely
   */
  async readFile(filePath) {
    const safePath = this.sanitizePath(filePath);
    const content = await fs.readFile(safePath, 'utf8');
    return { path: safePath, content };
  }

  /**
   * Create ZIP Archive of a project folder
   */
  async createZipArchive(sourceDir, outputZipPath) {
    const safeSource = this.sanitizePath(sourceDir);
    const safeOutput = this.sanitizePath(outputZipPath);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(safeOutput);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve({ path: safeOutput, bytes: archive.pointer() }));
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.glob('**/*', {
        cwd: safeSource,
        ignore: ['node_modules/**', '.git/**', '.venv/**', 'dist/**', 'build/**'],
      });
      archive.finalize();
    });
  }
}

module.exports = new FileManagerService();
