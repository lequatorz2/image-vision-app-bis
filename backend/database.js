const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create database directory if it doesn't exist
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite database
const db = new sqlite3.Database(path.join(dbDir, 'images.db'));

// Initialize database with tables
function initializeDatabase() {
  db.serialize(() => {
    // Images table
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
        metadata TEXT
      )
    `);
    
    // Search index tables for efficient querying
    db.run(`
      CREATE TABLE IF NOT EXISTS search_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        imageId TEXT,
        field TEXT,
        value TEXT,
        FOREIGN KEY (imageId) REFERENCES images(id) ON DELETE CASCADE
      )
    `);
    
    // Create indexes for faster searches
    db.run(`CREATE INDEX IF NOT EXISTS idx_search_field ON search_index(field)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_search_value ON search_index(value)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_search_image_id ON search_index(imageId)`);
    
    console.log('Database initialized');
  });
}

// Save image metadata to database and update search index
async function saveImageMetadata(id, imageData) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `INSERT INTO images (id, fileName, fileSize, mimeType, url, filePath, thumbnailUrl, uploadDate, metadata) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          imageData.fileName,
          imageData.fileSize,
          imageData.mimeType,
          imageData.url,
          imageData.filePath,
          imageData.thumbnailUrl || imageData.url, // Use URL as thumbnailUrl if not provided
          imageData.uploadDate,
          JSON.stringify(imageData.metadata)
        ],
        function(err) {
          if (err) {
            return reject(err);
          }
          
          // Index metadata fields for efficient searching
          const metadata = imageData.metadata;
          const indexPromises = [];
          
          // Add each metadata field to the search index
          if (metadata) {
            // Index medium
            if (metadata.medium) {
              indexPromises.push(
                indexMetadataField(id, 'medium', metadata.medium)
              );
            }
            
            // Index people data
            if (metadata.people) {
              if (metadata.people.number) {
                indexPromises.push(
                  indexMetadataField(id, 'people_number', metadata.people.number.toString())
                );
              }
              if (metadata.people.gender) {
                indexPromises.push(
                  indexMetadataField(id, 'people_gender', metadata.people.gender)
                );
              }
            }
            
            // Index actions
            if (metadata.actions) {
              indexPromises.push(
                indexMetadataField(id, 'actions', metadata.actions)
              );
            }
            
            // Index clothes
            if (metadata.clothes) {
              indexPromises.push(
                indexMetadataField(id, 'clothes', metadata.clothes)
              );
            }
            
            // Index environment
            if (metadata.environment) {
              indexPromises.push(
                indexMetadataField(id, 'environment', metadata.environment)
              );
            }
            
            // Index colors (each color separately)
            if (metadata.colors && Array.isArray(metadata.colors)) {
              metadata.colors.forEach(color => {
                indexPromises.push(
                  indexMetadataField(id, 'colors', color)
                );
              });
            }
            
            // Index style
            if (metadata.style) {
              indexPromises.push(
                indexMetadataField(id, 'style', metadata.style)
              );
            }
            
            // Index mood
            if (metadata.mood) {
              indexPromises.push(
                indexMetadataField(id, 'mood', metadata.mood)
              );
            }
            
            // Index scene (full-text)
            if (metadata.scene) {
              // Index the whole scene description
              indexPromises.push(
                indexMetadataField(id, 'scene', metadata.scene)
              );
              
              // Also index individual words for better search
              const words = metadata.scene
                .toLowerCase()
                .replace(/[^\w\s]/g, '') // Remove punctuation
                .split(/\s+/) // Split by whitespace
                .filter(word => word.length > 3); // Only index words longer than 3 chars
              
              // Get unique words
              const uniqueWords = [...new Set(words)];
              
              // Index each unique word
              uniqueWords.forEach(word => {
                indexPromises.push(
                  indexMetadataField(id, 'scene_word', word)
                );
              });
            }
          }
          
          // Resolve when all indexing is complete
          Promise.all(indexPromises)
            .then(() => resolve())
            .catch(indexErr => reject(indexErr));
        }
      );
    });
  });
}

// Helper function to add a field to the search index
function indexMetadataField(imageId, field, value) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO search_index (imageId, field, value) VALUES (?, ?, ?)',
      [imageId, field, value.toLowerCase()], // Store values in lowercase for case-insensitive search
      function(err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

// Get all images
async function getImages() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM images ORDER BY uploadDate DESC', (err, rows) => {
      if (err) return reject(err);
      
      const images = rows.map(row => ({
        id: row.id,
        fileName: row.fileName,
        fileSize: row.fileSize,
        mimeType: row.mimeType,
        url: row.url,
        thumbnailUrl: row.thumbnailUrl,
        uploadDate: row.uploadDate,
        metadata: JSON.parse(row.metadata)
      }));
      
      resolve(images);
    });
  });
}

// Get a single image by ID
async function getImageById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM images WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      
      const image = {
        id: row.id,
        fileName: row.fileName,
        fileSize: row.fileSize,
        mimeType: row.mimeType,
        url: row.url,
        thumbnailUrl: row.thumbnailUrl,
        uploadDate: row.uploadDate,
        metadata: JSON.parse(row.metadata)
      };
      
      resolve(image);
    });
  });
}

// Advanced search function
async function searchImages(query, filters = {}) {
  return new Promise((resolve, reject) => {
    let params = [];
    let conditions = [];
    
    // Build query conditions
    if (query && query.trim()) {
      const searchTerms = query.toLowerCase().trim().split(/\s+/);
      
      // For each search term, look in all indexed fields
      const searchConditions = searchTerms.map(term => {
        params.push(`%${term}%`);
        return `value LIKE ?`;
      });
      
      conditions.push(`(${searchConditions.join(' OR ')})`);
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
      return getImages().then(resolve).catch(reject);
    }
    
    // Build the full SQL query
    const whereClause = conditions.join(' AND ');
    const sql = `
      SELECT DISTINCT imageId FROM search_index
      WHERE ${whereClause}
    `;
    
    db.all(sql, params, async (err, rows) => {
      if (err) return reject(err);
      
      try {
        // Get unique image IDs from search results
        const imageIds = [...new Set(rows.map(row => row.imageId))];
        
        if (imageIds.length === 0) {
          return resolve([]);
        }
        
        // Fetch full image details for the matching IDs
        const placeholders = imageIds.map(() => '?').join(',');
        const imagesSql = `SELECT * FROM images WHERE id IN (${placeholders}) ORDER BY uploadDate DESC`;
        
        db.all(imagesSql, imageIds, (imagesErr, imageRows) => {
          if (imagesErr) return reject(imagesErr);
          
          const images = imageRows.map(row => ({
            id: row.id,
            fileName: row.fileName,
            fileSize: row.fileSize,
            mimeType: row.mimeType,
            url: row.url,
            thumbnailUrl: row.thumbnailUrl,
            uploadDate: row.uploadDate,
            metadata: JSON.parse(row.metadata)
          }));
          
          resolve(images);
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Get database statistics
async function getStats() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const stats = {};
      
      // Get total images count
      db.get('SELECT COUNT(*) as count FROM images', (err, row) => {
        if (err) return reject(err);
        stats.totalImages = row.count;
        
        // Calculate total storage used
        db.get('SELECT SUM(fileSize) as total FROM images', (err, row) => {
          if (err) return reject(err);
          stats.storageUsed = row.total || 0;
          
          // Count unique categories (combination of medium, style, environment, and mood)
          db.get('SELECT COUNT(DISTINCT value) as count FROM search_index WHERE field IN ("medium", "style", "environment", "mood")', 
            (err, row) => {
              if (err) return reject(err);
              stats.uniqueCategories = row.count;
              
              // Count total people detected
              db.get('SELECT SUM(CAST(value AS INTEGER)) as count FROM search_index WHERE field = "people_number"',
                (err, row) => {
                  if (err) return reject(err);
                  stats.totalPeople = row.count || 0;
                  
                  // Get top styles
                  db.all('SELECT value, COUNT(*) as count FROM search_index WHERE field = "style" GROUP BY value ORDER BY count DESC LIMIT 5',
                    (err, rows) => {
                      if (err) return reject(err);
                      stats.topStyles = rows;
                      
                      // Get top environments
                      db.all('SELECT value, COUNT(*) as count FROM search_index WHERE field = "environment" GROUP BY value ORDER BY count DESC LIMIT 5',
                        (err, rows) => {
                          if (err) return reject(err);
                          stats.topEnvironments = rows;
                          
                          // Get top moods
                          db.all('SELECT value, COUNT(*) as count FROM search_index WHERE field = "mood" GROUP BY value ORDER BY count DESC LIMIT 5',
                            (err, rows) => {
                              if (err) return reject(err);
                              stats.topMoods = rows;
                              
                              // Get top colors
                              db.all('SELECT value, COUNT(*) as count FROM search_index WHERE field = "colors" GROUP BY value ORDER BY count DESC LIMIT 5',
                                (err, rows) => {
                                  if (err) return reject(err);
                                  stats.topColors = rows;
                                  
                                  resolve(stats);
                                }
                              );
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        });
      });
    });
  });
}

// Initialize database on module load
initializeDatabase();

module.exports = {
  saveImageMetadata,
  getImages,
  getImageById,
  searchImages,
  getStats
};