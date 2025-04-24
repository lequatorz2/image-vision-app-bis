import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './DashboardPage.css';
import HexagonalGrid from '../components/HexagonalGrid';
import OrbitingCategories from '../components/OrbitingCategories';
import { Image } from '../types';

interface DashboardProps {
  images: Image[];
}

interface Statistic {
  name: string;
  value: number | string;
  icon: string;
}

const DashboardPage: React.FC<DashboardProps> = ({ images }) => {
  const [stats, setStats] = useState<Statistic[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/stats');
        const data = await response.json();
        
        const statsArray: Statistic[] = [
          { name: 'Total Images', value: data.totalImages || images.length, icon: '🖼️' },
          { name: 'Categories', value: data.uniqueCategories || calculateUniqueCategories(), icon: '🏷️' },
          { name: 'Storage Used', value: formatStorageSize(data.storageUsed || 0), icon: '💾' },
          { name: 'People Detected', value: data.totalPeople || calculateTotalPeople(), icon: '👥' },
        ];
        
        setStats(statsArray);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching stats:', error);
        
        // Fallback to calculated stats if API fails
        const statsArray: Statistic[] = [
          { name: 'Total Images', value: images.length, icon: '🖼️' },
          { name: 'Categories', value: calculateUniqueCategories(), icon: '🏷️' },
          { name: 'Storage Used', value: formatStorageSize(0), icon: '💾' },
          { name: 'People Detected', value: calculateTotalPeople(), icon: '👥' },
        ];
        
        setStats(statsArray);
        setIsLoading(false);
      }
    };
    
    fetchStats();
  }, [images]);

  const calculateUniqueCategories = (): number => {
    const categories = new Set<string>();
    
    images.forEach(image => {
      if (image.metadata.medium) categories.add(image.metadata.medium);
      if (image.metadata.style) categories.add(image.metadata.style);
      if (image.metadata.environment) categories.add(image.metadata.environment);
      if (image.metadata.mood) categories.add(image.metadata.mood);
    });
    
    return categories.size;
  };

  const calculateTotalPeople = (): number => {
    return images.reduce((sum, image) => {
      return sum + (image.metadata.people?.number || 0);
    }, 0);
  };

  const formatStorageSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Cosmic Image Gallery</h1>
        <p className="subtitle">Your personal AI-powered image collection</p>
      </div>
      
      <div className="stats-container">
        {stats.map((stat, index) => (
          <div 
            key={stat.name} 
            className="stat-card"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-name">{stat.name}</div>
          </div>
        ))}
      </div>
      
      {images.length > 0 ? (
        <>
          <div className="categories-section">
            <h2>Explore Categories</h2>
            <OrbitingCategories 
              images={images} 
              onCategorySelect={handleCategorySelect} 
            />
          </div>
          
          <div className="images-section">
            <div className="section-header">
              <h2>{selectedCategory || 'All Images'}</h2>
              <Link to="/search" className="view-all-link">
                Advanced Search
              </Link>
            </div>
            <HexagonalGrid 
              images={images} 
              category={selectedCategory} 
            />
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🌌</div>
          <h2>Your Cosmic Collection is Empty</h2>
          <p>Upload some images to start exploring the universe of your collection</p>
          <Link to="/upload" className="upload-button">
            Start Uploading
          </Link>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;