const express = require('express');
const router = express.Router();
const fileManager = require('../services/fileManagerService');
const path = require('path');

// Get system default paths
router.get('/paths', async (req, res) => {
  try {
    const paths = fileManager.getPaths();
    res.json({ success: true, paths });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new folder/project
router.post('/create-directory', async (req, res) => {
  try {
    const { targetPath } = req.body;
    const result = await fileManager.createDirectory(targetPath);
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Scan existing project path
router.post('/scan', async (req, res) => {
  try {
    const { projectPath } = req.body;
    const tree = await fileManager.scanProject(projectPath || fileManager.getPaths().downloads);
    res.json({ success: true, tree });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Read file content
router.post('/read-file', async (req, res) => {
  try {
    const { filePath } = req.body;
    const data = await fileManager.readFile(filePath);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Save single file directly
router.post('/save-file', async (req, res) => {
  try {
    const { filePath, content, backup = false } = req.body;

    if (backup) {
      await fileManager.createBackup(filePath);
    }

    const verification = await fileManager.writeFile(filePath, content);
    res.json({ success: true, verification });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Zip project directory
router.post('/zip-project', async (req, res) => {
  try {
    const { sourceDir, zipName } = req.body;
    const targetZipPath = path.join(
      fileManager.getPaths().downloads,
      zipName || `${path.basename(sourceDir)}.zip`
    );

    const result = await fileManager.createZipArchive(sourceDir, targetZipPath);
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
