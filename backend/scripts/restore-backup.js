/**
 * Database restore script
 * Run with: npm run restore -- --file="backup-filename.zip"
 * 
 * Options:
 * --file=backup-filename.zip: The backup file to restore (required)
 * --overwrite: Overwrite existing files
 * --path=/path/to/backup.zip: Specify a custom path outside of the backups directory
 */

const dbManager = require('../db-manager');
const path = require('path');
const fs = require('fs');

async function restoreBackup() {
  console.log('Starting database restore...');
  
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const overwrite = args.includes('--overwrite');
    
    // Get backup file name
    let backupFile = null;
    let customPath = null;
    
    for (const arg of args) {
      if (arg.startsWith('--file=')) {
        backupFile = arg.split('=')[1].replace(/^["']|["']$/g, ''); // Remove quotes
      } else if (arg.startsWith('--path=')) {
        customPath = arg.split('=')[1].replace(/^["']|["']$/g, ''); // Remove quotes
      }
    }
    
    if (!backupFile && !customPath) {
      console.error('Error: You must specify a backup file with --file="filename.zip" or --path="/path/to/backup.zip"');
      process.exit(1);
    }
    
    let backupPath;
    
    if (customPath) {
      // Use custom path if specified
      backupPath = customPath;
      
      if (!fs.existsSync(backupPath)) {
        console.error(`Error: Backup file not found at ${backupPath}`);
        process.exit(1);
      }
    } else {
      // Use backup from backups directory
      const backupsDir = path.join(__dirname, '..', 'backups');
      backupPath = path.join(backupsDir, backupFile);
      
      if (!fs.existsSync(backupPath)) {
        console.error(`Error: Backup file not found: ${backupFile}`);
        console.error('Available backups:');
        
        const backups = dbManager.listBackups();
        
        if (backups.length === 0) {
          console.error('No backups found');
        } else {
          backups.forEach((b, index) => {
            console.error(`${index + 1}. ${b.fileName} (${formatSize(b.size)}) - ${formatDate(b.createdAt)}`);
          });
        }
        
        process.exit(1);
      }
    }
    
    console.log(`Restoring from: ${backupPath}`);
    console.log(`Overwrite mode: ${overwrite ? 'Yes' : 'No'}`);
    
    // Confirm restore
    console.log('\nWARNING: This will replace your current database and potentially overwrite images.');
    console.log('Make sure you have a backup of your current data if needed.');
    
    const proceed = await confirmRestore();
    
    if (!proceed) {
      console.log('Restore cancelled');
      process.exit(0);
    }
    
    console.log('\nRestoring backup...');
    
    // Restore the backup
    const result = await dbManager.restoreFromBackup(backupPath, { overwrite });
    
    console.log('\nBackup restored successfully:');
    console.log(`- App version: ${result.metadata.appVersion}`);
    console.log(`- Created: ${result.metadata.createdAt}`);
    console.log(`- Includes images: ${result.metadata.includesImages ? 'Yes' : 'No'}`);
    
    // Get storage usage after restore
    const stats = await dbManager.getStorageUsage();
    console.log('\nStorage usage after restore:');
    console.log(`- Database size: ${formatSize(stats.databaseSize)}`);
    console.log(`- Image storage: ${formatSize(stats.totalStorage)}`);
    console.log(`- Total: ${formatSize(stats.totalSize)}`);
    
    console.log('\nRestore completed successfully!');
  } catch (error) {
    console.error('Error restoring backup:', error);
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

// Helper function to format dates
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Helper function to ask for confirmation
function confirmRestore() {
  return new Promise(resolve => {
    process.stdout.write('Do you want to continue? [y/N] ');
    
    process.stdin.once('data', data => {
      const answer = data.toString().trim().toLowerCase();
      resolve(answer === 'y' || answer === 'yes');
    });
  });
}

// Run the restore
restoreBackup();