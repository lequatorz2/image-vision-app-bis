import { useState, useEffect } from 'react';
import './MetadataVisualizer.css';
import { Image } from '../types';

interface MetadataVisualizerProps {
  images: Image[];
}

interface MetadataCount {
  value: string;
  count: number;
  percentage: number;
}

type MetadataField = 'medium' | 'style' | 'mood' | 'environment' | 'colors';

const MetadataVisualizer: React.FC<MetadataVisualizerProps> = ({ images }) => {
  const [activeTab, setActiveTab] = useState<MetadataField>('medium');
  const [metadataCounts, setMetadataCounts] = useState<Record<MetadataField, MetadataCount[]>>({
    medium: [],
    style: [],
    mood: [],
    environment: [],
    colors: []
  });

  useEffect(() => {
    if (images.length > 0) {
      calculateMetadataCounts();
    }
  }, [images]);

  const calculateMetadataCounts = () => {
    // Helper function to count occurrences
    const countMetadata = (field: MetadataField) => {
      const counts: Record<string, number> = {};
      
      images.forEach(image => {
        let values: string[] = [];
        
        if (field === 'colors' && image.metadata.colors) {
          // Colors field is an array
          values = image.metadata.colors;
        } else if (field !== 'colors' && image.metadata[field]) {
          // Other fields are strings
          values = [image.metadata[field] as string];
        }
        
        values.forEach(value => {
          if (value) {
            counts[value] = (counts[value] || 0) + 1;
          }
        });
      });
      
      // Convert to array and calculate percentages
      const countsArray = Object.entries(counts).map(([value, count]) => ({
        value,
        count,
        percentage: (count / images.length) * 100
      }));
      
      // Sort by count (descending)
      return countsArray.sort((a, b) => b.count - a.count);
    };
    
    // Calculate counts for each metadata field
    const newCounts = {
      medium: countMetadata('medium'),
      style: countMetadata('style'),
      mood: countMetadata('mood'),
      environment: countMetadata('environment'),
      colors: countMetadata('colors')
    };
    
    setMetadataCounts(newCounts);
  };

  const getTabLabel = (field: MetadataField): string => {
    switch (field) {
      case 'medium': return 'Medium';
      case 'style': return 'Style';
      case 'mood': return 'Mood';
      case 'environment': return 'Environment';
      case 'colors': return 'Colors';
    }
  };

  const getTabIcon = (field: MetadataField): string => {
    switch (field) {
      case 'medium': return '🎨';
      case 'style': return '🖌️';
      case 'mood': return '😊';
      case 'environment': return '🌍';
      case 'colors': return '🎨';
    }
  };

  return (
    <div className="metadata-visualizer">
      <div className="visualizer-header">
        <h2>Search Results Analysis</h2>
        <p>Explore the distribution of metadata in your search results</p>
      </div>
      
      <div className="visualizer-tabs">
        {Object.keys(metadataCounts).map((field) => (
          <button
            key={field}
            className={`visualizer-tab ${activeTab === field ? 'active' : ''}`}
            onClick={() => setActiveTab(field as MetadataField)}
          >
            <span className="tab-icon">{getTabIcon(field as MetadataField)}</span>
            <span className="tab-label">{getTabLabel(field as MetadataField)}</span>
          </button>
        ))}
      </div>
      
      <div className="visualizer-content">
        {metadataCounts[activeTab].length > 0 ? (
          <div className="bar-chart">
            {metadataCounts[activeTab].slice(0, 8).map((item, index) => (
              <div key={index} className="chart-item">
                <div className="value-label">
                  <span className="value-text">{item.value}</span>
                  <span className="value-count">{item.count}</span>
                </div>
                <div className="bar-container">
                  <div 
                    className="bar" 
                    style={{ width: `${Math.max(item.percentage, 3)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-data-message">
            <p>No {getTabLabel(activeTab).toLowerCase()} data available in the current results.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetadataVisualizer;