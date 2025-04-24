const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const extract = require('extract-zip');
const { v4: uuidv4 } = require('uuid');

// Database paths and directories
const DB_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const BACKUP_DIR = path.join(__dirname, 'backups');
const DB_PATH = path.join(DB_DIR, 'images.db');

// Create necessary directories
function ensureDirectoriesExist() {
  [DB_DIR, UPLOADS_DIR, BACKUP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Initialize database with optimized configuration
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    ensureDirectoriesExist();
    
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) return reject(err);
      
      // Enable WAL mode for better performance and concurrency
      db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = 1000;
        PRAGMA temp_store = MEMORY;
      `, (pragmaErr) => {
        if (pragmaErr) {
          console.warn('Warning: Failed to set optimal database settings:', pragmaErr);
        }
        
        // Create all necessary tables with proper indexes
        db.serialize(() => {
          // Settings table for application configuration
          db.run(`
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT,
              updated_at TEXT
            )
          `);
          
          // Images table for metadata and paths
          db.run(`
            CREATE TABLE IF NOT EXISTS images (
              id TEXT PRIMARY KEY,
              fileName TEXT,
              fileSize INTEGER,
              mimeType TEXT,
              url TEXT,
              filePath TEXT,
              thumbnailUrl TEXT,
              uploadDate TEXT,
              metadata TEXT,
              private INTEGER DEFAULT 0
            )
          `);
          
          // Search index table for efficient querying
          db.run(`
            CREATE TABLE IF NOT EXISTS search_index (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              imageId TEXT,
              field TEXT,
              value TEXT,
              FOREIGN KEY (imageId) REFERENCES images(id) ON DELETE CASCADE
            )
          `);
          
          // Album organization
          db.run(`
            CREATE TABLE IF NOT EXISTS albums (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              created_at TEXT,
              updated_at TEXT
            )
          `);
          
          // Join table for albums and images
          db.run(`
            CREATE TABLE IF NOT EXISTS album_images (
              album_id TEXT,
              image_id TEXT,
              added_at TEXT,
              PRIMARY KEY (album_id, image_id),
              FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
              FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
            )
          `);
          
          // Create indexes for faster searches
          db.run(`CREATE INDEX IF NOT EXISTS idx_images_upload_date ON images(uploadDate)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_images_file_size ON images(fileSize)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_images_private ON images(private)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_search_field ON search_index(field)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_search_value ON search_index(value)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_search_image_id ON search_index(imageId)`);
          
          // Store initial settings
          const initialSettings = [
            { key: 'storage_limit', value: '1073741824', updated_at: new Date().toISOString() }, // 1 GB default limit
            { key: 'thumbnail_quality', value: '80', updated_at: new Date().toISOString() },
            { key: 'auto_backup', value: 'false', updated_at: new Date().toISOString() },
            { key: 'backup_frequency', value: '7', updated_at: new Date().toISOString() }, // 7 days
            { key: 'app_version', value: '1.0.0', updated_at: new Date().toISOString() }
          ];
          
          const settingsStmt = db.prepare(`
            INSERT OR IGNORE INTO settings (key, value, updated_at)
            VALUES (?, ?, ?)
          `);
          
          initialSettings.forEach(setting => {
            settingsStmt.run(setting.key, setting.value, setting.updated_at);
          });
          
          settingsStmt.finalize();
          
          console.log('Database initialized successfully');
          resolve(db);
        });
      });
    });
  });
}

// Get database connection
function getConnection() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

// Get a setting value
async function getSetting(key) {
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      db.close();
      
      if (err) return reject(err);
      if (!row) return resolve(null);
      
      resolve(row.value);
    });
  });
}

// Update a setting value
async function updateSetting(key, value) {
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    db.run(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
      [key, value, now],
      function(err) {
        db.close();
        
        if (err) return reject(err);
        resolve({ key, value, updated_at: now });
      }
    );
  });
}

// Get all settings
async function getAllSettings() {
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    db.all('SELECT key, value, updated_at FROM settings', (err, rows) => {
      db.close();
      
      if (err) return reject(err);
      
      // Convert to object format
      const settings = {};
      rows.forEach(row => {
        settings[row.key] = {
          value: row.value,
          updated_at: row.updated_at
        };
      });
      
      resolve(settings);
    });
  });
}

// Calculate storage usage
async function getStorageUsage() {
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    db.get('SELECT SUM(fileSize) as total FROM images', (err, row) => {
      if (err) {
        db.close();
        return reject(err);
      }
      
      const totalStorage = row.total || 0;
      
      // Get database file size
      db.close(() => {
        try {
          const dbFileSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
          const dbWalSize = fs.existsSync(`${DB_PATH}-wal`) ? fs.statSync(`${DB_PATH}-wal`).size : 0;
          const dbShmSize = fs.existsSync(`${DB_PATH}-shm`) ? fs.statSync(`${DB_PATH}-shm`).size : 0;
          
          // Total DB size
          const databaseSize = dbFileSize + dbWalSize + dbShmSize;
          
          resolve({
            totalStorage, // Image files storage
            databaseSize, // Database storage
            totalSize: totalStorage + databaseSize // Combined total
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

// Get storage limit
async function getStorageLimit() {
  const limit = await getSetting('storage_limit');
  return parseInt(limit || '1073741824', 10); // Default to 1GB if not set
}

// Check if storage limit is reached
async function isStorageLimitReached() {
  const { totalSize } = await getStorageUsage();
  const limit = await getStorageLimit();
  
  return totalSize >= limit;
}

// Update storage limit
async function updateStorageLimit(newLimit) {
  // Validate input
  const limitNumber = parseInt(newLimit, 10);
  if (isNaN(limitNumber) || limitNumber <= 0) {
    throw new Error('Invalid storage limit value');
  }
  
  return updateSetting('storage_limit', limitNumber.toString());
}

// Create a backup of the database and uploaded files
async function createBackup(includeImages = true) {
  ensureDirectoriesExist();
  
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
    const backupFileName = `backup-${timestamp}.zip`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    
    // Create a write stream for the backup file
    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    output.on('close', () => {
      resolve({
        backupPath,
        fileName: backupFileName,
        size: archive.pointer(),
        timestamp
      });
    });
    
    archive.on('error', (err) => {
      reject(err);
    });
    
    archive.pipe(output);
    
    // Add database files to the backup
    ['images.db', 'images.db-shm', 'images.db-wal'].forEach(file => {
      const filePath = path.join(DB_DIR, file);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: `db/${file}` });
      }
    });
    
    // Include uploaded images if requested
    if (includeImages) {
      archive.directory(UPLOADS_DIR, 'uploads');
    } else {
      // Create an empty uploads directory in the backup
      archive.append(null, { name: 'uploads/' });
    }
    
    // Include a backup metadata file
    const metadata = {
      createdAt: new Date().toISOString(),
      includesImages: includeImages,
      appVersion: '1.0.0'
    };
    
    archive.append(JSON.stringify(metadata, null, 2), { name: 'backup-info.json' });
    
    archive.finalize();
  });
}

// Restore from a backup
async function restoreFromBackup(backupPath, options = { overwrite: false }) {
  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup file does not exist');
  }
  
  // Temporarily close the database
  const db = await getConnection();
  await new Promise(resolve => db.close(resolve));
  
  // Extract backup to a temporary directory
  const tempDir = path.join(__dirname, 'temp_restore_' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    // Extract the backup
    await extract(backupPath, { dir: tempDir });
    
    // Check backup metadata
    const metadataPath = path.join(tempDir, 'backup-info.json');
    if (!fs.existsSync(metadataPath)) {
      throw new Error('Invalid backup: missing metadata');
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    // Restore database files
    const dbBackupDir = path.join(tempDir, 'db');
    if (fs.existsSync(dbBackupDir)) {
      // Make sure database directory exists
      ensureDirectoriesExist();
      
      // Copy database files
      ['images.db', 'images.db-shm', 'images.db-wal'].forEach(file => {
        const backupDbPath = path.join(dbBackupDir, file);
        const targetDbPath = path.join(DB_DIR, file);
        
        if (fs.existsSync(backupDbPath)) {
          if (options.overwrite || !fs.existsSync(targetDbPath)) {
            fs.copyFileSync(backupDbPath, targetDbPath);
          }
        }
      });
    } else {
      throw new Error('Invalid backup: missing database files');
    }
    
    // Restore uploaded images if they were included in the backup
    const uploadsBackupDir = path.join(tempDir, 'uploads');
    if (fs.existsSync(uploadsBackupDir) && metadata.includesImages) {
      // Make sure uploads directory exists
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      
      // Copy all files from the backup uploads directory
      const files = fs.readdirSync(uploadsBackupDir);
      for (const file of files) {
        const sourcePath = path.join(uploadsBackupDir, file);
        const targetPath = path.join(UPLOADS_DIR, file);
        
        // Skip directories
        if (fs.statSync(sourcePath).isDirectory()) continue;
        
        // Copy file if it doesn't exist or if overwrite is enabled
        if (options.overwrite || !fs.existsSync(targetPath)) {
          fs.copyFileSync(sourcePath, targetPath);
        }
      }
    }
    
    return {
      success: true,
      metadata
    };
  } catch (error) {
    throw error;
  } finally {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// List all available backups
function listBackups() {
  ensureDirectoriesExist();
  
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup-') && file.endsWith('.zip'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        
        return {
          fileName: file,
          path: filePath,
          size: stats.size,
          createdAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first
    
    return files;
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
}

// Delete a backup file
function deleteBackup(fileName) {
  const backupPath = path.join(BACKUP_DIR, fileName);
  
  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup file does not exist');
  }
  
  fs.unlinkSync(backupPath);
  
  return {
    success: true,
    message: `Backup ${fileName} deleted successfully`
  };
}

// Optimize database (vacuum and reindex)
async function optimizeDatabase() {
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    console.log('Starting database optimization...');
    
    // Begin with a checkpoint to ensure WAL content is moved to the main database file
    db.run('PRAGMA wal_checkpoint(FULL)', (checkpointErr) => {
      if (checkpointErr) {
        console.error('Error during checkpoint:', checkpointErr);
      }
      
      // Run VACUUM to rebuild the database, reclaiming free space
      db.run('VACUUM', (vacuumErr) => {
        if (vacuumErr) {
          db.close();
          return reject(vacuumErr);
        }
        
        // Analyze to update statistics for the query planner
        db.run('ANALYZE', (analyzeErr) => {
          if (analyzeErr) {
            console.error('Error during analyze:', analyzeErr);
          }
          
          // Reindex for optimal performance
          db.run('REINDEX', (reindexErr) => {
            db.close();
            
            if (reindexErr) {
              return reject(reindexErr);
            }
            
            resolve({
              success: true,
              message: 'Database optimized successfully'
            });
          });
        });
      });
    });
  });
}

// Delete unused files (orphaned files that are not referenced in the database)
async function cleanupUnusedFiles() {
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    // Get all file paths from the database
    db.all('SELECT filePath FROM images', (err, rows) => {
      if (err) {
        db.close();
        return reject(err);
      }
      
      const dbFilePaths = new Set(rows.map(row => row.filePath));
      const deletedFiles = [];
      
      // Check if uploads directory exists
      if (!fs.existsSync(UPLOADS_DIR)) {
        db.close();
        return resolve({ deletedFiles, totalReclaimed: 0 });
      }
      
      // Read all files in the uploads directory
      const files = fs.readdirSync(UPLOADS_DIR);
      let totalReclaimed = 0;
      
      // Check each file
      for (const file of files) {
        const filePath = path.join(UPLOADS_DIR, file);
        
        // Skip directories
        if (fs.statSync(filePath).isDirectory()) continue;
        
        // Check if the file is referenced in the database
        if (!dbFilePaths.has(filePath)) {
          try {
            // Get file size before deleting
            const fileSize = fs.statSync(filePath).size;
            
            // Delete the file
            fs.unlinkSync(filePath);
            
            // Add to deleted files list
            deletedFiles.push({
              path: filePath,
              size: fileSize
            });
            
            totalReclaimed += fileSize;
          } catch (error) {
            console.error(`Error deleting file ${filePath}:`, error);
          }
        }
      }
      
      db.close();
      
      resolve({
        deletedFiles,
        totalReclaimed
      });
    });
  });
}

// Get database statistics
async function getDatabaseStats() {
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const stats = {};
      
      // Get table row counts
      const tableQueries = [
        { name: 'images', query: 'SELECT COUNT(*) as count FROM images' },
        { name: 'search_index', query: 'SELECT COUNT(*) as count FROM search_index' },
        { name: 'albums', query: 'SELECT COUNT(*) as count FROM albums' },
        { name: 'album_images', query: 'SELECT COUNT(*) as count FROM album_images' }
      ];
      
      for (const { name, query } of tableQueries) {
        db.get(query, (err, row) => {
          if (err) {
            console.error(`Error getting row count for ${name}:`, err);
            stats[name] = { count: 0 };
          } else {
            stats[name] = { count: row.count };
          }
        });
      }
      
      // Get total file size and count by type
      db.get(`
        SELECT 
          COUNT(*) as totalImages, 
          SUM(fileSize) as totalSize,
          SUM(CASE WHEN private = 1 THEN 1 ELSE 0 END) as privateImages
        FROM images
      `, (err, row) => {
        if (err) {
          console.error('Error getting image stats:', err);
        } else {
          stats.imageStats = row;
        }
        
        // Get image formats
        db.all(`
          SELECT 
            mimeType, 
            COUNT(*) as count,
            SUM(fileSize) as totalSize
          FROM images 
          GROUP BY mimeType
        `, (err, rows) => {
          if (err) {
            console.error('Error getting mime type stats:', err);
          } else {
            stats.mimeTypes = rows;
          }
          
          // Get file size distribution
          const sizeRanges = [
            { min: 0, max: 100 * 1024 }, // 0-100 KB
            { min: 100 * 1024, max: 1024 * 1024 }, // 100 KB - 1 MB
            { min: 1024 * 1024, max: 5 * 1024 * 1024 }, // 1-5 MB
            { min: 5 * 1024 * 1024, max: Number.MAX_SAFE_INTEGER } // >5 MB
          ];
          
          const sizeQueries = sizeRanges.map((range, i) => {
            return new Promise((resolve, reject) => {
              db.get(`
                SELECT COUNT(*) as count
                FROM images
                WHERE fileSize >= ${range.min} AND fileSize < ${range.max}
              `, (err, row) => {
                if (err) reject(err);
                else resolve({ range: i, count: row.count });
              });
            });
          });
          
          Promise.all(sizeQueries)
            .then(results => {
              stats.sizeDistribution = results;
              
              // Get database file info
              const dbFileSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
              const dbWalSize = fs.existsSync(`${DB_PATH}-wal`) ? fs.statSync(`${DB_PATH}-wal`).size : 0;
              const dbShmSize = fs.existsSync(`${DB_PATH}-shm`) ? fs.statSync(`${DB_PATH}-shm`).size : 0;
              
              stats.databaseFiles = {
                main: { size: dbFileSize },
                wal: { size: dbWalSize },
                shm: { size: dbShmSize },
                total: dbFileSize + dbWalSize + dbShmSize
              };
              
              db.close();
              resolve(stats);
            })
            .catch(error => {
              db.close();
              reject(error);
            });
        });
      });
    });
  });
}

// Export a subset of images
async function exportImages(imageIds, outputPath) {
  // Validate input
  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    throw new Error('No image IDs provided for export');
  }
  
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    // Get image data for the specified IDs
    const placeholders = imageIds.map(() => '?').join(',');
    const query = `SELECT * FROM images WHERE id IN (${placeholders})`;
    
    db.all(query, imageIds, async (err, images) => {
      if (err) {
        db.close();
        return reject(err);
      }
      
      if (images.length === 0) {
        db.close();
        return reject(new Error('No images found with the provided IDs'));
      }
      
      try {
        // Create output directory if it doesn't exist
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Create a write stream for the export file
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {
          zlib: { level: 9 } // Maximum compression
        });
        
        output.on('close', () => {
          db.close();
          resolve({
            exportPath: outputPath,
            imageCount: images.length,
            size: archive.pointer()
          });
        });
        
        archive.on('error', (err) => {
          db.close();
          reject(err);
        });
        
        archive.pipe(output);
        
        // Add each image file to the archive
        for (const image of images) {
          const imagePath = image.filePath;
          
          if (fs.existsSync(imagePath)) {
            // Use the original filename from the database
            const filename = image.fileName;
            archive.file(imagePath, { name: `images/${filename}` });
            
            // Include metadata JSON for each image
            const metadata = {
              id: image.id,
              fileName: image.fileName,
              fileSize: image.fileSize,
              mimeType: image.mimeType,
              uploadDate: image.uploadDate,
              metadata: JSON.parse(image.metadata)
            };
            
            archive.append(JSON.stringify(metadata, null, 2), { name: `metadata/${image.id}.json` });
          }
        }
        
        // Add an export info file
        const exportInfo = {
          exportDate: new Date().toISOString(),
          imageCount: images.length,
          appVersion: '1.0.0'
        };
        
        archive.append(JSON.stringify(exportInfo, null, 2), { name: 'export-info.json' });
        
        archive.finalize();
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  });
}

// Import images from an export file
async function importImages(importPath) {
  if (!fs.existsSync(importPath)) {
    throw new Error('Import file does not exist');
  }
  
  // Extract import to a temporary directory
  const tempDir = path.join(__dirname, 'temp_import_' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    // Extract the import file
    await extract(importPath, { dir: tempDir });
    
    // Check import metadata
    const infoPath = path.join(tempDir, 'export-info.json');
    if (!fs.existsSync(infoPath)) {
      throw new Error('Invalid import file: missing metadata');
    }
    
    const exportInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    
    // Ensure uploads directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    
    // Get database connection
    const db = await getConnection();
    
    // Get all metadata files
    const metadataDir = path.join(tempDir, 'metadata');
    const imagesDir = path.join(tempDir, 'images');
    
    if (!fs.existsSync(metadataDir) || !fs.existsSync(imagesDir)) {
      db.close();
      throw new Error('Invalid import file: missing required directories');
    }
    
    const metadataFiles = fs.readdirSync(metadataDir)
      .filter(file => file.endsWith('.json'));
    
    // Import each image
    const importedImages = [];
    const errors = [];
    
    for (const metadataFile of metadataFiles) {
      try {
        const metadataPath = path.join(metadataDir, metadataFile);
        const imageData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        
        // Check if the image file exists in the import
        const imagePath = path.join(imagesDir, imageData.fileName);
        if (!fs.existsSync(imagePath)) {
          errors.push({
            id: imageData.id,
            error: `Image file not found in import: ${imageData.fileName}`
          });
          continue;
        }
        
        // Generate a new unique ID for the image
        const newId = uuidv4();
        
        // Copy the image to the uploads directory
        const newFileName = `${newId}${path.extname(imageData.fileName)}`;
        const newFilePath = path.join(UPLOADS_DIR, newFileName);
        fs.copyFileSync(imagePath, newFilePath);
        
        // Create URL path for the image
        const imageUrl = `/uploads/${newFileName}`;
        
        // Insert the image into the database
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO images (
              id, fileName, fileSize, mimeType, url, filePath, thumbnailUrl, uploadDate, metadata, private
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newId,
              imageData.fileName,
              imageData.fileSize,
              imageData.mimeType,
              imageUrl,
              newFilePath,
              imageUrl, // Use the same URL for thumbnail
              new Date().toISOString(), // Use current time for import date
              JSON.stringify(imageData.metadata),
              0 // Not private by default
            ],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        // Add to search index
        const metadata = imageData.metadata;
        
        // Helper function to add a field to the search index
        const indexMetadataField = async (field, value) => {
          if (!value) return;
          
          const valueStr = typeof value === 'string' ? value : value.toString();
          
          return new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO search_index (imageId, field, value) VALUES (?, ?, ?)',
              [newId, field, valueStr.toLowerCase()],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        };
        
        // Index all metadata fields
        if (metadata) {
          // Index medium
          await indexMetadataField('medium', metadata.medium);
          
          // Index people data
          if (metadata.people) {
            if (metadata.people.number) {
              await indexMetadataField('people_number', metadata.people.number);
            }
            if (metadata.people.gender) {
              await indexMetadataField('people_gender', metadata.people.gender);
            }
          }
          
          // Index actions
          await indexMetadataField('actions', metadata.actions);
          
          // Index clothes
          await indexMetadataField('clothes', metadata.clothes);
          
          // Index environment
          await indexMetadataField('environment', metadata.environment);
          
          // Index colors
          if (metadata.colors && Array.isArray(metadata.colors)) {
            for (const color of metadata.colors) {
              await indexMetadataField('colors', color);
            }
          }
          
          // Index style
          await indexMetadataField('style', metadata.style);
          
          // Index mood
          await indexMetadataField('mood', metadata.mood);
          
          // Index scene
          await indexMetadataField('scene', metadata.scene);
          
          // Index individual scene words
          if (metadata.scene) {
            const words = metadata.scene
              .toLowerCase()
              .replace(/[^\w\s]/g, '')
              .split(/\s+/)
              .filter(word => word.length > 3);
            
            // Get unique words
            const uniqueWords = [...new Set(words)];
            
            // Index each unique word
            for (const word of uniqueWords) {
              await indexMetadataField('scene_word', word);
            }
          }
        }
        
        importedImages.push({
          originalId: imageData.id,
          newId,
          fileName: imageData.fileName
        });
      } catch (error) {
        console.error(`Error importing image ${metadataFile}:`, error);
        errors.push({
          file: metadataFile,
          error: error.message
        });
      }
    }
    
    db.close();
    
    return {
      success: true,
      importedCount: importedImages.length,
      importedImages,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    throw error;
  } finally {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// Mark/unmark an image as private
async function setImagePrivacy(imageId, isPrivate) {
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE images SET private = ? WHERE id = ?',
      [isPrivate ? 1 : 0, imageId],
      function(err) {
        db.close();
        
        if (err) return reject(err);
        if (this.changes === 0) return reject(new Error('Image not found'));
        
        resolve({
          id: imageId,
          private: isPrivate
        });
      }
    );
  });
}

// Delete an image and its associated data
async function deleteImage(imageId) {
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    // First get the file path
    db.get('SELECT filePath FROM images WHERE id = ?', [imageId], (err, row) => {
      if (err) {
        db.close();
        return reject(err);
      }
      
      if (!row) {
        db.close();
        return reject(new Error('Image not found'));
      }
      
      const filePath = row.filePath;
      
      // Delete the image from the database
      db.run('DELETE FROM images WHERE id = ?', [imageId], function(err) {
        if (err) {
          db.close();
          return reject(err);
        }
        
        // Delete all search index entries for this image
        db.run('DELETE FROM search_index WHERE imageId = ?', [imageId], function(err) {
          if (err) {
            console.error(`Error deleting search index for image ${imageId}:`, err);
          }
          
          // Delete any album associations
          db.run('DELETE FROM album_images WHERE image_id = ?', [imageId], function(err) {
            if (err) {
              console.error(`Error deleting album associations for image ${imageId}:`, err);
            }
            
            db.close();
            
            // Delete the file if it exists
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch (error) {
                console.error(`Error deleting file ${filePath}:`, error);
                // Continue despite file deletion error
              }
            }
            
            resolve({
              success: true,
              id: imageId
            });
          });
        });
      });
    });
  });
}

// Delete multiple images at once
async function deleteMultipleImages(imageIds) {
  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    throw new Error('No image IDs provided');
  }
  
  const results = {
    success: [],
    errors: []
  };
  
  for (const imageId of imageIds) {
    try {
      await deleteImage(imageId);
      results.success.push(imageId);
    } catch (error) {
      results.errors.push({
        id: imageId,
        error: error.message
      });
    }
  }
  
  return results;
}

// Create a new album
async function createAlbum(name, description = '') {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('Valid album name is required');
  }
  
  const db = await getConnection();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO albums (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, name.trim(), description.trim(), now, now],
      function(err) {
        db.close();
        
        if (err) return reject(err);
        
        resolve({
          id,
          name: name.trim(),
          description: description.trim(),
          created_at: now,
          updated_at: now
        });
      }
    );
  });
}

// Add images to an album
async function addImagesToAlbum(albumId, imageIds) {
  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    throw new Error('No image IDs provided');
  }
  
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    // First check if the album exists
    db.get('SELECT id FROM albums WHERE id = ?', [albumId], (err, row) => {
      if (err) {
        db.close();
        return reject(err);
      }
      
      if (!row) {
        db.close();
        return reject(new Error('Album not found'));
      }
      
      // Add each image to the album
      const now = new Date().toISOString();
      const stmt = db.prepare(
        'INSERT OR IGNORE INTO album_images (album_id, image_id, added_at) VALUES (?, ?, ?)'
      );
      
      const results = {
        added: [],
        errors: []
      };
      
      for (const imageId of imageIds) {
        stmt.run([albumId, imageId, now], function(err) {
          if (err) {
            results.errors.push({
              id: imageId,
              error: err.message
            });
          } else if (this.changes > 0) {
            results.added.push(imageId);
          }
        });
      }
      
      stmt.finalize(err => {
        db.close();
        
        if (err) return reject(err);
        
        resolve(results);
      });
    });
  });
}

// Get all albums
async function getAlbums() {
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT albums.*, COUNT(album_images.image_id) as image_count 
       FROM albums 
       LEFT JOIN album_images ON albums.id = album_images.album_id 
       GROUP BY albums.id
       ORDER BY albums.updated_at DESC`,
      (err, rows) => {
        db.close();
        
        if (err) return reject(err);
        
        resolve(rows);
      }
    );
  });
}

