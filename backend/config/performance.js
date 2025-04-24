/**
 * Performance Configuration
 * 
 * This file contains performance-related settings and optimizations for the Vision AI
 * application. These settings are designed to improve application performance,
 * especially when dealing with large image collections.
 */

const os = require('os');

// Determine number of available CPU cores for parallel processing
const cpuCount = os.cpus().length;

// Determine memory limits based on available system memory
const totalMemory = os.totalmem();
const memoryLimit = Math.floor(totalMemory * 0.7); // Use up to 70% of available memory

// Cache control settings
const cacheSettings = {
  // HTTP cache max age in seconds (1 hour)
  httpMaxAge: 3600,
  
  // In-memory cache sizes
  thumbnailCacheSize: Math.floor(memoryLimit * 0.2), // 20% of memory limit for thumbnail cache
  metadataCacheSize: Math.floor(memoryLimit * 0.1), // 10% of memory limit for metadata cache
  searchCacheSize: Math.floor(memoryLimit * 0.1), // 10% of memory limit for search result cache
  
  // Cache expiration times in milliseconds
  thumbnailCacheExpiry: 30 * 60 * 1000, // 30 minutes
  metadataCacheExpiry: 60 * 60 * 1000, // 1 hour
  searchCacheExpiry: 10 * 60 * 1000, // 10 minutes
};

// SQLite database optimizations
const sqliteSettings = {
  // WAL (Write-Ahead Logging) journal mode for better performance
  journalMode: 'WAL',
  
  // Synchronous mode (1=NORMAL provides good performance with reasonable safety)
  synchronous: 1,
  
  // Cache size in pages (default page size is 4096 bytes)
  // Depends on available memory
  cacheSize: Math.floor(memoryLimit / 4096 / 4), // 25% of memory for SQLite cache
  
  // Store temp tables in memory instead of on disk
  tempStore: 2, // 2=MEMORY
  
  // Automatic database optimization settings
  vacuumInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Connection pool settings
  poolMin: 1,
  poolMax: Math.max(2, Math.min(cpuCount, 8)), // Between 2 and 8, based on CPU cores
};

// Image processing optimizations
const imageProcessingSettings = {
  // Maximum concurrent image processing tasks
  concurrentProcessing: Math.max(1, cpuCount - 1),
  
  // Thumbnail generation quality (0-100, lower is faster)
  thumbnailQuality: 80,
  
  // Maximum image dimensions for thumbnail generation
  maxThumbnailDimension: 300,
  
  // Batch processing settings
  batchSize: 10,
  batchTimeout: 30000, // 30 seconds
  
  // Image compression settings for storage optimization
  compressJpegQuality: 85,
  compressPngQuality: 90,
  
  // Automatically compress images larger than this size (in bytes)
  autoCompressThreshold: 5 * 1024 * 1024, // 5MB
};

// Search optimization settings
const searchSettings = {
  // Maximum results per page
  resultsPerPage: 50,
  
  // Maximum search complexity (terms * filters)
  maxComplexity: 20,
  
  // Search timeout in milliseconds
  timeout: 10000, // 10 seconds
  
  // Minimum term length for indexing
  minTermLength: 3,
  
  // Maximum items in search history
  maxHistory: 50,
  
  // Natural language processing settings
  enableSynonyms: true,
  enableStemming: true,
  maxQueryLength: 500,
};

// API request limits
const apiLimits = {
  // Rate limiting for Gemini API requests (requests per minute)
  geminiRateLimit: 100,
  
  // Maximum upload size (in bytes)
  maxUploadSize: 25 * 1024 * 1024, // 25MB
  
  // Maximum number of files per upload
  maxFilesPerUpload: 100,
  
  // Request timeout in milliseconds
  requestTimeout: 60000, // 60 seconds
};

// System monitoring settings
const monitoringSettings = {
  // Enable performance monitoring
  enabled: true,
  
  // Log performance metrics interval (milliseconds)
  metricsInterval: 5 * 60 * 1000, // 5 minutes
  
  // Memory usage warning threshold (percentage)
  memoryWarningThreshold: 85,
  
  // Auto-optimization trigger settings
  triggerOptimizeOnMemory: 90, // percentage
  triggerOptimizeOnStorageGrowth: 20, // percentage growth since last optimization
};

// Export all settings
module.exports = {
  cpuCount,
  memoryLimit,
  cacheSettings,
  sqliteSettings,
  imageProcessingSettings,
  searchSettings,
  apiLimits,
  monitoringSettings,
  
  // Apply optimal settings based on detected system
  applyOptimalSettings: () => {
    console.log(`Applying performance optimizations for a system with ${cpuCount} CPU cores and ${Math.round(totalMemory / (1024 * 1024 * 1024))}GB RAM`);
    
    // Configure SQLite optimizations
    const db = require('../db-manager').getConnection();
    db.exec(`
      PRAGMA journal_mode = ${sqliteSettings.journalMode};
      PRAGMA synchronous = ${sqliteSettings.synchronous};
      PRAGMA cache_size = ${sqliteSettings.cacheSize};
      PRAGMA temp_store = ${sqliteSettings.tempStore};
    `);
    db.close();
    
    // Set up scheduled optimizations
    require('../utils/scheduler').schedule(
      'database-optimization',
      sqliteSettings.vacuumInterval,
      async () => {
        const dbManager = require('../db-manager');
        await dbManager.optimizeDatabase();
        console.log('Scheduled database optimization completed');
      }
    );
    
    // Apply memory limits to Node.js process
    if (process.env.NODE_ENV === 'production') {
      // V8 heap size limits
      const limitMb = Math.floor(memoryLimit / (1024 * 1024));
      process.env.NODE_OPTIONS = `--max-old-space-size=${limitMb}`;
      console.log(`Node.js memory limit set to ${limitMb}MB`);
    }
    
    return {
      success: true,
      appliedSettings: {
        cpuCount,
        memoryLimitMb: Math.floor(memoryLimit / (1024 * 1024)),
        sqliteCache: sqliteSettings.cacheSize * 4, // in KB
        concurrentProcessing: imageProcessingSettings.concurrentProcessing
      }
    };
  }
};