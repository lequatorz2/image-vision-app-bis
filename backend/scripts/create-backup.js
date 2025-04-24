/**
 * Database backup script
 * Run with: npm run backup
 * 
 * Options:
 * --no-images: Don't include image files in the backup (smaller file size)
 * --output=path/to/file.zip: Specify custom output path
 */

const dbManager = require('../db-manager');
const path = require('path');
const fs = require('fs');

async function createBackup() {
  console.log('Starting database backup...');
  
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const includeImages = !args.includes('--no-images');
    
    // Find custom output path if specified
    let customOutput = null;
    for (const arg of args) {
      if (arg.startsWith('--output=')) {
        customOutput = arg.split('=')[1];
        break;
      }
    }
    
    console.log(`Including images in backup: ${includeImages ? 'Yes' : 'No'}`);
    
    // Create the backup
    const backup = await dbManager.createBackup(includeImages);
    
    // If custom output path is specified, move the backup file
    if (customOutput) {
      const customOutputDir = path.dirname(customOutput);
      if (!fs.existsSync(customOutputDir)) {
        fs.mkdirSync(customOutputDir, { recursive: true });
      }
      
      fs.copyFileSync(backup.backupPath, customOutput);
      fs.unlinkSync(backup.backupPath); // Remove the original
      backup.backupPath = customOutput;
      backup.fileName = path.basename(customOutput);
    }
    
    console.log('\nBackup created successfully:');
    console.log(`- File: ${backup.backupPath}`);
    console.log(`- Size: ${formatSize(backup.size)}`);
    console.log(`- Created: ${backup.timestamp}`);
    
    // List all available backups
    console.log('\nAvailable backups:');
    const backups = dbManager.listBackups();
    
    backups.forEach((b, index) => {
      console.log(`${index + 1}. ${b.fileName} (${formatSize(b.size)}) - ${formatDate(b.createdAt)}`);
    });
    
    console.log('\nRestore command:');
    console.log(`npm run restore -- --file="${backup.fileName}"`);
  } catch (error) {
    console.error('Error creating backup:', error);
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

// Run the backup
createBackup();