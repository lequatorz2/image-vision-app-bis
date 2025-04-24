import { useState, useEffect } from 'react';
import './OrbitingCategories.css';
import { Image } from '../types';

interface Category {
  id: string;
  name: string;
  count: number;
}

interface OrbitingCategoriesProps {
  images: Image[];
  onCategorySelect: (category: string | null) => void;
}

const OrbitingCategories: React.FC<OrbitingCategoriesProps> = ({ images, onCategorySelect }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [orbitSpeed, setOrbitSpeed] = useState<number>(5000); // milliseconds per rotation

  useEffect(() => {
    if (images.length > 0) {
      // Extract all unique categories from images metadata
      const categoryMap = new Map<string, number>();
      
      images.forEach(image => {
        const metadata = image.metadata;
        
        // Add medium
        if (metadata.medium) {
          const count = categoryMap.get(metadata.medium) || 0;
          categoryMap.set(metadata.medium, count + 1);
        }
        
        // Add style
        if (metadata.style) {
          const count = categoryMap.get(metadata.style) || 0;
          categoryMap.set(metadata.style, count + 1);
        }
        
        // Add environment
        if (metadata.environment) {
          const count = categoryMap.get(metadata.environment) || 0;
          categoryMap.set(metadata.environment, count + 1);
        }
        
        // Add mood
        if (metadata.mood) {
          const count = categoryMap.get(metadata.mood) || 0;
          categoryMap.set(metadata.mood, count + 1);
        }
      });
      
      // Convert to array and sort by count (descending)
      const categoriesArray = Array.from(categoryMap).map(([name, count]) => ({
        id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name,
        count
      }));
      
      // Sort by count, take top 12
      categoriesArray.sort((a, b) => b.count - a.count);
      setCategories(categoriesArray.slice(0, 12));
      
      // Adjust orbit speed based on number of categories
      const categoryCount = Math.min(12, categoriesArray.length);
      setOrbitSpeed(categoryCount * 600); // Faster with fewer categories
    }
  }, [images]);

  const handleCategoryClick = (categoryId: string) => {
    if (activeCategory === categoryId) {
      // If clicking already active category, deselect it
      setActiveCategory(null);
      onCategorySelect(null);
    } else {
      // Select new category
      setActiveCategory(categoryId);
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        onCategorySelect(category.name);
      }
    }
  };

  return (
    <div className="orbiting-categories-container">
      <div className="orbit-center">
        <div className="center-text">{activeCategory ? categories.find(c => c.id === activeCategory)?.name : 'Categories'}</div>
      </div>
      
      <div 
        className={`orbit-ring ${activeCategory ? 'has-active' : ''}`}
        style={{ '--orbit-duration': `${orbitSpeed}ms` } as React.CSSProperties}
      >
        {categories.map((category, index) => {
          const angle = (360 / categories.length) * index;
          const isActive = activeCategory === category.id;
          
          return (
            <div
              key={category.id}
              className={`orbit-item ${isActive ? 'active' : ''}`}
              style={{ 
                '--angle': angle,
                '--delay': `${index * 0.1}s`
              } as React.CSSProperties}
              onClick={() => handleCategoryClick(category.id)}
            >
              <div className="orbit-item-content">
                <span className="orbit-item-name">{category.name}</span>
                <span className="orbit-item-count">{category.count}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrbitingCategories;