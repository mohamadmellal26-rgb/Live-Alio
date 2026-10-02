import React, { useState } from 'react';
import './Dashboard.css';

interface MatchFilter {
  targetType: 'All Users' | 'Verified Only' | 'Creators';
  ageFilter: 'All' | '18+' | 'Teens';
  genderFilter: 'Both' | 'Male' | 'Female';
}

interface RecentMatch {
  id: string;
  name: string;
  role: string;
  avatar: string;
  matchedAt: string;
  duration: string;
  ageGroup: string;
  status: 'Online' | 'Offline';
}

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'match' | 'history' | 'favorites'>('match');
  const [isSearching, setIsSearching] = useState(false);

  // Match Preferences
  const [filters, setFilters] = useState<MatchFilter>({
    targetType: 'All Users',
    ageFilter: '18+',
    genderFilter: 'Both',
  });

  // Clean Mock History Data
  const [recentMatches] = useState<RecentMatch[]>([
    { id: '1', name: 'User_4920', role: 'Developer', avatar: '💻', matchedAt: '10 mins ago', duration: '12:40', ageGroup: '18+', status: 'Online' },
    { id: '2', name: 'User_1082', role: 'Designer', avatar: '🎨', matchedAt: '1 hour ago', duration: '05:15', ageGroup: '18+', status: 'Online' },
    { id: '3', name: 'User_8831', role: 'Member', avatar: '🌐', matchedAt: 'Yesterday', duration: '22:10', ageGroup: 'All', status: 'Offline' },
  ]);

  const handleStartMatching = () => {
    setIsSearching(true);
    // Logic for WebRTC / Socket matching here
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <span className="logo-brand">Live-Alio</span>
          <span className="badge-pro">1v1 CAM</span>
        </div>

        <button 
          className={`btn-start-create btn-new-project ${isSearching ? 'searching-pulse' : ''}`}
          onClick={handleStartMatching}
        >
          {isSearching ? 'Searching Match...' : 'Start 1v1 Match'}
        </button>

        <nav className="sidebar-nav">
          <div className="nav-group-title">NAVIGATION</div>
          <button
            className={`sidebar-nav-item ${activeTab === 'match' ? 'active' : ''}`}
            onClick={() => setActiveTab('match')}
          >
            Live 1v1 Room
          </button>
          <button
            className={`sidebar-nav-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Match History
          </button>

          <div className="nav-group-title margin-top">MATCH FILTERS</div>
          
          {/* Target Type Filter */}
          <div className="filter-group">
            <label className="filter-label">Match With:</label>
            <select 
              className="filter-select"
              value={filters.targetType}
              onChange={(e) => setFilters({ ...filters, targetType: e.target.value as any })}
            >
              <option value="All Users">All Users</option>
              <option value="Verified Only">Verified Profiles</option>
              <option value="Creators">Content Creators</option>
            </select>
          </div>

          {/* Age Group Filter */}
          <div className="filter-group">
            <label className="filter-label">Age Group:</label>
            <select 
              className="filter-select"
              value={filters.ageFilter}
              onChange={(e) => setFilters({ ...filters, ageFilter: e.target.value as any })}
            >
              <option value="All">All Ages</option>
              <option value="18+">18+ Adult Room</option>
              <option value="Teens">Teens Only</option>
            </select>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">M</div>
            <div className="user-info">
              <span className="user-name">Mohamad</span>
              <span className="user-email">mohamad@alio.dev</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* Top Header */}
        <header className="dashboard-header">
          <div className="match-status-indicator">
            <span className="status-dot online"></span>
            <span>Online Users: <strong>14,280</strong></span>
          </div>

          <div className="header-actions">
            <button className="btn-icon">Cam Settings</button>
            <button className="btn-login-outline btn-sm">Upgrade Account</button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="dashboard-content">
          
          {/* 1v1 Dual Camera Studio Canvas */}
          <div className="cam-studio-wrapper">
            {/* Local Video Box (User) */}
            <div className="cam-box local-cam">
              <span className="cam-label">YOU (Mohamad)</span>
              <div className="cam-placeholder">
                <div className="cam-avatar">👤</div>
                <p>Camera Active</p>
              </div>
            </div>

            {/* Remote Video Box (Matched Partner) */}
            <div className={`cam-box remote-cam ${isSearching ? 'searching' : ''}`}>
              <span className="cam-label">
                {isSearching ? 'SEARCHING FOR A MATCH...' : 'MATCHED PARTNER'}
              </span>
              
              {isSearching ? (
                <div className="search-loader">
                  <div className="spinner"></div>
                  <p>Finding a match ({filters.targetType})...</p>
                  <button className="btn-cancel" onClick={() => setIsSearching(false)}>Cancel</button>
                </div>
              ) : (
                <div className="cam-placeholder">
                  <div className="cam-avatar glow">📷</div>
                  <p>Click "Start 1v1 Match" to start session</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Control Bar */}
          <div className="match-controls-bar">
            <button className="btn-control btn-mic">Mute</button>
            <button className="btn-control btn-video">Stop Video</button>
            <button className="btn-start-create btn-next" onClick={handleStartMatching}>
              Next Match
            </button>
            <button className="btn-control btn-report">Report</button>
          </div>

          {/* Recent 1v1 Connections */}
          <div className="recent-section">
            <h3>Recent Connections</h3>
            <div className="projects-grid">
              {recentMatches.map((match) => (
                <div className="project-card" key={match.id}>
                  <div className="project-thumbnail 1v1-thumb">
                    <span className="status-badge" data-status={match.status}>
                      {match.status}
                    </span>
                    <div className="thumb-preview-icon">{match.avatar}</div>
                  </div>
                  <div className="project-details">
                    <div className="project-header">
                      <h4>{match.name}</h4>
                      <button className="btn-more">⋮</button>
                    </div>
                    <span className="project-type">{match.role}</span>
                    <div className="project-meta">
                      <span className="age-tag">{match.ageGroup}</span>
                      <span>•</span>
                      <span>{match.duration}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Dashboard;