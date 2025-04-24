/**
 * Database optimization script
 * Run with: npm run optimize
 */

const dbManager = require('../db-manager');

async function optimizeDatabase() {
  console.log('Starting database optimization...');
  
  try {
    // Get storage usage before optimization
    const beforeStats = await dbManager.getStorageUsage();
    console.log('Storage usage before optimization:');
    console.log(`- Database size: ${formatSize(beforeStats.databaseSize)}`);
    console.log(`- Image storage: ${formatSize(beforeStats.totalStorage)}`);
    console.log(`- Total: ${formatSize(beforeStats.totalSize)}`);
    
    // Optimize the database
    console.log('\nOptimizing database...');
    const result = await dbManager.optimizeDatabase();
    console.log(result.message);
    
    // Clean up unused files
    console.log('\nCleaning up unused files...');
    const cleanupResult = await dbManager.cleanupUnusedFiles();
    console.log(`Removed ${cleanupResult.deletedFiles.length} unused files, reclaimed ${formatSize(cleanupResult.totalReclaimed)}`);
    
    // Get storage usage after optimization
    const afterStats = await dbManager.getStorageUsage();
    console.log('\nStorage usage after optimization:');
    console.log(`- Database size: ${formatSize(afterStats.databaseSize)}`);
    console.log(`- Image storage: ${formatSize(afterStats.totalStorage)}`);
    console.log(`- Total: ${formatSize(afterStats.totalSize)}`);
    
    // Calculate saved space
    const savedSpace = beforeStats.totalSize - afterStats.totalSize;
    if (savedSpace > 0) {
      console.log(`\nOptimization freed up ${formatSize(savedSpace)} of storage space`);
    } else {
      console.log('\nOptimization completed but did not reduce storage usage');
    }
    
    // Get detailed database stats
    console.log('\nGetting database statistics...');
    const dbStats = await dbManager.getDatabaseStats();
    
    console.log('\nDatabase table counts:');
    console.log(`- Images: ${dbStats.images.count}`);
    console.log(`- Search index entries: ${dbStats.search_index.count}`);
    console.log(`- Albums: ${dbStats.albums.count}`);
    
    console.log('\nImage formats:');
    dbStats.mimeTypes.forEach(type => {
      console.log(`- ${type.mimeType}: ${type.count} images (${formatSize(type.totalSize)})`);
    });
    
    console.log('\nFile size distribution:');
    const ranges = ['0-100 KB', '100 KB - 1 MB', '1-5 MB', '> 5 MB'];
    dbStats.sizeDistribution.forEach(dist => {
      console.log(`- ${ranges[dist.range]}: ${dist.count} images`);
    });
    
    console.log('\nOptimization completed successfully!');
  } catch (error) {
    console.error('Error optimizing database:', error);
    process.exit(1);
  }
}

// Helper function to format file sizes
function formatSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the optimization
optimizeDatabase();