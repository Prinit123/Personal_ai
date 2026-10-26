const express = require('express');
const router = express.Router();
const fileManager = require('../services/fileManagerService');
const path = require('path');

/**
 * Parses markdown AI responses containing code blocks formatted as:
 * 