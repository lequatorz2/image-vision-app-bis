import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './UploadPage.css';
import { Image } from '../types';

interface UploadPageProps {
  onImagesAdded: (newImages: Image[]) => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ onImagesAdded }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Animations for floating orbs
  const [orbs, setOrbs] = useState<Array<{ id: number; x: number; y: number; size: number; speed: number; color: string }>>([]);

  useEffect(() => {
    // Generate random floating orbs for the background
    const newOrbs = Array.from({ length: 15 }).map((_, index) => ({
      id: index,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 50 + 20,
      speed: Math.random() * 5 + 2,
      color: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.2)`
    }));
    
    setOrbs(newOrbs);
    
    // Reset upload state when component mounts
    return () => {
      // Clean up any preview URLs
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    // Filter for image files only
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      setUploadError('Please select image files only.');
      return;
    }
    
    // Create object URLs for previews
    const urls = imageFiles.map(file => URL.createObjectURL(file));
    
    setUploadedFiles(imageFiles);
    setPreviewUrls(urls);
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (uploadedFiles.length === 0) {
      setUploadError('Please select files to upload first.');
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    setProcessingProgress(0);
    setUploadError(null);
    
    try {
      const formData = new FormData();
      uploadedFiles.forEach(file => {
        formData.append('images', file);
      });
      
      // Upload progress simulation
      const uploadInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(uploadInterval);
            return 100;
          }
          return prev + 5;
        });
      }, 200);
      
      // Perform the actual upload
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(uploadInterval);
      setUploadProgress(100);
      
      if (!response.ok) {
        throw new Error('Failed to upload images');
      }
      
      // Processing progress simulation (Gemini API analyzing images)
      const processingInterval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 100) {
            clearInterval(processingInterval);
            return 100;
          }
          return prev + 2;
        });
      }, 300);
      
      const result = await response.json();
      
      clearInterval(processingInterval);
      setProcessingProgress(100);
      
      // Add the newly uploaded images to the app state
      onImagesAdded(result.images);
      
      setUploadComplete(true);
      
      // Navigate to dashboard after a delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError((error as Error).message || 'Failed to upload images');
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setUploadedFiles([]);
    setPreviewUrls(prev => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return [];
    });
    setUploadProgress(0);
    setProcessingProgress(0);
    setUploading(false);
    setUploadComplete(false);
    setUploadError(null);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="upload-page">
      <div className="page-header">
        <h1>Upload Images</h1>
        <p className="subtitle">Add images to your collection for AI-powered analysis</p>
      </div>
      
      {/* Floating background orbs */}
      <div className="floating-orbs">
        {orbs.map(orb => (
          <div
            key={orb.id}
            className="orb"
            style={{
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              width: `${orb.size}px`,
              height: `${orb.size}px`,
              background: orb.color,
              animationDuration: `${orb.speed}s`
            }}
          />
        ))}
      </div>
      
      <div 
        className={`upload-container ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        {!uploading && !uploadComplete && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              id="file-upload"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="file-input"
            />
            
            <div className="upload-content">
              <div className="upload-icon">🖼️</div>
              <h2>Drag & Drop Images</h2>
              <p>or</p>
              <button 
                className="browse-button"
                onClick={triggerFileInput}
              >
                Browse Files
              </button>
              <p className="file-hint">Supported formats: JPG, PNG, GIF, WebP</p>
            </div>
          </>
        )}
        
        {(uploading || uploadComplete) && (
          <div className="upload-progress">
            <div className="progress-step">
              <div className="step-icon">⬆️</div>
              <div className="step-content">
                <h3>Uploading Images</h3>
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="progress-text">{uploadProgress}%</div>
              </div>
            </div>
            
            <div className="progress-step">
              <div className="step-icon">🧠</div>
              <div className="step-content">
                <h3>Processing with Gemini AI</h3>
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${processingProgress}%` }}
                  ></div>
                </div>
                <div className="progress-text">{processingProgress}%</div>
              </div>
            </div>
            
            {uploadComplete && (
              <div className="completion-message">
                <div className="completion-icon">✅</div>
                <h3>Upload Complete!</h3>
                <p>Redirecting to dashboard...</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {uploadedFiles.length > 0 && !uploading && !uploadComplete && (
        <div className="selected-files">
          <h2>Selected Files ({uploadedFiles.length})</h2>
          
          <div className="preview-grid">
            {previewUrls.map((url, index) => (
              <div key={index} className="preview-item">
                <div 
                  className="preview-image" 
                  style={{ backgroundImage: `url(${url})` }}
                ></div>
                <div className="preview-name">{uploadedFiles[index].name}</div>
              </div>
            ))}
          </div>
          
          <div className="upload-actions">
            <button 
              className="cancel-button"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button 
              className="upload-button"
              onClick={handleUpload}
            >
              Upload & Analyze
            </button>
          </div>
        </div>
      )}
      
      {uploadError && (
        <div className="error-message">
          <div className="error-icon">⚠️</div>
          <p>{uploadError}</p>
        </div>
      )}
    </div>
  );
};

export default UploadPage;