// Get images in an album
async function getAlbumImages(albumId) {
  const db = await getConnection();
  
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT images.* 
       FROM images 
       JOIN album_images ON images.id = album_images.image_id 
       WHERE album_images.album_id = ?
       ORDER BY album_images.added_at DESC`,
      [albumId],
      (err, rows) => {
        db.close();
        
        if (err) return reject(err);
        
        const images = rows.map(row => ({
          id: row.id,
          fileName: row.fileName,
          fileSize: row.fileSize,
          mimeType: row.mimeType,
          url: row.url,
          thumbnailUrl: row.thumbnailUrl,
          uploadDate: row.uploadDate,
          metadata: JSON.parse(row.metadata),
          private: row.private === 1
        }));
        
        resolve(images);
      }
    );
  });
}

module.exports = {
  // Database initialization
  initializeDatabase,
  getConnection,
  
  // Settings management
  getSetting,
  updateSetting,
  getAllSettings,
  
  // Storage management
  getStorageUsage,
  getStorageLimit,
  isStorageLimitReached,
  updateStorageLimit,
  
  // Backup and restore
  createBackup,
  restoreFromBackup,
  listBackups,
  deleteBackup,
  
  // Database maintenance
  optimizeDatabase,
  cleanupUnusedFiles,
  getDatabaseStats,
  
  // Image import/export
  exportImages,
  importImages,
  
  // Image management
  setImagePrivacy,
  deleteImage,
  deleteMultipleImages,
  
  // Album management
  createAlbum,
  addImagesToAlbum,
  getAlbums,
  getAlbumImages
};