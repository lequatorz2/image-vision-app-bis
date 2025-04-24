import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import CircularImageViewer from '../components/CircularImageViewer';
import './ImageDetailsPage.css';
import { Image } from '../types';

const ImageDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [image, setImage] = useState<Image | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedImages, setRelatedImages] = useState<Image[]>([]);

  useEffect(() => {
    const fetchImageDetails = async () => {
      try {
        setLoading(true);
        
        // Fetch image details
        const response = await fetch(`http://localhost:3001/api/images/${id}`);
        if (!response.ok) {
          throw new Error('Image not found');
        }
        
        const data = await response.json();
        setImage(data);
        
        // Fetch related images
        const relatedResponse = await fetch(`http://localhost:3001/api/images/related/${id}`);
        if (relatedResponse.ok) {
          const relatedData = await relatedResponse.json();
          setRelatedImages(relatedData);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching image details:', error);
        setError((error as Error).message || 'Failed to load image details');
        setLoading(false);
      }
    };
    
    if (id) {
      fetchImageDetails();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading image details...</p>
      </div>
    );
  }

  if (error || !image) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h2>Error Loading Image</h2>
        <p>{error || 'Image not found'}</p>
        <Link to="/dashboard" className="back-button">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="image-details-page">
      <div className="details-header">
        <Link to="/dashboard" className="back-link">
          <span className="back-icon">←</span> Back
        </Link>
        <div className="image-info">
          <h1 className="image-title">Image Details</h1>
          <p className="image-id">ID: {image.id}</p>
        </div>
      </div>
      
      <div className="circular-viewer-wrapper">
        <CircularImageViewer image={image} />
      </div>
      
      <div className="image-actions">
        <button className="action-button download">
          <span className="action-icon">⬇️</span> Download
        </button>
        <button className="action-button share">
          <span className="action-icon">🔗</span> Share
        </button>
        <button className="action-button favorite">
          <span className="action-icon">⭐</span> Favorite
        </button>
        <button className="action-button delete">
          <span className="action-icon">🗑️</span> Delete
        </button>
      </div>
      
      {relatedImages.length > 0 && (
        <div className="related-images-section">
          <h2>Related Images</h2>
          <div className="related-images-grid">
            {relatedImages.map(relatedImage => (
              <Link 
                key={relatedImage.id} 
                to={`/image/${relatedImage.id}`}
                className="related-image-card"
              >
                <div 
                  className="related-image" 
                  style={{ backgroundImage: `url(${relatedImage.thumbnailUrl || relatedImage.url})` }}
                />
                <div className="related-image-overlay">
                  <div className="related-matches">
                    <span className="match-tag">{relatedImage.metadata.medium}</span>
                    {relatedImage.metadata.style && <span className="match-tag">{relatedImage.metadata.style}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageDetailsPage;