import React, { useState } from 'react';
import { 
  Zap, 
  Globe, 
  MapPin, 
  Calendar, 
  CheckCircle, 
  Share2, 
  Award, 
  Star,
  ShieldCheck,
  User as UserIcon,
  Mail
} from 'lucide-react';
import { useUserProfile } from './hooks/useUserProfile';
import './Profile.css';

export const ProfilePage: React.FC = () => {
  const { data, isLoading, error } = useUserProfile();
  const [activeTab, setActiveTab] = useState<'content' | 'reviews' | 'about'>('content');

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#121216', color: '#fff' }}>
        <p>Loading user profile...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#121216', color: '#ff22ff', gap: '1rem' }}>
        <ShieldCheck size={48} />
        <h2>Access Denied / Not Logged In</h2>
        <p style={{ color: '#a1a1aa' }}>Please sign in to view your profile dashboard.</p>
      </div>
    );
  }

  const { profile: user, contents = [], primaryColor = '#e056fd' } = data;

  return (
    <div className="profile-page-container" dir="ltr">
      {/* Header Area */}
      <div className="profile-hero">
        <div className="profile-cover" style={{ background: `linear-gradient(135deg, ${primaryColor}22 0%, #121216 100%)` }} />
        
        <div className="profile-header-wrapper">
          <div className="profile-header-content">
            <div className="profile-avatar-group">
              <div className="profile-avatar-wrapper">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.fullName} className="profile-avatar-img" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <div className="profile-avatar-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e24', color: '#fff', width: '100%', height: '100%', borderRadius: '50%' }}>
                    <UserIcon size={40} />
                  </div>
                )}
                {user.isOnlineLive && (
                  <div className="live-badge-status">
                    <span className="live-dot" /> Live
                  </div>
                )}
              </div>

              <div className="profile-identity">
                <h1>
                  {user.fullName}
                  {user.isVerified && <CheckCircle size={20} className="verified-badge" />}
                </h1>
                <p className="profile-role" style={{ textTransform: 'capitalize' }}>{user.role}</p>
              </div>
            </div>

            <div className="profile-actions">
              <button className="btn-secondary-action">
                <Share2 size={16} /> Share
              </button>
              <button className="btn-pitch-live" style={{ background: primaryColor }}>
                <Zap size={18} /> Connect
              </button>
            </div>
          </div>

          {/* Quick Bio & Meta */}
          <div className="profile-bio-box">
            {user.bio && <p className="profile-bio-text">{user.bio}</p>}
            <div className="profile-meta-row">
              {user.email && (
                <div className="meta-item">
                  <Mail size={15} /> {user.email}
                </div>
              )}
              {user.location && (
                <div className="meta-item">
                  <MapPin size={15} /> {user.location}
                </div>
              )}
              {user.website && (
                <div className="meta-item">
                  <Globe size={15} /> <a href={user.website} target="_blank" rel="noreferrer" style={{ color: primaryColor, textDecoration: 'none' }}>Website / Channel</a>
                </div>
              )}
              {user.joinedDate && (
                <div className="meta-item">
                  <Calendar size={15} /> Joined {user.joinedDate}
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Stats */}
          {user.stats && (
            <div className="stats-ribbon">
              {user.stats.stat1Label && (
                <div className="stat-box">
                  <span className="stat-number highlight" style={{ color: primaryColor }}>{user.stats.stat1Value || 0}</span>
                  <span className="stat-label">{user.stats.stat1Label}</span>
                </div>
              )}
              {user.stats.stat2Label && (
                <div className="stat-box">
                  <span className="stat-number">{user.stats.stat2Value || 0}</span>
                  <span className="stat-label">{user.stats.stat2Label}</span>
                </div>
              )}
              {user.stats.stat3Label && (
                <div className="stat-box">
                  <span className="stat-number">{user.stats.stat3Value || 0}</span>
                  <span className="stat-label">{user.stats.stat3Label}</span>
                </div>
              )}
              {user.stats.stat4Label && (
                <div className="stat-box">
                  <span className="stat-number">{user.stats.stat4Value || 0}</span>
                  <span className="stat-label">{user.stats.stat4Label}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid Content Layout */}
      <div className="profile-main-layout">
        <aside>
          {user.targetIndustry && (
            <div className="dark-card">
              <h3 className="card-header-title">
                <ShieldCheck size={18} style={{ color: primaryColor }} /> 
                Target & Focus
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: '0 0 1rem 0' }}>
                Category: <strong style={{ color: '#fff' }}>{user.targetIndustry}</strong>
              </p>
              {user.focusAreas && user.focusAreas.length > 0 && (
                <div className="tag-cloud">
                  {user.focusAreas.map((area, idx) => (
                    <span key={idx} className="tech-tag" style={{ borderColor: `${primaryColor}66`, color: primaryColor }}>
                      {area}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {user.skills && user.skills.length > 0 && (
            <div className="dark-card">
              <h3 className="card-header-title">
                <Award size={18} style={{ color: '#eab308' }} /> 
                Tech Stack & Skills
              </h3>
              <div className="tag-cloud">
                {user.skills.map((skill, idx) => (
                  <span key={idx} className="tech-tag">{skill}</span>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main>
          <div className="dark-card">
            <div className="tab-navigation">
              <button 
                className={`tab-btn ${activeTab === 'content' ? 'active' : ''}`}
                onClick={() => setActiveTab('content')}
              >
                Projects & Demos ({contents.length})
              </button>
              <button 
                className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
                onClick={() => setActiveTab('reviews')}
              >
                Peer Reviews
              </button>
              <button 
                className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
                onClick={() => setActiveTab('about')}
              >
                Overview
              </button>
            </div>

            {/* Content Tab */}
            {activeTab === 'content' && (
              <div>
                {contents.length === 0 ? (
                  <p style={{ color: '#a1a1aa', textAlign: 'center', padding: '2rem 0' }}>No content or projects published yet.</p>
                ) : (
                  <div className="pitch-grid">
                    {contents.map((item) => (
                      <div key={item.id} className="pitch-card">
                        {item.thumbnail && (
                          <div className="pitch-thumbnail">
                            <img src={item.thumbnail} alt={item.title} />
                            {item.duration && <span className="pitch-duration">{item.duration}</span>}
                          </div>
                        )}
                        <div className="pitch-content">
                          <h4 className="pitch-title">{item.title}</h4>
                          <p className="pitch-desc">
                            {item.category ? `${item.category} • ` : ''}
                            {item.views !== undefined ? `${item.views.toLocaleString()} Views` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div style={{ color: '#a1a1aa', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                <Star size={32} style={{ color: '#eab308', marginBottom: '0.5rem' }} />
                <p style={{ color: '#fff', fontWeight: 600 }}>Verified Community Profile</p>
                <p>No reviews posted yet.</p>
              </div>
            )}

            {/* About Tab */}
            {activeTab === 'about' && (
              <div style={{ color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <p>{user.bio || 'No description provided.'}</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProfilePage;