import { useState, useRef, useEffect } from 'react';
import { uploadImage, uploadBulkImages } from '../api';
import { ImageMetadata, UploadState } from '../types';

interface FileUploaderProps {
  onUploadComplete?: (images: ImageMetadata[]) => void;
  maxFiles?: number;
}

const FileUploader = ({ onUploadComplete, maxFiles = 20 }: FileUploaderProps) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: null,
    success: false,
    results: [],
    failedUploads: [],
    isMockMode: false,
  });
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);
  
  // Reset state when files change
  useEffect(() => {
    setUploadState(prev => ({
      ...prev,
      error: null,
      success: false,
      progress: 0,
    }));
  }, [selectedFiles]);
  
  // Setup drag and drop event handlers
  useEffect(() => {
    const dropArea = dropAreaRef.current;
    if (!dropArea) return;
    
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.add('bg-indigo-100', 'border-indigo-500');
    };
    
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.remove('bg-indigo-100', 'border-indigo-500');
    };
    
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.remove('bg-indigo-100', 'border-indigo-500');
      
      if (e.dataTransfer?.files) {
        handleFiles(Array.from(e.dataTransfer.files));
      }
    };
    
    dropArea.addEventListener('dragover', handleDragOver);
    dropArea.addEventListener('dragleave', handleDragLeave);
    dropArea.addEventListener('drop', handleDrop);
    
    return () => {
      dropArea.removeEventListener('dragover', handleDragOver);
      dropArea.removeEventListener('dragleave', handleDragLeave);
      dropArea.removeEventListener('drop', handleDrop);
    };
  }, []);
  
  // Handle file selection
  const handleFiles = (fileList: File[]) => {
    // Filter only image files
    const imageFiles = Array.from(fileList).filter(file => 
      file.type.startsWith('image/')
    );
    
    // Limit number of files
    const limitedFiles = imageFiles.slice(0, maxFiles);
    
    if (limitedFiles.length < fileList.length) {
      alert(`Only the first ${maxFiles} images will be processed.`);
    }
    
    setSelectedFiles(limitedFiles);
  };
  
  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };
  
  // Handle browse button click
  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };
  
  // Clear selected files
  const handleClearFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Handle file upload
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadState(prev => ({
        ...prev,
        error: 'Please select at least one image to upload.',
      }));
      return;
    }
    
    setUploadState(prev => ({
      ...prev,
      uploading: true,
      progress: 0,
      error: null,
      success: false,
      results: [],
      failedUploads: [],
    }));
    
    try {
      // Use single upload for one file, bulk upload for multiple
      if (selectedFiles.length === 1) {
        const response = await uploadImage(selectedFiles[0], (percentage) => {
          setUploadState(prev => ({ ...prev, progress: percentage }));
        });
        
        if (response.success) {
          setUploadState(prev => ({
            ...prev,
            uploading: false,
            success: true,
            results: [response.data],
            isMockMode: !!response.message?.includes('mock'),
          }));
          
          if (onUploadComplete) {
            onUploadComplete([response.data]);
          }
        } else {
          setUploadState(prev => ({
            ...prev,
            uploading: false,
            error: response.error || 'Failed to upload image.',
            failedUploads: [{ filename: selectedFiles[0].name, error: response.error || 'Unknown error' }],
          }));
        }
      } else {
        // Bulk upload
        const response = await uploadBulkImages(selectedFiles, (percentage) => {
          setUploadState(prev => ({ ...prev, progress: percentage }));
        });
        
        if (response.success) {
          setUploadState(prev => ({
            ...prev,
            uploading: false,
            success: true,
            results: response.data.results,
            failedUploads: response.data.errors,
            isMockMode: response.data.mockMode,
          }));
          
          if (onUploadComplete) {
            onUploadComplete(response.data.results);
          }
        } else {
          setUploadState(prev => ({
            ...prev,
            uploading: false,
            error: response.error || 'Failed to upload images.',
            failedUploads: response.data.errors || [],
          }));
        }
      }
    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred.',
      }));
    }
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
      
      {/* Drop area */}
      <div
        ref={dropAreaRef}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors cursor-pointer hover:bg-gray-50"
        onClick={handleBrowseClick}
      >
        <div className="space-y-3">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-sm text-gray-600">
            <p className="font-medium">Drag and drop your images here</p>
            <p>Or click to browse</p>
          </div>
          <p className="text-xs text-gray-500">
            JPG, PNG, GIF, WEBP up to 10MB
          </p>
        </div>
      </div>
      
      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">Selected Files ({selectedFiles.length})</h3>
            <button
              type="button"
              onClick={handleClearFiles}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Clear All
            </button>
          </div>
          <ul className="max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-200">
            {selectedFiles.map((file, index) => (
              <li key={index} className="p-2 flex justify-between items-center text-sm">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm12 12V4H6v12h10z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="truncate max-w-xs">{file.name}</span>
                </div>
                <span className="text-gray-500 text-xs">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Upload button */}
      <div className="mt-4">
        <button
          type="button"
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || uploadState.uploading}
          className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white 
            ${selectedFiles.length === 0 ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} 
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
        >
          {uploadState.uploading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Uploading {uploadState.progress}%
            </>
          ) : (
            <>Upload {selectedFiles.length} {selectedFiles.length === 1 ? 'Image' : 'Images'}</>
          )}
        </button>
      </div>
      
      {/* Status messages */}
      {uploadState.error && (
        <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-md">
          <p className="font-medium">Error: {uploadState.error}</p>
          {uploadState.failedUploads.length > 0 && (
            <ul className="list-disc pl-5 mt-1 text-sm">
              {uploadState.failedUploads.map((failure, index) => (
                <li key={index}>
                  {failure.filename}: {failure.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {uploadState.success && (
        <div className="mt-3 p-3 bg-green-50 text-green-700 rounded-md">
          <p className="font-medium">
            Successfully processed {uploadState.results.length} {uploadState.results.length === 1 ? 'image' : 'images'}
            {uploadState.isMockMode && " (using mock data - no API key provided)"}
          </p>
          {uploadState.failedUploads.length > 0 && (
            <p className="mt-1 text-sm">
              Failed to process {uploadState.failedUploads.length} {uploadState.failedUploads.length === 1 ? 'image' : 'images'}.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUploader;