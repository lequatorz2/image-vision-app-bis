import { useState } from 'react';
import { ImageMetadata } from '../types';

interface ImageCardProps {
  image: ImageMetadata;
  onClick?: (image: ImageMetadata) => void;
}

const ImageCard = ({ image, onClick }: ImageCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const handleClick = () => {
    if (onClick) {
      onClick(image);
    }
  };
  
  // Format a date string from the created_at timestamp
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  // Extract color names from the colors string
  const getColorList = (colors: string) => {
    return colors.split(',').map((color) => color.trim());
  };
  
  // Generate a background color gradient from the colors
  const getGradientStyle = (colors: string) => {
    const colorList = getColorList(colors);
    if (colorList.length >= 2) {
      return {
        background: `linear-gradient(135deg, ${colorList[0]} 0%, ${colorList[1]} 100%)`,
      };
    }
    return { background: colorList[0] || '#f3f4f6' };
  };
  
  return (
    <div 
      className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer bg-white"
      onClick={handleClick}
    >
      <div className="relative aspect-w-16 aspect-h-9 bg-gray-100">
        {/* Color preview based on image colors */}
        {image.colors && !imageLoaded && !imageError && (
          <div 
            className="absolute inset-0 opacity-50" 
            style={getGradientStyle(image.colors)}
          ></div>
        )}
        
        {/* Loading skeleton */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* Error fallback */}
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-gray-400 text-center p-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="mt-2">Failed to load image</p>
            </div>
          </div>
        )}
        
        {/* Actual image */}
        <img
          src={image.url}
          alt={image.filename}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(false);
          }}
        />
      </div>
      
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 truncate mb-1">{image.filename}</h3>
        
        <div className="flex flex-wrap gap-1 mb-2">
          {/* Medium tag */}
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {image.medium || 'Unknown medium'}
          </span>
          
          {/* Style tag */}
          {image.style && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
              {image.style}
            </span>
          )}
          
          {/* Mood tag */}
          {image.mood && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800">
              {image.mood}
            </span>
          )}
        </div>
        
        {/* Color chips */}
        {image.colors && (
          <div className="flex items-center space-x-1 mb-2">
            {getColorList(image.colors).map((color, index) => (
              <div 
                key={index}
                className="w-4 h-4 rounded-full border border-gray-200" 
                style={{ backgroundColor: color.toLowerCase() }}
                title={color}
              ></div>
            ))}
          </div>
        )}
        
        {/* Scene preview */}
        <p className="text-xs text-gray-500 line-clamp-2">
          {image.scene || 'No scene description'}
        </p>
        
        <div className="mt-2 text-xs text-gray-400">
          {formatDate(image.created_at)}
        </div>
      </div>
    </div>
  );
};

export default ImageCard;