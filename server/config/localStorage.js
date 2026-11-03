const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');

// Storage configuration
const uploadsDir = path.resolve(__dirname, '..', process.env.UPLOAD_PATH || 'uploads');
const reportsDir = path.join(__dirname, '../reports');
const tempDir = path.join(__dirname, '../temp');

// Ensure directories exist
const initializeStorage = async () => {
  try {
    const dirs = [uploadsDir, reportsDir, tempDir];
    
    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch (error) {
        await fs.mkdir(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    }
    
    logger.info('Storage directories initialized');
  } catch (error) {
    logger.error('Failed to initialize storage:', error);
    throw error;
  }
};

// File upload handler
const handleFileUpload = async (file, destination = 'uploads') => {
  try {
    const uploadDir = destination === 'reports' ? reportsDir : uploadsDir;
    
    // Generate unique filename. The name the client sent is never used as part of a path.
    const filename = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;

    const filePath = path.join(uploadDir, filename);
    
    // Write file
    await fs.writeFile(filePath, file.buffer);
    
    logger.info('File uploaded to local storage:', {
      filename,
      originalName: file.originalname,
      size: file.size
    });
    
    return {
      filename,
      originalName: file.originalname,
      size: file.size,
      path: filePath
    };
  } catch (error) {
    logger.error('File upload failed:', error);
    throw error;
  }
};

// File serving
const serveFile = async (filename, directory = 'uploads') => {
  try {
    const baseDir = directory === 'reports' ? reportsDir : uploadsDir;
    const filePath = path.join(baseDir, filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error('File not found');
    }
    
    return filePath;
  } catch (error) {
    logger.error('File serving failed:', error);
    throw error;
  }
};

// File deletion
const deleteFile = async (filename, directory = 'uploads') => {
  try {
    const baseDir = directory === 'reports' ? reportsDir : uploadsDir;
    const filePath = path.join(baseDir, filename);
    
    await fs.unlink(filePath);
    logger.info('File deleted:', { filename });
    
    return true;
  } catch (error) {
    logger.error('File deletion failed:', error);
    throw error;
  }
};

// Get file info
const getFileInfo = async (filename, directory = 'uploads') => {
  try {
    const baseDir = directory === 'reports' ? reportsDir : uploadsDir;
    const filePath = path.join(baseDir, filename);
    
    const stats = await fs.stat(filePath);
    
    return {
      filename,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      path: filePath
    };
  } catch (error) {
    logger.error('Get file info failed:', error);
    throw error;
  }
};

module.exports = {
  uploadsDir,
  reportsDir,
  tempDir,
  initializeStorage,
  handleFileUpload,
  serveFile,
  deleteFile,
  getFileInfo
}; 