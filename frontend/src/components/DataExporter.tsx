import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Image } from '../types';
import './DataExporter.css';

interface DataExporterProps {
  images?: Image[];
}

const DataExporter: React.FC<DataExporterProps> = ({ images = [] }) => {
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [exportFormat, setExportFormat] = useState<'zip' | 'json'>('zip');
  const [isExporting, setIsExporting] = useState(false);
  const [includeImages, setIncludeImages] = useState(true);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    message: string;
    downloadUrl?: string;
  } | null>(null);

  // Handle select all toggle
  useEffect(() => {
    if (selectAll && images.length > 0) {
      setSelectedImages(images.map(img => img.id));
    } else if (selectedImages.length === images.length) {
      // If unselecting "select all", clear all selections
      setSelectedImages([]);
    }
  }, [selectAll, images]);

  // Update selectAll state when individual selections change
  useEffect(() => {
    if (images.length > 0 && selectedImages.length === images.length) {
      setSelectAll(true);
    } else if (selectAll && selectedImages.length !== images.length) {
      setSelectAll(false);
    }
  }, [selectedImages, images.length, selectAll]);

  const handleImageSelect = (imageId: string) => {
    setSelectedImages(prev => {
      if (prev.includes(imageId)) {
        return prev.filter(id => id !== imageId);
      } else {
        return [...prev, imageId];
      }
    });
  };

  const handleSelectAllToggle = () => {
    setSelectAll(!selectAll);
  };

  const handleDatabaseExport = async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      const response = await axios.post('http://localhost:3001/api/storage/export', {
        includeImages
      });

      if (response.data.success) {
        setExportResult({
          success: true,
          message: `Export successful! Database has been backed up.`,
          downloadUrl: `http://localhost:3001${response.data.exportPath}`
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      setExportResult({
        success: false,
        message: 'Export failed. Please try again.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSelectedImagesExport = async () => {
    if (selectedImages.length === 0) {
      setExportResult({
        success: false,
        message: 'Please select at least one image to export'
      });
      return;
    }

    setIsExporting(true);
    setExportResult(null);

    try {
      if (exportFormat === 'zip') {
        // Export as ZIP with images and metadata
        const response = await axios.post('http://localhost:3001/api/export', {
          imageIds: selectedImages
        });

        setExportResult({
          success: true,
          message: `Export successful! ${selectedImages.length} images exported.`,
          downloadUrl: `http://localhost:3001${response.data.exportPath}`
        });
      } else {
        // Export as JSON (metadata only)
        // First, get full image data for selected images
        const selectedImageData = images.filter(img => selectedImages.includes(img.id));
        
        // Create a JSON blob for download
        const jsonData = JSON.stringify(selectedImageData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link to download the file
        const a = document.createElement('a');
        a.href = url;
        a.download = `image-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        setExportResult({
          success: true,
          message: `Export successful! Metadata for ${selectedImages.length} images exported as JSON.`
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      setExportResult({
        success: false,
        message: 'Export failed. Please try again.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Main export function that delegates to the appropriate exporter
  const handleExport = () => {
    if (images.length > 0 && selectedImages.length > 0) {
      handleSelectedImagesExport();
    } else {
      handleDatabaseExport();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center mb-8">
        <button 
          onClick={() => window.history.back()}
          className="mr-4 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-3xl font-bold text-gray-800">Export Data</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Export Options</h2>
          
          {images.length > 0 ? (
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <button 
                  className={`p-6 rounded-lg border-2 transition-colors ${
                    exportFormat === 'zip' 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setExportFormat('zip')}
                >
                  <div className="flex items-start">
                    <div className="mr-4 text-3xl">📦</div>
                    <div>
                      <h3 className="text-lg font-medium mb-2">ZIP Archive</h3>
                      <p className="text-gray-600 text-sm">
                        Export complete archive including image files and metadata.
                      </p>
                    </div>
                  </div>
                </button>
                
                <button 
                  className={`p-6 rounded-lg border-2 transition-colors ${
                    exportFormat === 'json' 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setExportFormat('json')}
                >
                  <div className="flex items-start">
                    <div className="mr-4 text-3xl">📄</div>
                    <div>
                      <h3 className="text-lg font-medium mb-2">JSON Metadata</h3>
                      <p className="text-gray-600 text-sm">
                        Export metadata only in JSON format (no image files).
                      </p>
                    </div>
                  </div>
                </button>
              </div>
              
              <div className="mb-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Select Images to Export</h3>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAllToggle}
                        className="form-checkbox h-5 w-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                      <span className="ml-2 text-gray-700">Select All</span>
                    </label>
                    
                    <span className="text-gray-500 text-sm">
                      {selectedImages.length} of {images.length} selected
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-96 overflow-y-auto p-2">
                {images.map(image => (
                  <div 
                    key={image.id} 
                    className={`group rounded-lg overflow-hidden border cursor-pointer transition-all ${
                      selectedImages.includes(image.id) 
                        ? 'border-purple-500 ring-2 ring-purple-500 ring-opacity-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleImageSelect(image.id)}
                  >
                    <div className="relative h-32">
                      <img 
                        src={image.thumbnailUrl || image.url} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2">
                        <div className={`w-5 h-5 rounded ${
                          selectedImages.includes(image.id) 
                            ? 'bg-purple-500' 
                            : 'bg-white border border-gray-300 group-hover:border-gray-400'
                        } flex items-center justify-center`}>
                          {selectedImages.includes(image.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="px-2 py-1 text-xs truncate">
                      {image.fileName.length > 20 
                        ? `${image.fileName.substring(0, 17)}...` 
                        : image.fileName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Database Export</h3>
              <p className="text-gray-700 mb-4">
                Export your entire database as a backup that can be restored later.
              </p>
              
              <div className="mb-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeImages}
                    onChange={() => setIncludeImages(!includeImages)}
                    className="form-checkbox h-5 w-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                  />
                  <span className="ml-2 text-gray-700">Include image files in export</span>
                </label>
                <p className="mt-2 text-sm text-gray-500 ml-7">
                  When enabled, all image files will be included in the export. This results in a larger file size but creates a complete backup.
                  When disabled, only the database metadata is exported (smaller file size).
                </p>
              </div>
            </div>
          )}
          
          {exportResult && (
            <div className={`mt-6 p-4 rounded-md ${
              exportResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0 mr-3">
                  {exportResult.success ? (
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-medium ${exportResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {exportResult.message}
                  </h3>
                  {exportResult.downloadUrl && (
                    <div className="mt-2">
                      <a 
                        href={exportResult.downloadUrl}
                        download
                        className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Export
                      </a>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setExportResult(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          <div className="flex justify-end mt-6">
            <button 
              onClick={handleExport}
              disabled={isExporting || (images.length > 0 && selectedImages.length === 0)}
              className={`px-5 py-2 rounded-md text-white font-medium ${
                isExporting || (images.length > 0 && selectedImages.length === 0)
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 transition-colors'
              }`}
            >
              {isExporting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </span>
              ) : (
                'Export Data'
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-xl font-semibold mb-4">Export Format Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Full Database Backup (ZIP)</h3>
            <p className="text-gray-700 mb-2">
              Creates a complete backup of your database that can be restored later.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>Includes all database tables and indexes</li>
              <li>Optionally includes all image files</li>
              <li>Can be used for complete system recovery</li>
              <li>Preserves all relationships and metadata</li>
              <li>Larger file size, especially with images</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Selected Images (JSON or ZIP)</h3>
            <p className="text-gray-700 mb-2">
              Exports only the selected images for sharing or moving to another system.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>ZIP format includes image files and metadata</li>
              <li>JSON format includes only metadata (small size)</li>
              <li>Perfect for sharing specific image collections</li>
              <li>Preserves all AI-generated metadata</li>
              <li>Can be imported into other compatible systems</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-6 bg-blue-50 p-4 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0 mr-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-blue-800 mb-1">Privacy Information</h3>
              <p className="text-blue-700">
                All exports are created locally and stored on your device. No data is sent to external servers during the export process.
                Your images and their metadata remain private and under your control.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataExporter;