import { useState, useEffect } from 'react';
import './DatabaseStats.css';
import axios from 'axios';

interface StatsData {
  totalImages: number;
  privateImages: number;
  storageUsed: number;
  databaseSize: number;
  imageSize: number;
  fileTypes: { mimeType: string; count: number; totalSize: number }[];
  topStyles?: { value: string; count: number }[];
  topEnvironments?: { value: string; count: number }[];
  topMoods?: { value: string; count: number }[];
  topColors?: { value: string; count: number }[];
}

const DatabaseStats: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'metadata'>('overview');
  const [activeMetadataType, setActiveMetadataType] = useState<'styles' | 'environments' | 'moods' | 'colors'>('styles');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('http://localhost:3001/api/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching database stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="error-message">
        <h3>Error Loading Stats</h3>
        <p>Could not load database statistics. Please try again later.</p>
        <button onClick={fetchStats} className="retry-button">Retry</button>
      </div>
    );
  }

  // Get metadata arrays for visualization
  const metadataMap = {
    styles: stats.topStyles || [],
    environments: stats.topEnvironments || [],
    moods: stats.topMoods || [],
    colors: stats.topColors || []
  };

  // Calculate max count for the active metadata type
  const activeMetadata = metadataMap[activeMetadataType];
  const maxCount = activeMetadata.length > 0 
    ? Math.max(...activeMetadata.map(item => item.count)) 
    : 0;

  return (
    <div className="database-stats">
      <div className="stats-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Database Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'metadata' ? 'active' : ''}`}
          onClick={() => setActiveTab('metadata')}
        >
          Metadata Statistics
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="stats-overview">
          <div className="stats-cards">
            <div className="stats-card">
              <div className="card-icon">🖼️</div>
              <div className="card-content">
                <div className="card-value">{stats.totalImages}</div>
                <div className="card-label">Total Images</div>
              </div>
            </div>
            
            <div className="stats-card">
              <div className="card-icon">🔒</div>
              <div className="card-content">
                <div className="card-value">{stats.privateImages}</div>
                <div className="card-label">Private Images</div>
              </div>
            </div>
            
            <div className="stats-card">
              <div className="card-icon">💾</div>
              <div className="card-content">
                <div className="card-value">{formatSize(stats.storageUsed)}</div>
                <div className="card-label">Total Storage</div>
              </div>
            </div>
            
            <div className="stats-card">
              <div className="card-icon">📊</div>
              <div className="card-content">
                <div className="card-value">{formatSize(stats.databaseSize)}</div>
                <div className="card-label">Database Size</div>
              </div>
            </div>
          </div>
          
          <div className="file-type-breakdown">
            <h3>File Types</h3>
            <div className="file-types-grid">
              {stats.fileTypes.map((type, index) => (
                <div key={index} className="file-type-card">
                  <div className="file-type-header">
                    <div className="file-type-icon" style={{ 
                      backgroundColor: `hsl(${index * 50}, 70%, 50%)` 
                    }}>
                      {type.mimeType.split('/')[1].substring(0, 3).toUpperCase()}
                    </div>
                    <div className="file-type-info">
                      <div className="file-type-name">{type.mimeType.split('/')[1]}</div>
                      <div className="file-type-count">{type.count} files</div>
                    </div>
                  </div>
                  <div className="file-type-size">{formatSize(type.totalSize)}</div>
                  <div className="file-type-bar">
                    <div 
                      className="bar-fill"
                      style={{ width: `${Math.round((type.totalSize / stats.imageSize) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="database-health">
            <h3>Database Health</h3>
            <p>
              Your database is {stats.databaseSize > 50 * 1024 * 1024 ? 'quite large' : 'in good shape'}.
              {stats.databaseSize > 50 * 1024 * 1024 && ' Consider optimizing it for better performance.'}
            </p>
            <div className="health-metrics">
              <div className="health-metric">
                <div className="metric-label">Database/Storage Ratio</div>
                <div className="metric-value">
                  {((stats.databaseSize / stats.storageUsed) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="health-metric">
                <div className="metric-label">Avg. Size per Image</div>
                <div className="metric-value">
                  {stats.totalImages > 0 
                    ? formatSize(stats.imageSize / stats.totalImages) 
                    : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'metadata' && (
        <div className="metadata-stats">
          <div className="metadata-tabs">
            <button 
              className={`metadata-tab ${activeMetadataType === 'styles' ? 'active' : ''}`}
              onClick={() => setActiveMetadataType('styles')}
            >
              Styles
            </button>
            <button 
              className={`metadata-tab ${activeMetadataType === 'environments' ? 'active' : ''}`}
              onClick={() => setActiveMetadataType('environments')}
            >
              Environments
            </button>
            <button 
              className={`metadata-tab ${activeMetadataType === 'moods' ? 'active' : ''}`}
              onClick={() => setActiveMetadataType('moods')}
            >
              Moods
            </button>
            <button 
              className={`metadata-tab ${activeMetadataType === 'colors' ? 'active' : ''}`}
              onClick={() => setActiveMetadataType('colors')}
            >
              Colors
            </button>
          </div>
          
          <div className="metadata-chart">
            <h3>{activeMetadataType.charAt(0).toUpperCase() + activeMetadataType.slice(1)} Distribution</h3>
            {activeMetadata.length === 0 ? (
              <div className="no-data-message">
                <p>No {activeMetadataType} data available.</p>
              </div>
            ) : (
              <div className="horizontal-bar-chart">
                {activeMetadata.map((item, index) => (
                  <div key={index} className="chart-item">
                    <div className="item-label">{item.value}</div>
                    <div className="item-bar-container">
                      <div 
                        className="item-bar" 
                        style={{ 
                          width: `${(item.count / maxCount) * 100}%`,
                          backgroundColor: `hsl(${index * 30}, 70%, 50%)`
                        }}
                      ></div>
                      <span className="item-count">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="metadata-insights">
            <h3>Metadata Insights</h3>
            <div className="insights-grid">
              <div className="insight-card">
                <h4>Most Common {activeMetadataType === 'styles' ? 'Style' : 
                   activeMetadataType === 'environments' ? 'Environment' : 
                   activeMetadataType === 'moods' ? 'Mood' : 'Color'}</h4>
                <div className="insight-value">
                  {activeMetadata.length > 0 ? activeMetadata[0].value : 'N/A'}
                </div>
                <div className="insight-description">
                  {activeMetadata.length > 0 ? (
                    `Found in ${activeMetadata[0].count} images (${((activeMetadata[0].count / stats.totalImages) * 100).toFixed(1)}% of collection)`
                  ) : 'No data available'}
                </div>
              </div>
              
              <div className="insight-card">
                <h4>Unique {activeMetadataType.charAt(0).toUpperCase() + activeMetadataType.slice(1)}</h4>
                <div className="insight-value">
                  {activeMetadata.length}
                </div>
                <div className="insight-description">
                  {activeMetadata.length > 0 ? (
                    `Your collection has ${activeMetadata.length} different ${activeMetadataType}`
                  ) : 'No data available'}
                </div>
              </div>
              
              <div className="insight-card">
                <h4>Top 3 Distribution</h4>
                <div className="top-distribution">
                  {activeMetadata.slice(0, 3).map((item, index) => (
                    <div key={index} className="distribution-item">
                      <span className="item-name">{item.value}</span>
                      <span className="item-percent">
                        {((item.count / stats.totalImages) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseStats;