import { useState, useRef } from 'react';
import './DataImporter.css';
import axios from 'axios';

const DataImporter: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importType, setImportType] = useState<'database' | 'images'>('database');
  const [isImporting, setIsImporting] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Check if it's a valid import file
    if (importType === 'database' && !file.name.endsWith('.zip')) {
      setImportResult({
        success: false,
        message: 'Invalid file format',
        details: 'Database imports must be ZIP files'
      });
      return;
    }
    
    if (importType === 'images' && !file.name.endsWith('.json')) {
      setImportResult({
        success: false,
        message: 'Invalid file format',
        details: 'Image metadata imports must be JSON files'
      });
      return;
    }
    
    setSelectedFile(file);
    setImportResult(null);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    
    setIsImporting(true);
    setImportResult(null);
    
    try {
      if (importType === 'database') {
        // Upload backup file for restoration
        const formData = new FormData();
        formData.append('backup', selectedFile);
        formData.append('overwrite', overwriteExisting.toString());
        
        const response = await axios.post('http://localhost:3001/api/storage/import', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        setImportResult({
          success: true,
          message: 'Database import successful!',
          details: `Imported ${response.data.metadata?.includesImages ? 'database and images' : 'database only'}`
        });
      } else {
        // Read JSON file and import image metadata
        const fileReader = new FileReader();
        
        fileReader.onload = async (e) => {
          try {
            const content = e.target?.result as string;
            const images = JSON.parse(content);
            
            if (!Array.isArray(images)) {
              throw new Error('Invalid JSON format: expected an array of images');
            }
            
            const response = await axios.post('http://localhost:3001/api/import-metadata', {
              images
            });
            
            setImportResult({
              success: true,
              message: 'Metadata import successful!',
              details: `Imported metadata for ${response.data.importedCount} images`
            });
          } catch (error) {
            console.error('Error parsing JSON:', error);
            setImportResult({
              success: false,
              message: 'Failed to parse JSON file',
              details: (error as Error).message
            });
          }
        };
        
        fileReader.onerror = () => {
          setImportResult({
            success: false,
            message: 'Failed to read file',
            details: 'Error reading the selected file'
          });
        };
        
        fileReader.readAsText(selectedFile);
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        message: 'Import failed',
        details: (error as Error).message
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setImportResult(null);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
        <h1 className="text-3xl font-bold text-gray-800">Import Data</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Import Options</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <button 
              className={`p-6 rounded-lg border-2 transition-colors ${
                importType === 'database' 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setImportType('database')}
            >
              <div className="flex items-start">
                <div className="mr-4 text-3xl">📊</div>
                <div>
                  <h3 className="text-lg font-medium mb-2">Database Backup</h3>
                  <p className="text-gray-600 text-sm">
                    Import a complete database backup, including images and metadata.
                  </p>
                </div>
              </div>
            </button>
            
            <button 
              className={`p-6 rounded-lg border-2 transition-colors ${
                importType === 'images' 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setImportType('images')}
            >
              <div className="flex items-start">
                <div className="mr-4 text-3xl">🖼️</div>
                <div>
                  <h3 className="text-lg font-medium mb-2">Image Metadata</h3>
                  <p className="text-gray-600 text-sm">
                    Import metadata only in JSON format, without the image files.
                  </p>
                </div>
              </div>
            </button>
          </div>
          
          {importType === 'database' && (
            <div className="mb-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={() => setOverwriteExisting(!overwriteExisting)}
                  className="form-checkbox h-5 w-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                />
                <span className="ml-2 text-gray-700">Overwrite existing files</span>
              </label>
              <p className="mt-2 text-sm text-gray-500 ml-7">
                When enabled, imported files will replace existing files with the same name.
                When disabled, existing files will be preserved.
              </p>
            </div>
          )}
        </div>
        
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300'
          } ${selectedFile ? 'bg-gray-50' : ''} transition-colors cursor-pointer`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
        >
          <input 
            ref={fileInputRef}
            type="file"
            accept={importType === 'database' ? '.zip' : '.json'}
            onChange={handleFileChange}
            className="hidden"
          />
          
          {selectedFile ? (
            <div>
              <div className="text-4xl mb-2">📄</div>
              <div className="font-medium text-lg">{selectedFile.name}</div>
              <div className="text-gray-500 mt-1">{formatFileSize(selectedFile.size)}</div>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-4">📥</div>
              <h3 className="text-lg font-medium mb-2">Drag & Drop {importType === 'database' ? 'Backup File' : 'JSON File'}</h3>
              <p className="text-gray-500 mb-3">or</p>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
                Browse Files
              </button>
            </div>
          )}
        </div>
        
        {importResult && (
          <div className={`mt-6 p-4 rounded-md ${
            importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex">
              <div className="flex-shrink-0 mr-3">
                {importResult.success ? (
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className={`text-lg font-medium ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {importResult.message}
                </h3>
                {importResult.details && (
                  <p className={importResult.success ? 'text-green-700' : 'text-red-700'}>
                    {importResult.details}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="flex justify-end mt-6 space-x-4">
          <button 
            onClick={handleCancel}
            disabled={isImporting || !selectedFile}
            className={`px-4 py-2 border border-gray-300 rounded-md ${
              isImporting || !selectedFile 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Cancel
          </button>
          <button 
            onClick={handleImport}
            disabled={isImporting || !selectedFile}
            className={`px-4 py-2 rounded-md text-white ${
              isImporting || !selectedFile
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isImporting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Importing...
              </span>
            ) : (
              'Import File'
            )}
          </button>
        </div>
      </div>
      
      <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-xl font-semibold mb-4">Important Notes</h2>
        
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Warning:</strong> Importing a database backup will replace your current data. 
                Create a backup of your current database before importing if you want to keep it.
              </p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Database Backup Import</h3>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>Imports a complete backup including database and images</li>
              <li>Restores all metadata, search indexes, and settings</li>
              <li>Accepts .zip files created by the export function</li>
              <li>May take longer if the backup includes many images</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Metadata Import</h3>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>Imports only the metadata, not the actual image files</li>
              <li>Accepts JSON format with the standard metadata structure</li>
              <li>Useful for transferring AI analysis between systems</li>
              <li>Image files must be provided separately or re-analyzed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default DataImporter;