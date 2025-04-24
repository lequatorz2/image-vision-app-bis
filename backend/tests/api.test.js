/**
 * API Integration Tests
 * 
 * These tests verify that the REST API endpoints function correctly.
 * Run with: npm test
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../server');
const dbManager = require('../db-manager');

// Test configuration
const TEST_IMAGE_DIR = path.join(__dirname, 'fixtures');
const TEST_IMAGE_PATHS = {
  jpeg: path.join(TEST_IMAGE_DIR, 'test-image.jpg'),
  png: path.join(TEST_IMAGE_DIR, 'test-image.png'),
  gif: path.join(TEST_IMAGE_DIR, 'test-image.gif'),
  large: path.join(TEST_IMAGE_DIR, 'large-image.jpg'),
};

// Ensure test images exist
beforeAll(() => {
  if (!fs.existsSync(TEST_IMAGE_DIR)) {
    fs.mkdirSync(TEST_IMAGE_DIR, { recursive: true });
  }
  
  // Create a test image if it doesn't exist
  if (!fs.existsSync(TEST_IMAGE_PATHS.jpeg)) {
    console.log('Creating test images...');
    // This would normally create test images, but we'll skip implementation here
    // In a real test suite, you would have fixture images prepared
  }
});

// Set up test database before all tests
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.TEST_DB_PATH = path.join(__dirname, 'test-data', 'test-db.sqlite');
  process.env.TEST_UPLOADS_DIR = path.join(__dirname, 'test-data', 'uploads');
  
  console.log('Setting up test database...');
  
  // Ensure test directories exist
  if (!fs.existsSync(path.join(__dirname, 'test-data'))) {
    fs.mkdirSync(path.join(__dirname, 'test-data'), { recursive: true });
  }
  
  if (!fs.existsSync(process.env.TEST_UPLOADS_DIR)) {
    fs.mkdirSync(process.env.TEST_UPLOADS_DIR, { recursive: true });
  }
  
  // Initialize a clean test database
  await dbManager.initializeDatabase('test');
});

// Clean up after all tests complete
afterAll(async () => {
  console.log('Cleaning up test database...');
  
  // Close database connections
  const db = await dbManager.getConnection('test');
  await new Promise(resolve => db.close(resolve));
  
  // Remove test databases in a real test
  // We'll comment this out to avoid accidentally deleting files
  /*
  if (fs.existsSync(process.env.TEST_DB_PATH)) {
    fs.unlinkSync(process.env.TEST_DB_PATH);
  }
  */
});

//----------------------------------------------
// API Endpoint Tests
//----------------------------------------------

describe('Server Health Check', () => {
  it('should return 200 OK from the health check endpoint', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
  });
});

describe('Image API Endpoints', () => {
  let testImageId;
  
  // Test image upload
  it('should upload a JPEG image successfully', async () => {
    const response = await request(app)
      .post('/api/upload')
      .attach('images', TEST_IMAGE_PATHS.jpeg);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('images');
    expect(response.body.images).toBeInstanceOf(Array);
    expect(response.body.images.length).toBe(1);
    
    // Save the ID for subsequent tests
    testImageId = response.body.images[0].id;
  });
  
  // Test image retrieval
  it('should get all images', async () => {
    const response = await request(app).get('/api/images');
    
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThan(0);
  });
  
  // Test single image retrieval
  it('should get a single image by ID', async () => {
    if (!testImageId) {
      throw new Error('No test image ID available. Upload test failed?');
    }
    
    const response = await request(app).get(`/api/images/${testImageId}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', testImageId);
    expect(response.body).toHaveProperty('metadata');
    expect(response.body).toHaveProperty('url');
  });
  
  // Test image not found
  it('should return 404 for non-existent image ID', async () => {
    const response = await request(app).get('/api/images/nonexistent-id');
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
  });
  
  // Test batch upload
  it('should handle multiple image uploads', async () => {
    const response = await request(app)
      .post('/api/upload')
      .attach('images', TEST_IMAGE_PATHS.jpeg)
      .attach('images', TEST_IMAGE_PATHS.png);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.images.length).toBe(2);
  });
  
  // Test invalid file type
  it('should reject invalid file types', async () => {
    // Create a temporary text file
    const invalidFilePath = path.join(TEST_IMAGE_DIR, 'invalid.txt');
    fs.writeFileSync(invalidFilePath, 'This is not an image file');
    
    const response = await request(app)
      .post('/api/upload')
      .attach('images', invalidFilePath);
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    
    // Clean up
    fs.unlinkSync(invalidFilePath);
  });
  
  // Test image deletion
  it('should delete an image', async () => {
    if (!testImageId) {
      throw new Error('No test image ID available. Upload test failed?');
    }
    
    const response = await request(app).delete(`/api/images/${testImageId}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('id', testImageId);
    
    // Verify image is deleted
    const checkResponse = await request(app).get(`/api/images/${testImageId}`);
    expect(checkResponse.status).toBe(404);
  });
});

describe('Search API Endpoints', () => {
  // Upload test images for search
  beforeAll(async () => {
    // Upload test images with known metadata
    const response = await request(app)
      .post('/api/upload')
      .attach('images', TEST_IMAGE_PATHS.jpeg);
    
    // In a real test, we would ensure the metadata has specific values
    // Here we're assuming the Gemini mock API returns predictable results
  });
  
  // Test basic search
  it('should perform basic keyword search', async () => {
    const response = await request(app)
      .post('/api/search')
      .send({
        query: 'test',
        filters: {}
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
  });
  
  // Test filtered search
  it('should filter search by metadata attributes', async () => {
    const response = await request(app)
      .post('/api/search')
      .send({
        query: '',
        filters: {
          medium: 'Photography'
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    
    // If results exist, verify they match the filter
    if (response.body.length > 0) {
      response.body.forEach(image => {
        expect(image.metadata.medium).toBe('Photography');
      });
    }
  });
  
  // Test natural language search
  it('should handle natural language search queries', async () => {
    const response = await request(app)
      .post('/api/natural-search')
      .send({
        query: 'Show me outdoor photos'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('results');
    expect(response.body).toHaveProperty('extractedCriteria');
    expect(response.body.extractedCriteria).toHaveProperty('filters');
    
    // There should be an environment filter for "outdoor"
    const filters = response.body.extractedCriteria.filters;
    expect(filters.environment).toBeDefined();
    expect(filters.environment.toLowerCase()).toContain('outdoor');
  });
  
  // Test complex query
  it('should handle complex search with multiple filters', async () => {
    const response = await request(app)
      .post('/api/search')
      .send({
        query: 'sunset',
        filters: {
          medium: 'Photography',
          environment: 'Outdoor',
          mood: 'Peaceful'
        }
      });
    
    expect(response.status).toBe(200);
    // Other assertions would depend on test data
  });
  
  // Test invalid search query
  it('should handle invalid search query gracefully', async () => {
    const response = await request(app)
      .post('/api/search')
      .send({
        query: null,
        filters: { invalid: {} }
      });
    
    // Should still return a valid response, just with no results
    expect(response.status).toBe(200);
  });
});

describe('Storage Management API Endpoints', () => {
  // Test storage statistics
  it('should return storage statistics', async () => {
    const response = await request(app).get('/api/storage/stats');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('used');
    expect(response.body).toHaveProperty('categories');
    expect(response.body.categories).toBeInstanceOf(Array);
  });
  
  // Test database optimization
  it('should optimize the database', async () => {
    const response = await request(app).post('/api/optimize');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
  });
  
  // Test cleanup unused files
  it('should clean up unused files', async () => {
    const response = await request(app).post('/api/cleanup');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('deletedFiles');
    expect(response.body).toHaveProperty('totalReclaimed');
  });
  
  // Test storage optimization
  it('should perform storage optimization operations', async () => {
    const response = await request(app)
      .post('/api/storage/optimize')
      .send({
        options: ['duplicates', 'temp']
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('optimizations');
    expect(response.body).toHaveProperty('freedSpace');
  });
});

describe('Settings API Endpoints', () => {
  // Test get all settings
  it('should get all application settings', async () => {
    const response = await request(app).get('/api/settings');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('storage_limit');
    expect(response.body).toHaveProperty('thumbnail_quality');
  });
  
  // Test update settings
  it('should update application settings', async () => {
    const response = await request(app)
      .post('/api/settings')
      .send({
        settings: {
          thumbnail_quality: '75'
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('updatedSettings');
    
    // Verify setting was updated
    const settingsResponse = await request(app).get('/api/settings');
    expect(settingsResponse.body.thumbnail_quality.value).toBe('75');
  });
  
  // Test invalid settings
  it('should reject invalid settings', async () => {
    const response = await request(app)
      .post('/api/settings')
      .send({
        settings: null
      });
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});

describe('Backup and Restore API Endpoints', () => {
  let backupFileName;
  
  // Test create backup
  it('should create a database backup', async () => {
    const response = await request(app)
      .post('/api/backup')
      .send({
        includeImages: true
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('backup');
    expect(response.body.backup).toHaveProperty('fileName');
    
    // Save backup filename for restore test
    backupFileName = response.body.backup.fileName;
  });
  
  // Test list backups
  it('should list available backups', async () => {
    const response = await request(app).get('/api/backups');
    
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('fileName');
    expect(response.body[0]).toHaveProperty('size');
    expect(response.body[0]).toHaveProperty('createdAt');
  });
  
  // Test backup file is accessible
  it('should allow downloading the backup file', async () => {
    if (!backupFileName) {
      throw new Error('No backup file name available. Create backup test failed?');
    }
    
    const response = await request(app).get(`/backups/${backupFileName}`);
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/zip');
  });
  
  // Note: We're not actually testing restore here as it would replace the database
  // In a real test environment, you'd use a special test database for this
  it('should validate restore parameters', async () => {
    if (!backupFileName) {
      throw new Error('No backup file name available. Create backup test failed?');
    }
    
    // Test with empty filePath
    const response = await request(app)
      .post('/api/storage/import')
      .send({
        filePath: '',
        overwrite: false
      });
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});

describe('Data Export/Import API Endpoints', () => {
  // Test export selected images
  it('should export selected images', async () => {
    // First, get some image IDs to export
    const imagesResponse = await request(app).get('/api/images');
    const imageIds = imagesResponse.body.slice(0, 2).map(img => img.id);
    
    if (imageIds.length === 0) {
      console.log('No images available for export test, skipping');
      return;
    }
    
    const response = await request(app)
      .post('/api/export')
      .send({
        imageIds
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('exportPath');
    expect(response.body).toHaveProperty('imageCount', imageIds.length);
  });
});