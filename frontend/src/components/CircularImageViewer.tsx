import { useState, useEffect, useRef } from 'react';
import './CircularImageViewer.css';
import { Image } from '../types';

interface CircularImageViewerProps {
  image: Image;
}

const CircularImageViewer: React.FC<CircularImageViewerProps> = ({ image }) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Define metadata sections
  const metadataSections = [
    { id: 'medium', name: 'Medium', value: image.metadata.medium, icon: '🎨' },
    { id: 'people', name: 'People', value: `${image.metadata.people?.number || 'None'} (${image.metadata.people?.gender || 'N/A'})`, icon: '👥' },
    { id: 'actions', name: 'Actions', value: image.metadata.actions, icon: '🏃' },
    { id: 'clothes', name: 'Clothes', value: image.metadata.clothes, icon: '👔' },
    { id: 'environment', name: 'Environment', value: image.metadata.environment, icon: '🌍' },
    { id: 'colors', name: 'Colors', value: image.metadata.colors?.join(', '), icon: '🎨' },
    { id: 'style', name: 'Style', value: image.metadata.style, icon: '🖌️' },
    { id: 'mood', name: 'Mood', value: image.metadata.mood, icon: '😊' },
  ];

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    setActiveSection(null);
  };

  const handleSectionClick = (sectionId: string) => {
    if (activeSection === sectionId) {
      setActiveSection(null);
    } else {
      setActiveSection(sectionId);
    }
  };

  return (
    <div 
      className={`circular-viewer-container ${isExpanded ? 'expanded' : ''}`}
      ref={viewerRef}
    >
      <div className="viewer-center" onClick={toggleExpand}>
        <div 
          className="center-image" 
          style={{ backgroundImage: `url(${image.url})` }}
        />
        <div className="expand-icon">
          {isExpanded ? '−' : '+'}
        </div>
      </div>
      
      <div className="scene-description">
        <h3>Scene Description</h3>
        <p>{image.metadata.scene}</p>
      </div>
      
      <div className={`metadata-sections ${isExpanded ? 'visible' : ''}`}>
        {metadataSections.map((section, index) => {
          const angle = (360 / metadataSections.length) * index;
          const isActive = activeSection === section.id;
          
          return (
            <div
              key={section.id}
              className={`metadata-section ${isActive ? 'active' : ''}`}
              style={{ 
                '--angle': angle,
                '--index': index
              } as React.CSSProperties}
              onClick={() => handleSectionClick(section.id)}
            >
              <div className="section-content">
                <div className="section-icon">{section.icon}</div>
                <div className="section-name">{section.name}</div>
                <div className={`section-value ${isActive ? 'visible' : ''}`}>
                  {section.value || 'N/A'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className={`connection-lines ${isExpanded ? 'visible' : ''}`}>
        {metadataSections.map((section, index) => {
          const angle = (360 / metadataSections.length) * index;
          
          return (
            <div
              key={`line-${section.id}`}
              className="connection-line"
              style={{
                '--angle': angle,
                '--index': index
              } as React.CSSProperties}
            />
          );
        })}
      </div>
    </div>
  );
};

export default CircularImageViewer;