import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const Navbar = ({ isDarkMode, toggleDarkMode }: NavbarProps) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const navigationItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'Upload', path: '/upload' },
    { name: 'Search', path: '/search' },
  ];
  
  const isActivePath = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };
  
  return (
    <nav className={`${isDarkMode ? 'bg-gray-800' : 'bg-indigo-600'} shadow-md`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-white font-bold text-xl">
                Visual<span className="text-indigo-200">Insight</span>
              </span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`
                    inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors
                    ${isActivePath(item.path)
                      ? 'border-white text-white'
                      : `border-transparent ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-indigo-100 hover:text-white'}`
                    }
                  `}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`
                p-1 rounded-full text-white focus:outline-none focus:ring-2 focus:ring-offset-2 
                ${isDarkMode 
                  ? 'focus:ring-offset-gray-800 focus:ring-white hover:bg-gray-700' 
                  : 'focus:ring-offset-indigo-600 focus:ring-white hover:bg-indigo-700'
                }
              `}
            >
              <span className="sr-only">Toggle dark mode</span>
              {isDarkMode ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
          </div>
          
          <div className="-mr-2 flex items-center sm:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`
                inline-flex items-center justify-center p-2 rounded-md text-white 
                ${isDarkMode 
                  ? 'hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-white' 
                  : 'hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-white'
                }
              `}
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden">
          <div className={`pt-2 pb-3 space-y-1 ${isDarkMode ? 'bg-gray-800' : 'bg-indigo-600'}`}>
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`
                  block pl-3 pr-4 py-2 border-l-4 text-base font-medium
                  ${isActivePath(item.path)
                    ? `border-white ${isDarkMode ? 'text-white bg-gray-700' : 'text-white bg-indigo-700'}`
                    : `border-transparent ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-indigo-100 hover:bg-indigo-700'}`
                  }
                `}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`
                w-full flex items-center pl-3 pr-4 py-2 border-l-4 border-transparent 
                text-base font-medium ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-indigo-100 hover:bg-indigo-700'}
              `}
            >
              <span className="mr-2">
                {isDarkMode ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                )}
              </span>
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;