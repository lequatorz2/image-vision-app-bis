const express = require('express');
const router = express.Router();
const dbManager = require('../db-manager');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream');
const streamPipeline = promisify(pipeline);
const archiver = require('archiver');

// Get detailed storage statistics
router.get('/stats', async (req, res) => {
  try {
    // Get database statistics
    const dbStats = await dbManager.getDatabaseStats();
    
    // Get storage usage
    const storageStats = await dbManager.getStorageUsage();
    
    // Get storage limit
    const storageLimit = await dbManager.getStorageLimit();
    
    // Get file type breakdown
    const fileTypes = dbStats.mimeTypes || [];
    
    // Generate category breakdown for visualization
    const categories = [
      {
        name: 'Image Files',
        size: storageStats.totalStorage,
        color: '#8884d8'
      },
      {
        name: 'Database',
        size: storageStats.databaseSize,
        color: '#82ca9d'
      }
    ];
    
    // Add breakdown by file type
    if (fileTypes.length > 0) {
      fileTypes.forEach((type, index) => {
        const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
        categories.push({
          name: `${type.mimeType.split('/')[1].toUpperCase()} Files`,
          size: type.totalSize,
          color: colors[index % colors.length]
        });
      });
    }
    
    // Response object
    const response = {
      total: storageLimit,
      used: storageStats.totalSize,
      categories
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching storage statistics:', error);
    res.status(500).json({ error: 'Failed to fetch storage statistics' });
  }
});

// Optimize storage
router.post('/optimize', async (req, res) => {
  try {
    const { options } = req.body;
    
    if (!options || !Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'No optimization options provided' });
    }
    
    const results = {
      optimizations: [],
      freedSpace: 0
    };
    
    // Process each optimization option
    for (const option of options) {
      switch (option) {
        case 'duplicates':
          // Find and remove duplicate images
          const duplicatesResult = await removeDuplicateImages();
          results.optimizations.push({
            type: 'duplicates',
            removed: duplicatesResult.removed,
            freedSpace: duplicatesResult.freedSpace
          });
          results.freedSpace += duplicatesResult.freedSpace;
          break;
          
        case 'compress':
          // Compress high-resolution images
          const compressResult = await compressHighResImages();
          results.optimizations.push({
            type: 'compress',
            compressed: compressResult.compressed,
            freedSpace: compressResult.freedSpace
          });
          results.freedSpace += compressResult.freedSpace;
          break;
          
        case 'unused':
          // Remove unused metadata
          const unusedResult = await cleanupUnusedMetadata();
          results.optimizations.push({
            type: 'unused',
            cleaned: unusedResult.cleaned,
            freedSpace: unusedResult.freedSpace
          });
          results.freedSpace += unusedResult.freedSpace;
          break;
          
        case 'thumbnails':
          // Rebuild thumbnails
          const thumbnailsResult = await rebuildThumbnails();
          results.optimizations.push({
            type: 'thumbnails',
            rebuilt: thumbnailsResult.rebuilt,
            freedSpace: thumbnailsResult.freedSpace
          });
          results.freedSpace += thumbnailsResult.freedSpace;
          break;
          
        case 'temp':
          // Clear temporary files
          const tempResult = await clearTempFiles();
          results.optimizations.push({
            type: 'temp',
            removed: tempResult.removed,
            freedSpace: tempResult.freedSpace
          });
          results.freedSpace += tempResult.freedSpace;
          break;
          
        default:
          results.optimizations.push({
            type: option,
            error: 'Unknown optimization option'
          });
      }
    }
    
    // Optimize database as a final step
    const dbOptimizeResult = await dbManager.optimizeDatabase();
    results.optimizations.push({
      type: 'database',
      success: dbOptimizeResult.success,
      message: dbOptimizeResult.message
    });
    
    // Format the total freed space
    results.formattedFreedSpace = formatSize(results.freedSpace);
    
    res.json(results);
  } catch (error) {
    console.error('Error optimizing storage:', error);
    res.status(500).json({ error: 'Failed to optimize storage' });
  }
});

// Export database
router.post('/export', async (req, res) => {
  try {
    const { includeImages = true } = req.body;
    
    // Create backup
    const backup = await dbManager.createBackup(includeImages);
    
    res.json({
      success: true,
      exportPath: `/backups/${backup.fileName}`,
      size: backup.size,
      timestamp: backup.timestamp
    });
  } catch (error) {
    console.error('Error exporting database:', error);
    res.status(500).json({ error: 'Failed to export database' });
  }
});

