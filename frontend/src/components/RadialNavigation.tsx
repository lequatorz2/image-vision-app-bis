import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './RadialNavigation.css';

interface RadialNavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: string;
  name: string;
  path: string;
  icon: string;
}

const RadialNavigation: React.FC<RadialNavigationProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const navigationRef = useRef<HTMLDivElement>(null);

  const navItems: NavItem[] = [
    { id: 'dashboard', name: 'Dashboard', path: '/dashboard', icon: '📊' },
    { id: 'upload', name: 'Upload', path: '/upload', icon: '⬆️' },
    { id: 'search', name: 'Search', path: '/search', icon: '🔍' },
    { id: 'favorites', name: 'Favorites', path: '/favorites', icon: '⭐' },
    { id: 'settings', name: 'Settings', path: '/settings', icon: '⚙️' },
  ];

  useEffect(() => {
    // Set selected item based on current path
    const currentPath = location.pathname;
    const currentItem = navItems.find(item => currentPath.startsWith(item.path));
    setSelectedItem(currentItem?.id || null);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        navigationRef.current &&
        !navigationRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleNavigation = (item: NavItem) => {
    navigate(item.path);
    setSelectedItem(item.id);
    onClose();
  };

  return (
    <div 
      className={`radial-navigation ${isOpen ? 'open' : ''}`}
      ref={navigationRef}
    >
      <div className="radial-center">
        <div className="pulse-ring"></div>
        <div className="center-icon">
          <span>📁</span>
        </div>
      </div>
      
      {navItems.map((item, index) => {
        // Calculate position in the circle
        const angle = (360 / navItems.length) * index * (Math.PI / 180);
        // Radius of the circle
        const radius = 150;
        
        // Calculate x and y coordinates
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        return (
          <div
            key={item.id}
            className={`radial-item ${selectedItem === item.id ? 'active' : ''}`}
            style={{
              transform: `translate(${x}px, ${y}px)`
            }}
            onClick={() => handleNavigation(item)}
          >
            <div className="item-content">
              <div className="item-icon">{item.icon}</div>
              <div className="item-label">{item.name}</div>
            </div>
            <div className="connector-line"></div>
          </div>
        );
      })}
    </div>
  );
};

export default RadialNavigation;