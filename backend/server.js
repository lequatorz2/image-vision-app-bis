const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { analyzeImageWithGemini, extractSearchCriteriaFromQuery } = require('./gemini');
const dbManager = require('./db-manager');
const storageRoutes = require('./routes/storage-routes');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize the database
dbManager.initializeDatabase()
  .then(() => {
    console.log('Database initialized successfully');
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    
    // Create the uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  fileFilter: async (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/i;
    const isValidType = allowedTypes.test(path.extname(file.originalname)) && 
                        allowedTypes.test(file.mimetype);
    
    if (!isValidType) {
      return cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP files are allowed.'));
    }
    
    // Check if storage limit is reached
    try {
      const limitReached = await dbManager.isStorageLimitReached();
      if (limitReached) {
        return cb(new Error('Storage limit reached. Please free up some space.'));
      }
      
      cb(null, true);
    } catch (error) {
      cb(error);
    }
  }
});

// Use storage routes
app.use('/api/storage', storageRoutes);

// Routes

// Get all images
app.get('/api/images', async (req, res) => {
  try {
    const db = await dbManager.getConnection();
    
    const query = `
      SELECT * FROM images
      ORDER BY uploadDate DESC
    `;
    
    db.all(query, (err, rows) => {
      db.close();
      
      if (err) {
        console.error('Error fetching images:', err);
        return res.status(500).json({ error: 'Failed to fetch images' });
      }
      
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
      
      res.json(images);
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Get a single image by ID
app.get('/api/images/:id', async (req, res) => {
  try {
    const db = await dbManager.getConnection();
    
    db.get('SELECT * FROM images WHERE id = ?', [req.params.id], (err, row) => {
      db.close();
      
      if (err) {
        console.error('Error fetching image details:', err);
        return res.status(500).json({ error: 'Failed to fetch image details' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      const image = {
        id: row.id,
        fileName: row.fileName,
        fileSize: row.fileSize,
        mimeType: row.mimeType,
        url: row.url,
        thumbnailUrl: row.thumbnailUrl,
        uploadDate: row.uploadDate,
        metadata: JSON.parse(row.metadata),
        private: row.private === 1
      };
      
      res.json(image);
    });
  } catch (error) {
    console.error('Error fetching image details:', error);
    res.status(500).json({ error: 'Failed to fetch image details' });
  }
});

// Search images
app.post('/api/search', async (req, res) => {
  try {
    const { query, filters } = req.body;
    
    const db = await dbManager.getConnection();
    
    let params = [];
    let conditions = [];
    
    // Build query conditions
    if (query && query.trim()) {
      const searchTerms = query.toLowerCase().trim().split(/\s+/);
      
      // For each search term, look in all indexed fields
      for (const term of searchTerms) {
        params.push(`%${term}%`);
        conditions.push(`value LIKE ?`);
      }
    }
    
    // Add filters if provided
    if (filters && Object.keys(filters).length > 0) {
      Object.entries(filters).forEach(([field, value]) => {
        if (value && value.trim()) {
          const fieldValue = value.toLowerCase().trim();
          
          // Handle different field types
          if (field === 'people') {
            // Search in both people_number and people_gender
            params.push(`%${fieldValue}%`);
            params.push(`%${fieldValue}%`);
            conditions.push(`((field = 'people_number' AND value LIKE ?) OR (field = 'people_gender' AND value LIKE ?))`);
          } else {
            // For other fields, search directly
            params.push(field);
            params.push(`%${fieldValue}%`);
            conditions.push(`(field = ? AND value LIKE ?)`);
          }
        }
      });
    }
    
    // If no search conditions, return all images
    if (conditions.length === 0) {
      db.close();
      
      // Call the existing /api/images endpoint
      return app._router.handle(req, res, () => {
        res.status(500).json({ error: 'Failed to search images' });
      });
    }
    
    // Build the full SQL query
    const whereClause = conditions.join(' AND ');
    const sql = `
      SELECT DISTINCT imageId FROM search_index
      WHERE ${whereClause}
    `;
    
    db.all(sql, params, async (err, rows) => {
      if (err) {
        db.close();
        console.error('Error searching images:', err);
        return res.status(500).json({ error: 'Failed to search images' });
      }
      
      try {
        // Get unique image IDs from search results
        const imageIds = [...new Set(rows.map(row => row.imageId))];
        
        if (imageIds.length === 0) {
          db.close();
          return res.json([]);
        }
        
        // Fetch full image details for the matching IDs
        const placeholders = imageIds.map(() => '?').join(',');
        const imagesSql = `SELECT * FROM images WHERE id IN (${placeholders}) ORDER BY uploadDate DESC`;
        
        db.all(imagesSql, imageIds, (imagesErr, imageRows) => {
          db.close();
          
          if (imagesErr) {
            console.error('Error fetching image details:', imagesErr);
            return res.status(500).json({ error: 'Failed to fetch image details' });
          }
          
          const images = imageRows.map(row => ({
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
          
          res.json(images);
        });
      } catch (error) {
        db.close();
        console.error('Error processing search results:', error);
        res.status(500).json({ error: 'Failed to process search results' });
      }
    });
  } catch (error) {
    console.error('Error searching images:', error);
    res.status(500).json({ error: 'Failed to search images' });
  }
});

// Natural language search
app.post('/api/natural-search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Valid query string is required' });
    }
    
    // Use Gemini to extract search criteria from natural language
    let searchCriteria;
    
    if (process.env.MOCK_GEMINI === 'true') {
      // If in mock mode, use simple extraction logic
      searchCriteria = extractMockCriteria(query);
    } else {
      // Use Gemini to extract criteria
      searchCriteria = await extractSearchCriteriaFromQuery(query);
    }
    
    // Convert the criteria to our filter format
    const filters = {};
    const keywords = [];
    
    // Extract filters from the criteria
    if (searchCriteria.medium) filters.medium = searchCriteria.medium;
    if (searchCriteria.style) filters.style = searchCriteria.style;
    if (searchCriteria.mood) filters.mood = searchCriteria.mood;
    if (searchCriteria.environment) filters.environment = searchCriteria.environment;
    
    if (searchCriteria.people) {
      if (searchCriteria.people.gender) {
        filters.people = searchCriteria.people.gender;
      } else if (searchCriteria.people.number) {
        filters.people = searchCriteria.people.number.toString();
      }
    }
    
    if (searchCriteria.actions) filters.actions = searchCriteria.actions;
    if (searchCriteria.clothes) filters.clothes = searchCriteria.clothes;
    
    if (searchCriteria.colors && searchCriteria.colors.length > 0) {
      filters.colors = searchCriteria.colors[0]; // Just use the first color for now
    }
    
    // Add any additional keywords for a general search
    if (searchCriteria.keywords && searchCriteria.keywords.length > 0) {
      keywords.push(...searchCriteria.keywords);
    }
    
    // Create a modified request object for the search endpoint
    const searchReq = {
      ...req,
      body: {
        query: keywords.join(' '),
        filters: filters
      }
    };
    
    // Use the search endpoint to get the results
    let searchResults = [];
    
    // Create a promise to get the search results
    const searchPromise = new Promise((resolve) => {
      const searchRes = {
        json: (data) => {
          searchResults = data;
          resolve();
        },
        status: () => searchRes
      };
      
      // Call the search endpoint
      app._router.handle(searchReq, searchRes, () => {
        resolve();
      });
    });
    
    // Wait for the search to complete
    await searchPromise;
    
    // Return the results
    res.json({
      results: searchResults,
      extractedCriteria: {
        filters,
        keywords
      }
    });
  } catch (error) {
    console.error('Error performing natural language search:', error);
    res.status(500).json({ error: 'Failed to perform natural language search' });
  }
});

// Get related images
app.get('/api/images/related/:id', async (req, res) => {
  try {
    const imageId = req.params.id;
    
    const db = await dbManager.getConnection();
    
    // First get the source image
    db.get('SELECT * FROM images WHERE id = ?', [imageId], (err, sourceImage) => {
      if (err) {
        db.close();
        console.error('Error fetching source image:', err);
        return res.status(500).json({ error: 'Failed to fetch source image' });
      }
      
      if (!sourceImage) {
        db.close();
        return res.status(404).json({ error: 'Image not found' });
      }
      
      const sourceMetadata = JSON.parse(sourceImage.metadata);
      
      // Get all the images except the source image
      db.all('SELECT * FROM images WHERE id != ?', [imageId], (err, images) => {
        db.close();
        
        if (err) {
          console.error('Error fetching images for comparison:', err);
          return res.status(500).json({ error: 'Failed to fetch images for comparison' });
        }
        
        // Calculate similarity scores
        const relatedImages = images.map(image => {
          const metadata = JSON.parse(image.metadata);
          let score = 0;
          
          // Compare medium (higher weight)
          if (metadata.medium === sourceMetadata.medium) {
            score += 3;
          }
          
          // Compare style (higher weight)
          if (metadata.style === sourceMetadata.style) {
            score += 3;
          }
          
          // Compare environment
          if (metadata.environment === sourceMetadata.environment) {
            score += 2;
          }
          
          // Compare mood
          if (metadata.mood === sourceMetadata.mood) {
            score += 2;
          }
          
          // Compare colors
          const sourceColors = sourceMetadata.colors || [];
          const imgColors = metadata.colors || [];
          const commonColors = sourceColors.filter(color => imgColors.includes(color));
          score += commonColors.length;
          
          // Compare actions
          if (metadata.actions === sourceMetadata.actions) {
            score += 1;
          }
          
          // Compare clothes
          if (metadata.clothes === sourceMetadata.clothes) {
            score += 1;
          }
          
          return {
            id: image.id,
            fileName: image.fileName,
            url: image.url,
            thumbnailUrl: image.thumbnailUrl,
            uploadDate: image.uploadDate,
            metadata: metadata,
            similarityScore: score
          };
        });
        
        // Filter, sort, and limit results
        const results = relatedImages
          .filter(img => img.similarityScore > 0)
          .sort((a, b) => b.similarityScore - a.similarityScore)
          .slice(0, 6);
        
        res.json(results);
      });
    });
  } catch (error) {
    console.error('Error finding related images:', error);
    res.status(500).json({ error: 'Failed to find related images' });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    // Get database statistics
    const dbStats = await dbManager.getDatabaseStats();
    
    // Get storage usage
    const storageStats = await dbManager.getStorageUsage();
    
    // Get storage limit
    const storageLimit = await dbManager.getStorageLimit();
    
    // Combine everything into a comprehensive stats object
    const stats = {
      totalImages: dbStats.imageStats?.totalImages || 0,
      privateImages: dbStats.imageStats?.privateImages || 0,
      uniqueCategories: new Set([
        ...dbStats.mimeTypes?.map(type => type.mimeType) || [],
        ...(dbStats.search_index?.fieldValues?.filter(item => 
          ['medium', 'style', 'mood', 'environment'].includes(item.field)
        ).map(item => item.value) || [])
      ]).size,
      storageUsed: storageStats.totalSize,
      storageLimit: storageLimit,
      storagePercent: Math.round((storageStats.totalSize / storageLimit) * 100),
      databaseSize: storageStats.databaseSize,
      imageSize: storageStats.totalStorage,
      fileTypes: dbStats.mimeTypes || [],
      imageStats: {
        sizeDistribution: dbStats.sizeDistribution || []
      },
      topStyles: dbStats.styleStats || [],
      topEnvironments: dbStats.environmentStats || [],
      topMoods: dbStats.moodStats || [],
      topColors: dbStats.colorStats || []
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Upload images
app.post('/api/upload', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const uploadedImages = [];
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    // Get thumbnail quality setting
    const thumbnailQuality = parseInt(await dbManager.getSetting('thumbnail_quality') || '80', 10);
    
    // Process each uploaded image
    for (const file of req.files) {
      const imageUrl = `${baseUrl}/uploads/${file.filename}`;
      const filePath = file.path;
      
      try {
        // Generate thumbnail
        const thumbnailFileName = `thumb_${file.filename}`;
        const thumbnailPath = path.join(__dirname, 'uploads', thumbnailFileName);
        const thumbnailUrl = `${baseUrl}/uploads/${thumbnailFileName}`;
        
        await sharp(filePath)
          .resize(300, 300, { fit: 'inside' })
          .jpeg({ quality: thumbnailQuality })
          .toFile(thumbnailPath);
        
        // Analyze image with Gemini
        let metadata;
        
        if (process.env.MOCK_GEMINI === 'true') {
          // Use mock data if MOCK_GEMINI is set to true
          metadata = generateMockMetadata();
          // Add a small delay to simulate API call
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          // Analyze with real Gemini API
          metadata = await analyzeImageWithGemini(filePath);
        }
        
        // Save metadata to database
        const imageId = uuidv4();
        const db = await dbManager.getConnection();
        
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO images (
              id, fileName, fileSize, mimeType, url, filePath, thumbnailUrl, uploadDate, metadata, private
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              imageId,
              file.originalname,
              file.size,
              file.mimetype,
              imageUrl,
              filePath,
              thumbnailUrl,
              new Date().toISOString(),
              JSON.stringify(metadata),
              0 // Not private by default
            ],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
        
        // Add to search index
        const indexPromises = [];
        
        // Helper function to add a field to the search index
        const indexMetadataField = (field, value) => {
          if (!value) return Promise.resolve();
          
          const valueStr = typeof value === 'string' ? value : value.toString();
          
          return new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO search_index (imageId, field, value) VALUES (?, ?, ?)',
              [imageId, field, valueStr.toLowerCase()],
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
          indexPromises.push(indexMetadataField('medium', metadata.medium));
          
          // Index people data
          if (metadata.people) {
            if (metadata.people.number) {
              indexPromises.push(indexMetadataField('people_number', metadata.people.number));
            }
            if (metadata.people.gender) {
              indexPromises.push(indexMetadataField('people_gender', metadata.people.gender));
            }
          }
          
          // Index actions
          indexPromises.push(indexMetadataField('actions', metadata.actions));
          
          // Index clothes
          indexPromises.push(indexMetadataField('clothes', metadata.clothes));
          
          // Index environment
          indexPromises.push(indexMetadataField('environment', metadata.environment));
          
          // Index colors
          if (metadata.colors && Array.isArray(metadata.colors)) {
            metadata.colors.forEach(color => {
              indexPromises.push(indexMetadataField('colors', color));
            });
          }
          
          // Index style
          indexPromises.push(indexMetadataField('style', metadata.style));
          
          // Index mood
          indexPromises.push(indexMetadataField('mood', metadata.mood));
          
          // Index scene
          indexPromises.push(indexMetadataField('scene', metadata.scene));
          
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
            uniqueWords.forEach(word => {
              indexPromises.push(indexMetadataField('scene_word', word));
            });
          }
        }
        
        // Wait for all indexing to complete
        await Promise.all(indexPromises);
        
        db.close();
        
        uploadedImages.push({
          id: imageId,
          fileName: file.originalname,
          url: imageUrl,
          thumbnailUrl: thumbnailUrl,
          uploadDate: new Date().toISOString(),
          metadata: metadata
        });
      } catch (error) {
        console.error(`Error processing image ${file.originalname}:`, error);
        
        // Continue with other images even if one fails
        // In a production app, you might want to handle this differently
      }
    }
    
    res.json({ 
      success: true, 
      message: `Successfully processed ${uploadedImages.length} images`,
      images: uploadedImages
    });
    
    // Check if auto backup is enabled
    const autoBackup = await dbManager.getSetting('auto_backup');
    if (autoBackup === 'true') {
      try {
        console.log('Auto backup is enabled, creating backup...');
        await dbManager.createBackup(true);
        console.log('Auto backup created successfully');
      } catch (error) {
        console.error('Error creating auto backup:', error);
      }
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process uploads' });
  }
});

// Database maintenance and settings

// Get all settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await dbManager.getAllSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
app.post('/api/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings object' });
    }
    
    const results = [];
    
    for (const [key, value] of Object.entries(settings)) {
      // Validate the setting
      if (!key || typeof value !== 'string') continue;
      
      try {
        const result = await dbManager.updateSetting(key, value);
        results.push(result);
      } catch (error) {
        console.error(`Error updating setting ${key}:`, error);
      }
    }
    
    res.json({
      success: true,
      updatedSettings: results
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Create backup
app.post('/api/backup', async (req, res) => {
  try {
    const { includeImages = true } = req.body;
    
    const backup = await dbManager.createBackup(includeImages);
    
    res.json({
      success: true,
      backup
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// List backups
app.get('/api/backups', (req, res) => {
  try {
    const backups = dbManager.listBackups();
    res.json(backups);
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// Delete backup
app.delete('/api/backups/:filename', (req, res) => {
  try {
    const result = dbManager.deleteBackup(req.params.filename);
    res.json(result);
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

// Optimize database
app.post('/api/optimize', async (req, res) => {
  try {
    const result = await dbManager.optimizeDatabase();
    res.json(result);
  } catch (error) {
    console.error('Error optimizing database:', error);
    res.status(500).json({ error: 'Failed to optimize database' });
  }
});

// Cleanup unused files
app.post('/api/cleanup', async (req, res) => {
  try {
    const result = await dbManager.cleanupUnusedFiles();
    res.json(result);
  } catch (error) {
    console.error('Error cleaning up unused files:', error);
    res.status(500).json({ error: 'Failed to clean up unused files' });
  }
});

// Update storage limit
app.post('/api/storage-limit', async (req, res) => {
  try {
    const { limit } = req.body;
    
    if (!limit || isNaN(parseInt(limit, 10))) {
      return res.status(400).json({ error: 'Valid storage limit is required' });
    }
    
    const result = await dbManager.updateStorageLimit(limit);
    
    res.json({
      success: true,
      storageLimit: parseInt(result.value, 10)
    });
  } catch (error) {
    console.error('Error updating storage limit:', error);
    res.status(500).json({ error: 'Failed to update storage limit' });
  }
});

// Export images
app.post('/api/export', async (req, res) => {
  try {
    const { imageIds } = req.body;
    
    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'Valid image IDs are required' });
    }
    
    // Create export directory if it doesn't exist
    const exportDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Generate export file name
    const timestamp = new Date().toISOString().replace(/[:\\.]/g, '-');
    const exportFileName = `export-${timestamp}.zip`;
    const exportPath = path.join(exportDir, exportFileName);
    
    // Export the images
    const result = await dbManager.exportImages(imageIds, exportPath);
    
    res.json({
      success: true,
      exportPath: `/exports/${exportFileName}`,
      imageCount: result.imageCount,
      size: result.size
    });
  } catch (error) {
    console.error('Error exporting images:', error);
    res.status(500).json({ error: 'Failed to export images' });
  }
});

// Set image privacy
app.put('/api/images/:id/privacy', async (req, res) => {
  try {
    const { isPrivate } = req.body;
    
    if (typeof isPrivate !== 'boolean') {
      return res.status(400).json({ error: 'isPrivate must be a boolean value' });
    }
    
    const result = await dbManager.setImagePrivacy(req.params.id, isPrivate);
    
    res.json(result);
  } catch (error) {
    console.error('Error setting image privacy:', error);
    res.status(500).json({ error: 'Failed to set image privacy' });
  }
});

// Delete image
app.delete('/api/images/:id', async (req, res) => {
  try {
    const result = await dbManager.deleteImage(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Delete multiple images
app.post('/api/images/delete-multiple', async (req, res) => {
  try {
    const { imageIds } = req.body;
    
    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'Valid image IDs are required' });
    }
    
    const result = await dbManager.deleteMultipleImages(imageIds);
    res.json(result);
  } catch (error) {
    console.error('Error deleting multiple images:', error);
    res.status(500).json({ error: 'Failed to delete images' });
  }
});

// Album management

// Create album
app.post('/api/albums', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Valid album name is required' });
    }
    
    const album = await dbManager.createAlbum(name, description || '');
    res.json(album);
  } catch (error) {
    console.error('Error creating album:', error);
    res.status(500).json({ error: 'Failed to create album' });
  }
});

// Get all albums
app.get('/api/albums', async (req, res) => {
  try {
    const albums = await dbManager.getAlbums();
    res.json(albums);
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// Get images in an album
app.get('/api/albums/:id/images', async (req, res) => {
  try {
    const images = await dbManager.getAlbumImages(req.params.id);
    res.json(images);
  } catch (error) {
    console.error('Error fetching album images:', error);
    res.status(500).json({ error: 'Failed to fetch album images' });
  }
});

// Add images to album
app.post('/api/albums/:id/images', async (req, res) => {
  try {
    const { imageIds } = req.body;
    
    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'Valid image IDs are required' });
    }
    
    const result = await dbManager.addImagesToAlbum(req.params.id, imageIds);
    res.json(result);
  } catch (error) {
    console.error('Error adding images to album:', error);
    res.status(500).json({ error: 'Failed to add images to album' });
  }
});

// Helper function to generate mock metadata for testing
function generateMockMetadata() {
  const mediums = ['Photography', 'Painting', 'Digital Art', 'Illustration', 'Sketch'];
  const styles = ['Abstract', 'Realistic', 'Vintage', 'Modern', 'Minimalist', 'Surreal'];
  const moods = ['Happy', 'Sad', 'Dramatic', 'Nostalgic', 'Peaceful', 'Mysterious'];
  const environments = ['Indoor', 'Outdoor', 'Urban', 'Nature', 'Studio', 'Beach'];
  const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Black', 'White'];
  const actions = ['Standing', 'Running', 'Sitting', 'Dancing', 'Jumping', 'Sleeping'];
  const clothes = ['Formal', 'Casual', 'Sportswear', 'Traditional', 'Vintage', 'Elegant'];
  
  // Random number of people between 0 and 5
  const peopleCount = Math.floor(Math.random() * 6);
  let people = null;
  
  if (peopleCount > 0) {
    const genders = ['Male', 'Female', 'Mixed group'];
    people = {
      number: peopleCount,
      gender: genders[Math.floor(Math.random() * genders.length)]
    };
  }
  
  // Random scene description
  const sceneDescriptions = [
    'A serene landscape with mountains in the background and a calm lake reflecting the sky.',
    'A bustling city street with people walking and cars passing by.',
    'A cozy living room with a fireplace and comfortable furniture.',
    'A beautiful sunset over the ocean with waves crashing on the shore.',
    'A forest path with sunlight filtering through the trees.',
    'An abstract composition of shapes and colors creating a vibrant pattern.',
    'A portrait of a person with an expressive facial expression.',
    'A still life arrangement of fruits and flowers on a table.',
    'A macro shot of a flower with intricate details visible.',
    'A snowy winter scene with trees covered in white.'
  ];
  
  return {
    medium: mediums[Math.floor(Math.random() * mediums.length)],
    people: people,
    actions: peopleCount > 0 ? actions[Math.floor(Math.random() * actions.length)] : null,
    clothes: peopleCount > 0 ? clothes[Math.floor(Math.random() * clothes.length)] : null,
    environment: environments[Math.floor(Math.random() * environments.length)],
    colors: [
      colors[Math.floor(Math.random() * colors.length)],
      colors[Math.floor(Math.random() * colors.length)]
    ],
    style: styles[Math.floor(Math.random() * styles.length)],
    mood: moods[Math.floor(Math.random() * moods.length)],
    scene: sceneDescriptions[Math.floor(Math.random() * sceneDescriptions.length)]
  };
}

// Simple function to extract criteria for mock mode
function extractMockCriteria(query) {
  const criteria = {};
  const queryLower = query.toLowerCase();
  
  // Check for medium
  const mediums = ['photography', 'painting', 'digital art', 'illustration', 'sketch'];
  for (const medium of mediums) {
    if (queryLower.includes(medium)) {
      criteria.medium = medium.charAt(0).toUpperCase() + medium.slice(1);
      break;
    }
  }
  
  // Check for style
  const styles = ['abstract', 'realistic', 'vintage', 'modern', 'minimalist', 'surreal'];
  for (const style of styles) {
    if (queryLower.includes(style)) {
      criteria.style = style.charAt(0).toUpperCase() + style.slice(1);
      break;
    }
  }
  
  // Check for mood
  const moods = ['happy', 'sad', 'dramatic', 'nostalgic', 'peaceful', 'mysterious'];
  for (const mood of moods) {
    if (queryLower.includes(mood)) {
      criteria.mood = mood.charAt(0).toUpperCase() + mood.slice(1);
      break;
    }
  }
  
  // Check for environment
  const environments = ['indoor', 'outdoor', 'urban', 'nature', 'studio', 'beach'];
  for (const environment of environments) {
    if (queryLower.includes(environment)) {
      criteria.environment = environment.charAt(0).toUpperCase() + environment.slice(1);
      break;
    }
  }
  
  // Check for colors
  const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white'];
  const foundColors = [];
  
  for (const color of colors) {
    if (queryLower.includes(color)) {
      foundColors.push(color.charAt(0).toUpperCase() + color.slice(1));
    }
  }
  
  if (foundColors.length > 0) {
    criteria.colors = foundColors;
  }
  
  // Check for people
  if (queryLower.includes('people') || queryLower.includes('person')) {
    criteria.people = { number: 1 };
    
    // Check for gender
    if (queryLower.includes('male') || queryLower.includes('men') || queryLower.includes('man')) {
      criteria.people.gender = 'Male';
    } else if (queryLower.includes('female') || queryLower.includes('women') || queryLower.includes('woman')) {
      criteria.people.gender = 'Female';
    }
    
    // Check for multiple people
    if (queryLower.includes('group') || queryLower.includes('multiple')) {
      criteria.people.number = 3; // Arbitrary number for multiple
    }
  }
  
  // Check for actions
  const actions = ['standing', 'running', 'sitting', 'dancing', 'jumping', 'sleeping'];
  for (const action of actions) {
    if (queryLower.includes(action)) {
      criteria.actions = action.charAt(0).toUpperCase() + action.slice(1);
      break;
    }
  }
  
  // Check for clothes
  const clothes = ['formal', 'casual', 'sportswear', 'traditional', 'vintage', 'elegant'];
  for (const clothing of clothes) {
    if (queryLower.includes(clothing)) {
      criteria.clothes = clothing.charAt(0).toUpperCase() + clothing.slice(1);
      break;
    }
  }
  
  // Extract remaining keywords
  const excludedWords = [
    ...mediums, ...styles, ...moods, ...environments, ...colors, 
    ...actions, ...clothes, 'people', 'person', 'male', 'female',
    'men', 'women', 'man', 'woman', 'group', 'multiple', 'with', 'in', 'and',
    'the', 'a', 'an', 'of', 'find', 'show', 'search', 'for', 'me', 'images'
  ];
  
  const words = queryLower.split(/\s+/);
  const keywords = words.filter(word => 
    word.length > 3 && !excludedWords.includes(word)
  );
  
  if (keywords.length > 0) {
    criteria.keywords = keywords;
  }
  
  return criteria;
}

// Serve exports directory for downloads
app.use('/exports', express.static(path.join(__dirname, 'exports')));
app.use('/backups', express.static(path.join(__dirname, 'backups')));

// Add a route to serve the app
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Catch all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});