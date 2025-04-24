import { useState, useEffect } from 'react';
import './SettingsPage.css';
import StorageManager from '../components/StorageManager';
import DatabaseStats from '../components/DatabaseStats';
import DataExporter from '../components/DataExporter';
import DataImporter from '../components/DataImporter';
import { Image } from '../types';
import axios from 'axios';

enum SettingsTab {
  STORAGE = 'storage',
  PRIVACY = 'privacy',
  STATS = 'stats',
  EXPORT = 'export',
}

enum ExportImportTab {
  EXPORT = 'export',
  IMPORT = 'import',
}

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(SettingsTab.STORAGE);
  const [exportImportTab, setExportImportTab] = useState<ExportImportTab>(ExportImportTab.EXPORT);
  const [privacySettings, setPrivacySettings] = useState({
    autoBackup: false,
    backupFrequency: 7,
    enabledGemini: true,
    storeMetadataLocally: true,
    shareTelemetry: false
  });
  const [images, setImages] = useState<Image[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch images for export tab
    const fetchImages = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('http://localhost:3001/api/images');
        setImages(response.data);
      } catch (error) {
        console.error('Error fetching images:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (activeTab === SettingsTab.EXPORT && exportImportTab === ExportImportTab.EXPORT) {
      fetchImages();
    }
  }, [activeTab, exportImportTab]);

  const handleToggleSetting = (setting: keyof typeof privacySettings) => {
    setPrivacySettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleSaveSettings = async () => {
    try {
      await axios.post('http://localhost:3001/api/settings', {
        settings: {
          auto_backup: privacySettings.autoBackup.toString(),
          backup_frequency: privacySettings.backupFrequency.toString(),
        }
      });
      
      // Show a success message or notification here
    } catch (error) {
      console.error('Error saving settings:', error);
      // Show an error message
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="subtitle">Configure your local storage and privacy settings</p>
      </div>

      <div className="settings-container">
        <div className="settings-sidebar">
          <button
            className={`setting-tab ${activeTab === SettingsTab.STORAGE ? 'active' : ''}`}
            onClick={() => setActiveTab(SettingsTab.STORAGE)}
          >
            <span className="tab-icon">💾</span>
            Storage Management
          </button>
          <button
            className={`setting-tab ${activeTab === SettingsTab.PRIVACY ? 'active' : ''}`}
            onClick={() => setActiveTab(SettingsTab.PRIVACY)}
          >
            <span className="tab-icon">🔒</span>
            Privacy & Data
          </button>
          <button
            className={`setting-tab ${activeTab === SettingsTab.STATS ? 'active' : ''}`}
            onClick={() => setActiveTab(SettingsTab.STATS)}
          >
            <span className="tab-icon">📊</span>
            Database Statistics
          </button>
          <button
            className={`setting-tab ${activeTab === SettingsTab.EXPORT ? 'active' : ''}`}
            onClick={() => setActiveTab(SettingsTab.EXPORT)}
          >
            <span className="tab-icon">📤</span>
            Export & Import
          </button>
        </div>

        <div className="settings-content">
          {activeTab === SettingsTab.STORAGE && (
            <StorageManager />
          )}

          {activeTab === SettingsTab.PRIVACY && (
            <div className="privacy-settings">
              <div className="settings-section">
                <h2>Privacy Settings</h2>
                <p className="section-description">
                  Configure how your data is stored and processed. This application is designed to keep your data private and local.
                </p>

                <div className="privacy-cards">
                  <div className="privacy-card">
                    <div className="card-header">
                      <h3>Data Storage</h3>
                      <div className="privacy-badge secure">Local Only</div>
                    </div>
                    <p className="card-description">
                      All your images and metadata are stored locally on your device using SQLite.
                      No data is sent to external servers except when analyzing images with Google's Gemini API.
                    </p>
                    <div className="card-settings">
                      <div className="setting-option">
                        <div>
                          <div className="option-name">Store metadata locally</div>
                          <div className="option-description">Keep image analysis results in local database</div>
                        </div>
                        <label className="toggle-switch">
                          <input 
                            type="checkbox" 
                            checked={privacySettings.storeMetadataLocally}
                            onChange={() => handleToggleSetting('storeMetadataLocally')}
                            disabled
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="privacy-card">
                    <div className="card-header">
                      <h3>External Services</h3>
                      <div className="privacy-badge warning">API Required</div>
                    </div>
                    <p className="card-description">
                      Image analysis is performed using Google's Gemini 1.5 Vision model.
                      When analyzing images, they are temporarily sent to Gemini API, but no permanent copies are stored on Google's servers.
                    </p>
                    <div className="card-settings">
                      <div className="setting-option">
                        <div>
                          <div className="option-name">Enable Gemini API</div>
                          <div className="option-description">Use AI to analyze and tag images</div>
                        </div>
                        <label className="toggle-switch">
                          <input 
                            type="checkbox" 
                            checked={privacySettings.enabledGemini}
                            onChange={() => handleToggleSetting('enabledGemini')}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h2>Backup Settings</h2>
                <p className="section-description">
                  Configure automatic backups to protect your data
                </p>

                <div className="backup-settings">
                  <div className="setting-option">
                    <div>
                      <div className="option-name">Auto backup</div>
                      <div className="option-description">Automatically create backups of your database</div>
                    </div>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={privacySettings.autoBackup}
                        onChange={() => handleToggleSetting('autoBackup')}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>

                  {privacySettings.autoBackup && (
                    <div className="setting-option">
                      <div>
                        <div className="option-name">Backup frequency</div>
                        <div className="option-description">How often to create automatic backups</div>
                      </div>
                      <select 
                        className="select-input"
                        value={privacySettings.backupFrequency}
                        onChange={(e) => setPrivacySettings(prev => ({
                          ...prev,
                          backupFrequency: parseInt(e.target.value)
                        }))}
                      >
                        <option value="1">Daily</option>
                        <option value="7">Weekly</option>
                        <option value="30">Monthly</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="settings-save">
                  <button 
                    className="save-button"
                    onClick={handleSaveSettings}
                  >
                    Save Settings
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <h2>Data Sharing</h2>

                <div className="telemetry-settings">
                  <div className="setting-option">
                    <div>
                      <div className="option-name">Share anonymous usage data</div>
                      <div className="option-description">
                        Help improve the application by sharing anonymous usage statistics
                      </div>
                    </div>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={privacySettings.shareTelemetry}
                        onChange={() => handleToggleSetting('shareTelemetry')}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>

                  <div className="telemetry-info">
                    <p>
                      If enabled, the following anonymous data will be collected:
                    </p>
                    <ul>
                      <li>Number of images processed</li>
                      <li>Types of media in your collection</li>
                      <li>Performance metrics</li>
                    </ul>
                    <p>
                      <strong>We DO NOT collect:</strong> Your images, personal information, or specific metadata about your images.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === SettingsTab.STATS && (
            <DatabaseStats />
          )}

          {activeTab === SettingsTab.EXPORT && (
            <div className="export-import-container">
              <div className="export-import-tabs">
                <button
                  className={`export-import-tab ${exportImportTab === ExportImportTab.EXPORT ? 'active' : ''}`}
                  onClick={() => setExportImportTab(ExportImportTab.EXPORT)}
                >
                  <span className="tab-icon">📤</span>
                  Export Data
                </button>
                <button
                  className={`export-import-tab ${exportImportTab === ExportImportTab.IMPORT ? 'active' : ''}`}
                  onClick={() => setExportImportTab(ExportImportTab.IMPORT)}
                >
                  <span className="tab-icon">📥</span>
                  Import Data
                </button>
              </div>
              
              <div className="export-import-content">
                {exportImportTab === ExportImportTab.EXPORT ? (
                  <>
                    {isLoading ? (
                      <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>Loading images...</p>
                      </div>
                    ) : (
                      <DataExporter images={images} />
                    )}
                  </> 
                ) : (
                  <DataImporter />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;