import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RadialNavigation from './components/RadialNavigation';
import HexagonalGrid from './components/HexagonalGrid';
import OrbitingCategories from './components/OrbitingCategories';
import CircularImageViewer from './components/CircularImageViewer';
import StorageManager from './components/StorageManager';
import StorageVisualization from './components/StorageVisualization';
import DataExporter from './components/DataExporter';
import DataImporter from './components/DataImporter';
import './App.css';

function App() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={
            <div className="main-view">
              <RadialNavigation onSelectCategory={setSelectedCategory} />
              <div className="content-area">
                {selectedCategory ? (
                  <CircularImageViewer category={selectedCategory} results={searchResults} />
                ) : (
                  <OrbitingCategories onSelectCategory={setSelectedCategory} />
                )}
              </div>
              <HexagonalGrid onSearch={setSearchResults} />
            </div>
          } />
          <Route path="/storage" element={<StorageManager />} />
          <Route path="/storage/visualization" element={<StorageVisualization />} />
          <Route path="/storage/export" element={<DataExporter />} />
          <Route path="/storage/import" element={<DataImporter />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;