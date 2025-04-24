import { useState, useEffect } from 'react';
import './StorageManager.css';
import axios from 'axios';

interface StorageStats {
  totalImages: number;
  storageUsed: number;
  storageLimit: number;
  storagePercent: number;
  databaseSize: number;
  imageSize: number;
  fileTypes: { mimeType: string; count: number; totalSize: number }[];
}

interface BackupInfo {
  fileName: string;
  size: number;
  createdAt: string;
  path: string;
}

const StorageManager: React.FC = () => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'storage' | 'backups' | 'maintenance'>('storage');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch storage stats
      const statsResponse = await axios.get('http://localhost:3001/api/stats');
      setStats(statsResponse.data);
      
      // Fetch backups
      const backupsResponse = await axios.get('http://localhost:3001/api/backups');
      setBackups(backupsResponse.data);
    } catch (error) {
      console.error('Error fetching storage data:', error);
      setMessage({
        text: 'Failed to fetch storage information',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackup = async (includeImages: boolean = true) => {
    setIsBackupLoading(true);
    setMessage({
      text: 'Creating backup, please wait...',
      type: 'info'
    });
    
    try {
      const response = await axios.post('http://localhost:3001/api/backup', { includeImages });
      
      setMessage({
        text: 'Backup created successfully',
        type: 'success'
      });
      
      // Refresh backups list
      const backupsResponse = await axios.get('http://localhost:3001/api/backups');
      setBackups(backupsResponse.data);
    } catch (error) {
      console.error('Error creating backup:', error);
      setMessage({
        text: 'Failed to create backup',
        type: 'error'
      });
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleDeleteBackup = async (fileName: string) => {
    if (!window.confirm(`Are you sure you want to delete the backup "${fileName}"?`)) {
      return;
    }
    
    try {
      await axios.delete(`http://localhost:3001/api/backups/${fileName}`);
      
      setMessage({
        text: 'Backup deleted successfully',
        type: 'success'
      });
      
      // Refresh backups list
      const backupsResponse = await axios.get('http://localhost:3001/api/backups');
      setBackups(backupsResponse.data);
    } catch (error) {
      console.error('Error deleting backup:', error);
      setMessage({
        text: 'Failed to delete backup',
        type: 'error'
      });
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setMessage({
      text: 'Optimizing database, this may take a while...',
      type: 'info'
    });
    
    try {
      await axios.post('http://localhost:3001/api/optimize');
      
      setMessage({
        text: 'Database optimized successfully',
        type: 'success'
      });
      
      // Refresh stats
      const statsResponse = await axios.get('http://localhost:3001/api/stats');
      setStats(statsResponse.data);
    } catch (error) {
      console.error('Error optimizing database:', error);
      setMessage({
        text: 'Failed to optimize database',
        type: 'error'
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCleanup = async () => {
    if (!window.confirm('This will delete unused files from the server. Are you sure you want to continue?')) {
      return;
    }
    
    setIsOptimizing(true);
    setMessage({
      text: 'Cleaning up unused files...',
      type: 'info'
    });
    
    try {
      const response = await axios.post('http://localhost:3001/api/cleanup');
      
      setMessage({
        text: `Cleaned up ${response.data.deletedFiles.length} unused files, freed ${formatSize(response.data.totalReclaimed)} of space`,
        type: 'success'
      });
      
      // Refresh stats
      const statsResponse = await axios.get('http://localhost:3001/api/stats');
      setStats(statsResponse.data);
    } catch (error) {
      console.error('Error cleaning up files:', error);
      setMessage({
        text: 'Failed to clean up files',
        type: 'error'
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleUpdateStorageLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const limit = parseInt(newLimit, 10);
    if (isNaN(limit) || limit <= 0) {
      setMessage({
        text: 'Please enter a valid storage limit',
        type: 'error'
      });
      return;
    }
    
    try {
      await axios.post('http://localhost:3001/api/storage-limit', { limit });
      
      setMessage({
        text: 'Storage limit updated successfully',
        type: 'success'
      });
      
      // Refresh stats
      const statsResponse = await axios.get('http://localhost:3001/api/stats');
      setStats(statsResponse.data);
      
      // Clear input
      setNewLimit('');
    } catch (error) {
      console.error('Error updating storage limit:', error);
      setMessage({
        text: 'Failed to update storage limit',
        type: 'error'
      });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="storage-manager">
      <div className="manager-header">
        <h2>Local Storage Manager</h2>
        <p className="subtitle">Manage your local database and storage settings</p>
      </div>
      
      {message && (
        <div className={`message ${message.type}`}>
          <span className="message-text">{message.text}</span>
          <button 
            className="message-close"
            onClick={() => setMessage(null)}
          >
            ×
          </button>
        </div>
      )}
      
      <div className="manager-tabs">
        <button 
          className={`tab-button ${activeTab === 'storage' ? 'active' : ''}`}
          onClick={() => setActiveTab('storage')}
        >
          Storage Usage
        </button>
        <button 
          className={`tab-button ${activeTab === 'backups' ? 'active' : ''}`}
          onClick={() => setActiveTab('backups')}
        >
          Backups
        </button>
        <button 
          className={`tab-button ${activeTab === 'maintenance' ? 'active' : ''}`}
          onClick={() => setActiveTab('maintenance')}
        >
          Maintenance
        </button>
      </div>
      
      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading storage information...</p>
        </div>
      ) : (
        <div className="tab-content">
          {activeTab === 'storage' && stats && (
            <div className="storage-tab">
              <div className="storage-overview">
                <div className="storage-card total-storage">
                  <h3>Total Storage</h3>
                  <div className="storage-value">{formatSize(stats.storageUsed)}</div>
                  <div 
                    className={`storage-bar ${
                      stats.storagePercent > 90 ? 'critical' : 
                      stats.storagePercent > 70 ? 'warning' : ''
                    }`}
                  >
                    <div 
                      className="bar-fill" 
                      style={{ width: `${Math.min(stats.storagePercent, 100)}%` }}
                    ></div>
                  </div>
                  <div className="storage-info">
                    <span>{stats.storagePercent}% of {formatSize(stats.storageLimit)}</span>
                    <span>{stats.totalImages} images</span>
                  </div>
                </div>
                
                <div className="storage-breakdown">
                  <div className="storage-card">
                    <h3>Image Storage</h3>
                    <div className="storage-value">{formatSize(stats.imageSize)}</div>
                    <div className="percentage">
                      {Math.round((stats.imageSize / stats.storageUsed) * 100)}% of total
                    </div>
                  </div>
                  
                  <div className="storage-card">
                    <h3>Database Size</h3>
                    <div className="storage-value">{formatSize(stats.databaseSize)}</div>
                    <div className="percentage">
                      {Math.round((stats.databaseSize / stats.storageUsed) * 100)}% of total
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="storage-details">
                <div className="storage-card file-types">
                  <h3>File Types</h3>
                  <div className="file-types-list">
                    {stats.fileTypes.map((type, index) => (
                      <div key={index} className="file-type-item">
                        <div className="file-type-name">{type.mimeType.split('/')[1].toUpperCase()}</div>
                        <div className="file-type-bar">
                          <div 
                            className="bar-fill"
                            style={{ 
                              width: `${Math.round((type.totalSize / stats.imageSize) * 100)}%`,
                              backgroundColor: `hsl(${index * 50}, 70%, 50%)`
                            }}
                          ></div>
                        </div>
                        <div className="file-type-info">
                          <span>{type.count} files</span>
                          <span>{formatSize(type.totalSize)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="storage-card storage-limit">
                  <h3>Update Storage Limit</h3>
                  <form onSubmit={handleUpdateStorageLimit} className="storage-limit-form">
                    <div className="input-group">
                      <label htmlFor="storageLimit">New Limit (bytes):</label>
                      <input 
                        type="number" 
                        id="storageLimit"
                        value={newLimit}
                        onChange={(e) => setNewLimit(e.target.value)}
                        placeholder="Enter new limit in bytes"
                        min="1"
                        step="1"
                        required
                      />
                      <div className="helper-text">
                        Examples: 1GB = 1073741824, 500MB = 524288000
                      </div>
                    </div>
                    <button type="submit" className="update-button">Update Limit</button>
                  </form>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'backups' && (
            <div className="backups-tab">
              <div className="backup-controls">
                <h3>Create New Backup</h3>
                <div className="backup-actions">
                  <button 
                    className="backup-button"
                    onClick={() => handleBackup(true)}
                    disabled={isBackupLoading}
                  >
                    {isBackupLoading ? 'Creating...' : 'Backup (with images)'}
                  </button>
                  <button 
                    className="backup-button light"
                    onClick={() => handleBackup(false)}
                    disabled={isBackupLoading}
                  >
                    {isBackupLoading ? 'Creating...' : 'Backup (database only)'}
                  </button>
                </div>
                <p className="backup-tip">
                  Database-only backups are smaller but don't include your image files.
                </p>
              </div>
              
              <div className="backups-list">
                <h3>Available Backups</h3>
                {backups.length === 0 ? (
                  <div className="no-backups">
                    <p>No backups available. Create your first backup to protect your data.</p>
                  </div>
                ) : (
                  <div className="backup-items">
                    {backups.map((backup, index) => (
                      <div 
                        key={index} 
                        className={`backup-item ${selectedBackup === backup.fileName ? 'selected' : ''}`}
                        onClick={() => setSelectedBackup(
                          selectedBackup === backup.fileName ? null : backup.fileName
                        )}
                      >
                        <div className="backup-item-header">
                          <div className="backup-name">{backup.fileName}</div>
                          <div className="backup-size">{formatSize(backup.size)}</div>
                        </div>
                        <div className="backup-date">
                          Created: {formatDate(backup.createdAt)}
                        </div>
                        
                        {selectedBackup === backup.fileName && (
                          <div className="backup-actions">
                            <a 
                              href={`http://localhost:3001/backups/${backup.fileName}`}
                              download
                              className="download-button"
                            >
                              Download
                            </a>
                            <button
                              className="delete-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBackup(backup.fileName);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'maintenance' && (
            <div className="maintenance-tab">
              <div className="maintenance-card">
                <h3>Database Optimization</h3>
                <p>
                  Optimize your database to reduce its size and improve performance.
                  This operation rebuilds the database file, reclaiming space from deleted records.
                </p>
                <button 
                  className="maintenance-button"
                  onClick={handleOptimize}
                  disabled={isOptimizing}
                >
                  {isOptimizing ? 'Optimizing...' : 'Optimize Database'}
                </button>
              </div>
              
              <div className="maintenance-card">
                <h3>Cleanup Unused Files</h3>
                <p>
                  Remove orphaned files that are no longer referenced in the database.
                  This can help reclaim storage space from deleted images.
                </p>
                <button 
                  className="maintenance-button"
                  onClick={handleCleanup}
                  disabled={isOptimizing}
                >
                  {isOptimizing ? 'Cleaning...' : 'Cleanup Files'}
                </button>
              </div>
              
              <div className="maintenance-card">
                <h3>Privacy Settings</h3>
                <p>
                  This application stores all data locally on your device. No data is sent to external servers
                  except when using the Gemini API for image analysis.
                </p>
                <div className="privacy-features">
                  <div className="privacy-feature">
                    <span className="feature-icon">🔒</span>
                    <span className="feature-text">Local SQLite database</span>
                  </div>
                  <div className="privacy-feature">
                    <span className="feature-icon">🖼️</span>
                    <span className="feature-text">Images stored locally</span>
                  </div>
                  <div className="privacy-feature">
                    <span className="feature-icon">🔄</span>
                    <span className="feature-text">Export/import capability</span>
                  </div>
                  <div className="privacy-feature">
                    <span className="feature-icon">🧹</span>
                    <span className="feature-text">Data cleanup tools</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StorageManager;