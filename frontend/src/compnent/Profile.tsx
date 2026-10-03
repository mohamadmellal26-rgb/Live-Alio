import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
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
  X,
  Loader
} from 'lucide-react';
import { useUserProfile } from './hooks/useUserProfile';
import LiveCallNotification, { CallRequestData } from './LiveCallNotification';
import './Profile.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://live-alio-1.onrender.com';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { username: pathUsername } = useParams<{ username?: string }>();
  const [searchParams] = useSearchParams();
  const queryUsername = searchParams.get('user') || searchParams.get('profile') || searchParams.get('identifier');

  const targetUsername = pathUsername || queryUsername || undefined;
  const { data, isLoading, error } = useUserProfile(targetUsername);

  const [activeTab, setActiveTab] = useState<'content' | 'reviews' | 'about'>('content');
  const [imgError, setImgError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddContentModal, setShowAddContentModal] = useState(false);
  
  // حالات الاتصال المباشر والـ WebSockets
  const [isCalling, setIsCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallRequestData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // قراءة بيانات الجلسة الحالية
  const storedUserRaw = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  let currentUser: any = null;
  if (storedUserRaw) {
    try {
      currentUser = JSON.parse(storedUserRaw);
    } catch (e) {
      currentUser = null;
    }
  }

  // إقامة اتصال WebSocket للاستماع للاتصالات الواردة وإرسال الطلبات
  useEffect(() => {
    if (!token) return;

    const wsUrl = `wss://live-alio-1.onrender.com/ws/live?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // استقبال طلب اتصال فريد موجّه للمستخدم الحالي
        if (message.type === 'incoming_call_request') {
          setIncomingCall({
            id: message.callId,
            callerName: message.callerName,
            callerRole: message.callerRole,
            callerAvatarUrl: message.callerAvatarUrl,
            note: message.note || 'مرحباً، يرغب هذا المستخدم بالاتصال بك مباشرة!'
          });
        }

        // عند قبول الطرف الآخر للاتصال -> الانتقال فوراً للداشبورد لبدء الـ WebRTC Call
        if (message.type === 'call_accepted') {
          setIsCalling(false);
          navigate('/dashboard', { state: { autoConnectPeerId: message.peerId, peerName: message.peerName } });
        }

        // عند رفض الطرف الآخر للاتصال
        if (message.type === 'call_declined') {
          setIsCalling(false);
          alert('تم رفض طلب الاتصال من قبل المستلم.');
        }
      } catch (err) {
        console.error('Error parsing WS message in Profile:', err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [token, navigate]);

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

  const isOwner = Boolean(
    token && currentUser && user && (
      (currentUser.id && String(currentUser.id) === String(user.id)) ||
      (currentUser._id && String(currentUser._id) === String(user.id)) ||
      (currentUser.username && (user as any).username && currentUser.username.toLowerCase() === (user as any).username.toLowerCase()) ||
      (currentUser.email && user.email && currentUser.email.toLowerCase() === user.email.toLowerCase())
    )
  );

  const getFullImageUrl = (path?: string) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const avatarPath = user.avatarUrl || (user as unknown as { avatar?: string }).avatar;
  const avatarSrc = getFullImageUrl(avatarPath);

  // دالة التعامل مع زر Connect إرسال الإشعار للمستلم
  const handleConnectClick = () => {
    if (!token) {
      alert('يرجى تسجيل الدخول أولاً للاتصال بالمستخدم.');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsCalling(true);
      wsRef.current.send(JSON.stringify({
        type: 'send_call_request',
        targetUserId: user.id,
        callerName: currentUser?.fullName || currentUser?.username || 'مستخدم',
        callerRole: currentUser?.role || 'User',
        callerAvatarUrl: currentUser?.avatarUrl
      }));
    } else {
      alert('خطأ في الاتصال بالخادم، يرجى إعادة المحاولة.');
    }
  };

  // قبول اتصال وارد من طرف مستخدم آخر والتوجيه للداشبورد
  const handleAcceptCall = (requestId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'accept_call_request',
        callId: requestId
      }));
    }
    setIncomingCall(null);
    navigate('/dashboard', { state: { activeCallId: requestId, peerName: incomingCall?.callerName } });
  };

  // رفض اتصال وارد
  const handleDeclineCall = (requestId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'decline_call_request',
        callId: requestId
      }));
    }
    setIncomingCall(null);
  };

  return (
    <div className="profile-page-container" dir="ltr">
      {/* إشعار الاتصال الوارد */}
      <LiveCallNotification 
        request={incomingCall} 
        onAccept={handleAcceptCall} 
        onDecline={handleDeclineCall} 
      />

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
                <button 
                  className="btn-pitch-live" 
                  onClick={handleConnectClick}
                  disabled={isCalling}
                  style={{ background: primaryColor, opacity: isCalling ? 0.7 : 1, cursor: isCalling ? 'not-allowed' : 'pointer' }}
                >
                  {isCalling ? <Loader className="animate-spin" size={18} /> : <Zap size={18} />} 
                  {isCalling ? ' Calling...' : ' Connect'}
                </button>
              )}
            </div>
          </div>

          <div className="profile-bio-box">
            {user.bio && <p className="profile-bio-text">{user.bio}</p>}
            <div className="profile-meta-row">
              {user.email && <div className="meta-item"><Mail size={15} /> {user.email}</div>}
              {user.location && <div className="meta-item"><MapPin size={15} /> {user.location}</div>}
              {user.website && (
                <div className="meta-item">
                  <Globe size={15} /> <a href={user.website} target="_blank" rel="noreferrer" style={{ color: primaryColor, textDecoration: 'none' }}>Website / Channel</a>
                </div>
              )}
              {user.joinedDate && <div className="meta-item"><Calendar size={15} /> Joined {user.joinedDate}</div>}
            </div>
          </div>

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

      {/* Main Grid Layout */}
      <div className="profile-main-layout">
        <aside>
          {user.targetIndustry && (
            <div className="dark-card">
              <h3 className="card-header-title">
                <ShieldCheck size={18} style={{ color: primaryColor }} /> Target & Focus
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
                <Award size={18} style={{ color: '#eab308' }} /> Tech Stack & Skills
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

            {activeTab === 'reviews' && (
              <div style={{ color: '#a1a1aa', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                <Star size={32} style={{ color: '#eab308', marginBottom: '0.5rem' }} />
                <p style={{ color: '#fff', fontWeight: 600 }}>Verified Community Profile</p>
                <p>No reviews posted yet.</p>
              </div>
            )}

            {activeTab === 'about' && (
              <div style={{ color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <p>{user.bio || 'No description provided.'}</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Edit Modal */}
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