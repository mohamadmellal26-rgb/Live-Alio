import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronDown, 
  Search, 
  Globe, 
  Briefcase, 
  Sliders, 
  Zap, 
  Crown, 
  Video, 
  TrendingUp,
  Target,
  Image as ImageIcon,
  Flame,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import './header.css';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const Header: React.FC = () => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  // حالة المستخدم وصورة الحساب
  const [user, setUser] = useState<any>(null);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // التحقق من وجود المستخدم مسجل الدخول في localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsUserDropdownOpen(false);
    window.location.href = '/';
  };

  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 6,
    hours: 8,
    minutes: 16,
    seconds: 0
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCloseSearch = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsSearchOpen(false);
      setIsClosing(false);
    }, 200);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        if (isSearchOpen && !isClosing) {
          handleCloseSearch();
        }
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSearchOpen, isClosing]);

  const padZero = (num: number) => String(num).padStart(2, '0');

  const toggleDropdown = (menuName: string) => {
    setActiveDropdown(prev => (prev === menuName ? null : menuName));
  };

  const toggleSearch = () => {
    if (isSearchOpen) {
      handleCloseSearch();
    } else {
      setIsSearchOpen(true);
    }
  };

  return (
    <header className="aleo-header" dir="ltr">
      {/* 1. Top Announcement Banner */}
      <div className="top-banner">
        <div className="countdown-timer" dir="ltr">
          <span className="timer-box">{padZero(timeLeft.days)}d</span>
          <span className="timer-colon">:</span>
          <span className="timer-box">{padZero(timeLeft.hours)}h</span>
          <span className="timer-colon">:</span>
          <span className="timer-box">{padZero(timeLeft.minutes)}m</span>
        </div>
        
        <span className="banner-text">until next Live Pitch Session</span>
        <span className="banner-highlight">Random Match with Top VCs & Angel Investors</span>

        <button className="btn-participate">Participate</button>
      </div>

      {/* 2. Main Navigation Bar */}
      <nav className="main-nav">
        <div className="nav-container">
          
          <div className="nav-left-group">
            <Link to="/" className="picsart-logo">
              <span className="logo-brand">Live-Aleo</span>
            </Link>

            <div className="desktop-menu">
              {/* 1. Matchmaking Engine */}
              <div 
                className={`nav-item-dropdown ${activeDropdown === 'match' ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveDropdown('match')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button 
                  className="dropdown-trigger"
                  onClick={() => toggleDropdown('match')}
                >
                  Live Match
                  <ChevronDown className="chevron-icon" />
                </button>
                <div className="dropdown-menu w-64">
                  <a href="#" className="dropdown-link">
                    {/* تم تعديل لون الأيقونة وتنسيقها */}
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Zap style={{ color: '#eab308' }} size={18} />
                    </div>
                    <div>
                      <div className="dropdown-title">Random Stream</div>
                      <div className="dropdown-desc">Instant 1-on-1 live matching</div>
                    </div>
                  </a>
                  <a href="#" className="dropdown-link">
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Target style={{ color: '#3b82f6' }} size={18} />
                    </div>
                    <div>
                      <div className="dropdown-title">Targeted Pitch</div>
                      <div className="dropdown-desc">Match by country & industry</div>
                    </div>
                  </a>
                </div>
              </div>

              {/* 2. Investors Network */}
              <div 
                className={`nav-item-dropdown ${activeDropdown === 'investors' ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveDropdown('investors')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button 
                  className="dropdown-trigger"
                  onClick={() => toggleDropdown('investors')}
                >
                  Investors
                  <ChevronDown className="chevron-icon" />
                </button>
                <div className="dropdown-menu w-64">
                  <a href="#" className="dropdown-link">
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Briefcase style={{ color: '#22c55e' }} size={18} />
                    </div>
                    <div>
                      <div className="dropdown-title">Venture Capitalists</div>
                      <div className="dropdown-desc">Connect with verified VC firms</div>
                    </div>
                  </a>
                  <a href="#" className="dropdown-link">
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Crown style={{ color: '#a855f7' }} size={18} />
                    </div>
                    <div>
                      <div className="dropdown-title">Angel Investors</div>
                      <div className="dropdown-desc">High-net-worth individual backers</div>
                    </div>
                  </a>
                </div>
              </div>

              {/* 3. Global Filters */}
              <div 
                className={`nav-item-dropdown ${activeDropdown === 'filters' ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveDropdown('filters')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button 
                  className="dropdown-trigger"
                  onClick={() => toggleDropdown('filters')}
                >
                  Geo & Target
                  <ChevronDown className="chevron-icon" />
                </button>
                <div className="dropdown-menu w-64">
                  <a href="#" className="dropdown-link">
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Globe style={{ color: '#06b6d4' }} size={18} />
                    </div>
                    <div>
                      <div className="dropdown-title">Country Selection</div>
                      <div className="dropdown-desc">Filter streams by region</div>
                    </div>
                  </a>
                  <a href="#" className="dropdown-link">
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sliders style={{ color: '#f97316' }} size={18} />
                    </div>
                    <div>
                      <div className="dropdown-title">Role Preferences</div>
                      <div className="dropdown-desc">Founders, mentors, or backers</div>
                    </div>
                  </a>
                </div>
              </div>

              {/* 4. Pitch Sessions */}
              <div 
                className={`nav-item-dropdown ${activeDropdown === 'sessions' ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveDropdown('sessions')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button 
                  className="dropdown-trigger"
                  onClick={() => toggleDropdown('sessions')}
                >
                  Pitch Rooms
                  <ChevronDown className="chevron-icon" />
                </button>
                <div className="dropdown-menu w-64">
                  <a href="#" className="dropdown-link">
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Video style={{ color: '#ef4444' }} size={18} />
                    </div>
                    <div>
                      <div className="dropdown-title">Public Arena</div>
                      <div className="dropdown-desc">Live open pitch broadcasts</div>
                    </div>
                  </a>
                  <a href="#" className="dropdown-link">
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp style={{ color: '#10b981' }} size={18} />
                    </div>
                    <div>
                      <div className="dropdown-title">Private Deal Rooms</div>
                      <div className="dropdown-desc">Encrypted 1-on-1 pitch sessions</div>
                    </div>
                  </a>
                </div>
              </div>

              <a href="#" className="nav-link-badge">
                Precision Pass
                <span className="badge-save-purple">Pay Per Match</span>
              </a>
            </div>
          </div>

          {/* User Actions */}
          <div className="desktop-actions">
            <div className="search-box-wrapper" ref={searchRef}>
              {isSearchOpen ? (
                <div className={`picsart-search-bar ${isClosing ? 'closing' : 'opening'}`}>
                  <Search size={18} className="search-input-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search anything..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <button className="btn-action-icon" title="Upload Pitch / Image">
                    <ImageIcon size={18} />
                  </button>

                  <div className={`trending-search-popover ${isClosing ? 'closing' : 'opening'}`}>
                    <div className="trending-title">
                      <Flame size={16} className="icon-flame" />
                      Trending Searches
                    </div>
                    <div className="trending-grid">
                      <div className="trending-tag">SaaS VCs</div>
                      <div className="trending-tag">Fintech Pitch</div>
                      <div className="trending-tag">AI Startups</div>
                      <div className="trending-tag">Angel Network</div>
                    </div>
                  </div>
                </div>
              ) : (
                <button className="btn-icon-search" onClick={toggleSearch}>
                  <Search size={22} />
                </button>
              )}
            </div>
            
            <button className="btn-start-create">Start Live Match</button>
            
            {/* عرض صورة البروفايل أو زر تسجيل الدخول */}
            {user ? (
              <div className="user-profile-menu-container" ref={userMenuRef} style={{ position: 'relative' }}>
                <button 
                  onClick={() => setIsUserDropdownOpen(prev => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#374151',
                    border: '2px solid #4b5563',
                    color: '#ffffff',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s'
                  }}
                  title={user.fullName || user.email || 'User Profile'}
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <UserIcon size={20} />
                  )}
                </button>

                {isUserDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '50px',
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    width: '200px',
                    zIndex: 1000,
                    padding: '8px 0',
                    color: '#f3f4f6'
                  }}>
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid #374151', fontSize: '13px' }}>
                      <div style={{ fontWeight: '600', color: '#fff' }}>{user.fullName || 'User'}</div>
                      <div style={{ color: '#9ca3af', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                    </div>
                    <button 
                      onClick={handleLogout}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '10px 16px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '14px',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="btn-login-outline">
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Navigation Controls */}
          <div className="mobile-controls">
            {isSearchOpen ? (
              <div className={`mobile-search-bar ${isClosing ? 'closing' : 'opening'}`}>
                <input
                  type="text"
                  className="mobile-search-input"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            ) : (
              <button className="btn-icon-search" onClick={toggleSearch}>
                <Search size= {20} />
              </button>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;