import React, { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
  Mail,
  Edit3,
  Plus,
  X
} from 'lucide-react';
import { useUserProfile } from './hooks/useUserProfile';
import './Profile.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://live-alio-1.onrender.com';

export const ProfilePage: React.FC = () => {
  const { username: pathUsername } = useParams<{ username?: string }>();
  const [searchParams] = useSearchParams();
  const queryUsername = searchParams.get('user') || searchParams.get('profile');

  // استخراج المستخدم المستهدف من المسار أو الاستعلام
  const targetUsername = pathUsername || queryUsername || undefined;

  const { data, isLoading, error } = useUserProfile(targetUsername);

  const [activeTab, setActiveTab] = useState<'content' | 'reviews' | 'about'>('content');
  const [imgError, setImgError] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [showAddContentModal, setShowAddContentModal] = useState(false);

  // 1. قراءة بيانات المستخدم الحالي المسجل في الجلسة المحلية (Local Storage)
  const storedUserRaw = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  const currentUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#121216', color: '#fff' }}>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error || !data || !data.profile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#121216', color: '#ff22ff', gap: '1rem' }}>
        <ShieldCheck size={48} />
        <h2>Profile Not Found</h2>
        <p style={{ color: '#a1a1aa' }}>
          {targetUsername ? `User "${targetUsername}" does not exist or profile is private.` : 'Please sign in to view your profile dashboard.'}
        </p>
      </div>
    );
  }

  const { profile: user, contents = [], primaryColor = '#e056fd' } = data;

  // 2. تحديد إذا كان الزائر هو المالك الحقيقي للبروفايل
  const isOwner = Boolean(
    token && currentUser && (
      (currentUser.id && currentUser.id === user.id) ||
      (currentUser._id && currentUser._id === user.id) ||
      (currentUser.email && user.email && currentUser.email.toLowerCase() === user.email.toLowerCase())
    )
  );

  const getFullImageUrl = (path?: string) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const avatarPath = user.avatarUrl || (user as unknown as { avatar?: string }).avatar;
  const avatarSrc = getFullImageUrl(avatarPath);

  return (
    <div className="profile-page-container" dir="ltr">
      {/* Header Area */}
      <div className="profile-hero">
        <div className="profile-cover" style={{ background: `linear-gradient(135deg, ${primaryColor}22 0%, #121216 100%)` }} />
        
        <div className="profile-header-wrapper">
          <div className="profile-header-content">
            <div className="profile-avatar-group">
              <div className="profile-avatar-wrapper" style={{ position: 'relative' }}>
                {avatarSrc && !imgError ? (
                  <img 
                    src={avatarSrc} 
                    alt={user.fullName} 
                    className="profile-avatar-img" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    onError={() => setImgError(true)}
                  />
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

            {/* الأزرار الديناميكية: تظهر Edit و Add فقط للـ Owner، أما باقي الزوار فيظهر لهم زر Connect */}
            <div className="profile-actions" style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary-action">
                <Share2 size={16} /> Share
              </button>

              {isOwner ? (
                <>
                  <button 
                    className="btn-secondary-action" 
                    onClick={() => setIsEditing(true)}
                    style={{ borderColor: primaryColor, color: '#fff' }}
                  >
                    <Edit3 size={16} /> Edit Profile
                  </button>

                  <button 
                    className="btn-pitch-live" 
                    onClick={() => setShowAddContentModal(true)}
                    style={{ background: primaryColor }}
                  >
                    <Plus size={18} /> Add Content
                  </button>
                </>
              ) : (
                <button className="btn-pitch-live" style={{ background: primaryColor }}>
                  <Zap size={18} /> Connect
                </button>
              )}
            </div>
          </div>

          {/* Bio & Information */}
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

          {/* Stats Ribbon */}
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
            </div>
          )}
        </div>
      </div>

      {/* Main Grid Content */}
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
                  <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                    <p style={{ color: '#a1a1aa', marginBottom: '1rem' }}>No content or projects published yet.</p>
                    {isOwner && (
                      <button 
                        className="btn-pitch-live" 
                        onClick={() => setShowAddContentModal(true)}
                        style={{ background: primaryColor }}
                      >
                        <Plus size={16} /> Upload First Project
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="pitch-grid">
                    {contents.map((item) => (
                      <div key={item.id} className="pitch-card">
                        {item.thumbnail && (
                          <div className="pitch-thumbnail">
                            <img src={getFullImageUrl(item.thumbnail) || ''} alt={item.title} />
                            {item.duration && <span className="pitch-duration">{item.duration}</span>}
                          </div>
                        )}
                        <div className="pitch-content">
                          <h4 className="pitch-title">{item.title}</h4>
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

      {/* Edit Profile Modal */}
      {isEditing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e1e24', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '500px', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Edit Profile</h3>
              <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>Profile editing feature coming soon.</p>
            <button onClick={() => setIsEditing(false)} style={{ marginTop: '1rem', background: primaryColor, color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add Content Modal */}
      {showAddContentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e1e24', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '500px', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Add New Content</h3>
              <button onClick={() => setShowAddContentModal(false)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>Upload project or demo video interface coming soon.</p>
            <button onClick={() => setShowAddContentModal(false)} style={{ marginTop: '1rem', background: primaryColor, color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;