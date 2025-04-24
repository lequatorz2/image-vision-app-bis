import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './HexagonalGrid.css';
import { Image } from '../types';

interface HexagonalGridProps {
  images: Image[];
  category?: string;
}

const HexagonalGrid: React.FC<HexagonalGridProps> = ({ images, category }) => {
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement>(null);
  const [activeHex, setActiveHex] = useState<number | null>(null);
  const [filteredImages, setFilteredImages] = useState<Image[]>([]);

  useEffect(() => {
    // Filter images if category is provided
    if (category) {
      const filtered = images.filter(image => {
        // Check if the image has this category in its metadata
        const metadata = image.metadata;
        return (
          metadata.medium?.toLowerCase().includes(category.toLowerCase()) ||
          metadata.style?.toLowerCase().includes(category.toLowerCase()) ||
          metadata.mood?.toLowerCase().includes(category.toLowerCase()) ||
          metadata.environment?.toLowerCase().includes(category.toLowerCase())
        );
      });
      setFilteredImages(filtered);
    } else {
      setFilteredImages(images);
    }
  }, [images, category]);

  const handleHexClick = (index: number, image: Image) => {
    setActiveHex(index);
    // Navigate to image details page after a small delay for animation
    setTimeout(() => {
      navigate(`/image/${image.id}`);
    }, 500);
  };

  return (
    <div className="hexagonal-grid-container">
      <div className="hexagonal-grid" ref={gridRef}>
        {filteredImages.map((image, index) => {
          // Determine row and column position for honeycomb layout
          const row = Math.floor(index / 5);
          const col = index % 5;
          const isEvenRow = row % 2 === 0;
          
          // Calculate offset for even rows to create honeycomb pattern
          const xOffset = isEvenRow ? 0 : 50;
          
          return (
            <div
              key={image.id}
              className={`hexagon ${activeHex === index ? 'active' : ''}`}
              style={{
                transform: `translate(${col * 100 + xOffset}px, ${row * 87}px)`,
                transition: `all 0.5s cubic-bezier(0.23, 1, 0.32, 1) ${index * 0.05}s`
              }}
              onClick={() => handleHexClick(index, image)}
            >
              <div className="hexagon-content">
                <div 
                  className="hexagon-image" 
                  style={{ backgroundImage: `url(${image.thumbnailUrl || image.url})` }}
                />
                <div className="hexagon-overlay">
                  <div className="hexagon-metadata">
                    <div className="metadata-category">{image.metadata.medium}</div>
                    <div className="metadata-title">{image.metadata.scene.substring(0, 20)}...</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {filteredImages.length === 0 && (
        <div className="no-images-message">
          <div className="message-icon">🖼️</div>
          <h3>No Images Found</h3>
          <p>{category ? `No images matching "${category}" category were found.` : 'Your collection is empty. Upload some images to get started!'}</p>
        </div>
      )}
    </div>
  );
};

export default HexagonalGrid;