// Import database
router.post('/import', async (req, res) => {
  try {
    const { filePath, overwrite = false } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'No file path provided' });
    }
    
    // Construct the full path
    const fullPath = path.isAbsolute(filePath) ? 
      filePath : 
      path.join(__dirname, '..', filePath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Import file not found' });
    }
    
    // Restore from backup
    const result = await dbManager.restoreFromBackup(fullPath, { overwrite });
    
    res.json({
      success: true,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Error importing database:', error);
    res.status(500).json({ error: 'Failed to import database' });
  }
});

// Helper function to format file sizes
function formatSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to find and remove duplicate images
async function removeDuplicateImages() {
  const db = await dbManager.getConnection();
  
  try {
    // Find images with identical size and identical metadata attributes (potential duplicates)
    const duplicates = await new Promise((resolve, reject) => {
      db.all(`
        SELECT i1.id as id1, i2.id as id2, i1.fileSize, i1.filePath
        FROM images i1
        JOIN images i2 ON i1.fileSize = i2.fileSize
        WHERE i1.id < i2.id
        AND i1.mimeType = i2.mimeType
        AND i1.metadata = i2.metadata
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Calculate freed space and remove duplicates
    let freedSpace = 0;
    const removedIds = [];
    
    for (const dup of duplicates) {
      // Keep the older image (i1) and delete the newer one (i2)
      try {
        const fileSize = dup.fileSize;
        await dbManager.deleteImage(dup.id2);
        freedSpace += fileSize;
        removedIds.push(dup.id2);
      } catch (error) {
        console.error(`Error removing duplicate ${dup.id2}:`, error);
      }
    }
    
    return {
      removed: removedIds.length,
      freedSpace,
      removedIds
    };
  } finally {
    db.close();
  }
}

// Helper function to compress high-resolution images
async function compressHighResImages() {
  const db = await dbManager.getConnection();
  
  try {
    // Find large images (over 1MB)
    const largeImages = await new Promise((resolve, reject) => {
      db.all(`
        SELECT id, fileName, fileSize, mimeType, filePath
        FROM images
        WHERE fileSize > 1048576  -- 1MB
        AND (mimeType LIKE 'image/jpeg' OR mimeType LIKE 'image/png')
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const sharp = require('sharp');
    let freedSpace = 0;
    const compressedImages = [];
    
    for (const img of largeImages) {
      try {
        const originalSize = img.fileSize;
        const tempPath = img.filePath + '.compressed';
        
        // Compress the image with sharp
        await sharp(img.filePath)
          .jpeg({ quality: 80, mozjpeg: true })
          .toFile(tempPath);
        
        // Get new file size
        const stats = fs.statSync(tempPath);
        const newSize = stats.size;
        
        // Only keep if we actually save space
        if (newSize < originalSize) {
          // Replace the original file
          fs.unlinkSync(img.filePath);
          fs.renameSync(tempPath, img.filePath);
          
          // Update the database
          await new Promise((resolve, reject) => {
            db.run(
              'UPDATE images SET fileSize = ? WHERE id = ?',
              [newSize, img.id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          
          freedSpace += (originalSize - newSize);
          compressedImages.push({
            id: img.id,
            originalSize,
            newSize,
            saved: originalSize - newSize
          });
        } else {
          // Delete the temp file if compression didn't help
          fs.unlinkSync(tempPath);
        }
      } catch (error) {
        console.error(`Error compressing image ${img.id}:`, error);
      }
    }
    
    return {
      compressed: compressedImages.length,
      freedSpace,
      compressedImages
    };
  } finally {
    db.close();
  }
}

// Helper function to clean up unused metadata
async function cleanupUnusedMetadata() {
  const db = await dbManager.getConnection();
  
  try {
    // Find orphaned search index entries
    const orphanedEntries = await new Promise((resolve, reject) => {
      db.all(`
        SELECT si.id, si.imageId
        FROM search_index si
        LEFT JOIN images i ON si.imageId = i.id
        WHERE i.id IS NULL
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Calculate average bytes per entry for estimation
    const dbStats = await dbManager.getDatabaseStats();
    const avgEntrySize = dbStats.search_index && dbStats.search_index.count > 0 ?
      Math.ceil(dbStats.databaseFiles.total / dbStats.search_index.count) : 100;
    
    // Remove orphaned entries
    const deletedIds = [];
    
    if (orphanedEntries.length > 0) {
      const placeholders = orphanedEntries.map(() => '?').join(',');
      const entryIds = orphanedEntries.map(e => e.id);
      
      await new Promise((resolve, reject) => {
        db.run(
          `DELETE FROM search_index WHERE id IN (${placeholders})`,
          entryIds,
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      deletedIds.push(...entryIds);
    }
    
    const freedSpace = orphanedEntries.length * avgEntrySize;
    
    return {
      cleaned: orphanedEntries.length,
      freedSpace,
      deletedIds
    };
  } finally {
    db.close();
  }
}

// Helper function to rebuild thumbnails
async function rebuildThumbnails() {
  const db = await dbManager.getConnection();
  
  try {
    // Get thumbnail quality setting
    const thumbnailQuality = parseInt(await dbManager.getSetting('thumbnail_quality') || '80', 10);
    
    // Get all images
    const images = await new Promise((resolve, reject) => {
      db.all(`
        SELECT id, fileName, filePath, thumbnailUrl
        FROM images
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const sharp = require('sharp');
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    let freedSpace = 0;
    const rebuiltThumbnails = [];
    
    for (const img of images) {
      try {
        // Extract thumbnail filename from the URL
        const thumbnailUrl = img.thumbnailUrl;
        const thumbnailFileName = thumbnailUrl.substring(thumbnailUrl.lastIndexOf('/') + 1);
        const thumbnailPath = path.join(__dirname, '..', 'uploads', thumbnailFileName);
        
        // Get original thumbnail size if it exists
        let originalSize = 0;
        if (fs.existsSync(thumbnailPath)) {
          originalSize = fs.statSync(thumbnailPath).size;
        }
        
        // Rebuild the thumbnail
        await sharp(img.filePath)
          .resize(300, 300, { fit: 'inside' })
          .jpeg({ quality: thumbnailQuality })
          .toFile(thumbnailPath);
        
        // Get new thumbnail size
        const newSize = fs.statSync(thumbnailPath).size;
        
        if (originalSize > 0) {
          const saved = originalSize - newSize;
          freedSpace += Math.max(0, saved);
          
          if (saved > 0) {
            rebuiltThumbnails.push({
              id: img.id,
              saved
            });
          }
        }
      } catch (error) {
        console.error(`Error rebuilding thumbnail for image ${img.id}:`, error);
      }
    }
    
    return {
      rebuilt: rebuiltThumbnails.length,
      freedSpace,
      rebuiltThumbnails
    };
  } finally {
    db.close();
  }
}

// Helper function to clear temporary files
async function clearTempFiles() {
  try {
    // Identify temporary directories
    const tempDirs = [
      path.join(__dirname, '..', 'temp'),
      path.join(__dirname, '..', 'logs'),
      path.join(require('os').tmpdir(), 'image-vision-app')
    ];
    
    let freedSpace = 0;
    const removedFiles = [];
    
    // Process each temp directory
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          try {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            
            // Skip directories
            if (stats.isDirectory()) continue;
            
            // Delete the file
            fs.unlinkSync(filePath);
            freedSpace += stats.size;
            removedFiles.push(filePath);
          } catch (error) {
            console.error(`Error removing temp file:`, error);
          }
        }
      }
    }
    
    // Clean WAL files if present
    const dbPath = path.join(__dirname, '..', 'data', 'images.db');
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    
    // Check file sizes
    let walSize = 0, shmSize = 0;
    
    if (fs.existsSync(walPath)) {
      walSize = fs.statSync(walPath).size;
    }
    
    if (fs.existsSync(shmPath)) {
      shmSize = fs.statSync(shmPath).size;
    }
    
    // Run checkpoint to reduce WAL file size
    const db = await dbManager.getConnection();
    await new Promise((resolve, reject) => {
      db.run('PRAGMA wal_checkpoint(TRUNCATE)', err => {
        db.close();
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Calculate freed space
    if (fs.existsSync(walPath)) {
      const newWalSize = fs.statSync(walPath).size;
      freedSpace += Math.max(0, walSize - newWalSize);
    }
    
    if (fs.existsSync(shmPath)) {
      const newShmSize = fs.statSync(shmPath).size;
      freedSpace += Math.max(0, shmSize - newShmSize);
    }
    
    return {
      removed: removedFiles.length,
      freedSpace,
      removedFiles
    };
  } catch (error) {
    console.error('Error clearing temporary files:', error);
    return {
      removed: 0,
      freedSpace: 0,
      error: error.message
    };
  }
}

module.exports = router;