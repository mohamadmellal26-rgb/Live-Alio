import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Globe, 
  MapPin, 
  Calendar, 
  CheckCircle, 
  Share2, 
  Award, 
  ShieldCheck,
  User as UserIcon,
  Mail,
  Edit3,
  Plus,
  X,
  Loader,
  FileText,
  Upload,
  ExternalLink,
  Save,
  Camera
} from 'lucide-react';
import { useUserProfile } from './hooks/useUserProfile';
import LiveCallNotification, { type CallRequestData } from './LiveCallNotification';
import './Profile.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://live-alio-1.onrender.com';

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  type?: 'video' | 'project' | 'document';
  duration?: string;
  externalLink?: string;
  createdAt?: string;
}

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { username: pathUsername } = useParams<{ username?: string }>();
  const [searchParams] = useSearchParams();
  const queryUsername = searchParams.get('user') || searchParams.get('profile') || searchParams.get('identifier');

  const targetUsername = pathUsername || queryUsername || undefined;
  const { data, isLoading, error, refetch } = useUserProfile(targetUsername) as any;

  const [imgError, setImgError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddContentModal, setShowAddContentModal] = useState(false);

  // حالات إدارة وتفاصيل المحتوى المضاف
  const [, setContentList] = useState<ContentItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<ContentItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // نمذجة بيانات إضافة محتوى جديد
  const [newContent, setNewContent] = useState({
    title: '',
    description: '',
    type: 'video' as 'video' | 'project' | 'document',
    externalLink: '',
    mediaFile: null as File | null,
    thumbnailFile: null as File | null
  });

  // حالات بيانات التعديل الخاصة بالحساب الشخصي
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    role: '',
    bio: '',
    location: '',
    website: '',
    skills: '',
    focusAreas: '',
    targetIndustry: '',
    avatarFile: null as File | null
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // حالات الاتصال المباشر والـ WebSockets
  const [isCalling, setIsCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallRequestData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // قراءة بيانات الجلسة الحالية بطريقة آمنة
  const [currentUser, setCurrentUser] = useState<any>(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const storedUserRaw = localStorage.getItem('user');
    if (storedUserRaw) {
      try {
        setCurrentUser(JSON.parse(storedUserRaw));
      } catch (e) {
        console.error('Failed to parse user session:', e);
        setCurrentUser(null);
      }
    }
  }, []);

  // دالة بناء رابط الصورة أو الوسائط الكامل
  const getFullImageUrl = useCallback((path?: string) => {
    if (!path || typeof path !== 'string') return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }
    const cleanBase = API_BASE_URL.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    return `${cleanBase}/${cleanPath}`;
  }, []);

  const user = data?.profile || data;

  // تعبئة نموذج التعديل بالبيانات الحالية عند فتح الـ Modal
  useEffect(() => {
    if (user) {
      setEditFormData({
        fullName: user.fullName || '',
        role: user.role || '',
        bio: user.bio || '',
        location: user.location || '',
        website: user.website || '',
        skills: Array.isArray(user.skills) ? user.skills.join(', ') : (user.skills || ''),
        focusAreas: Array.isArray(user.focusAreas) ? user.focusAreas.join(', ') : (user.focusAreas || ''),
        targetIndustry: user.targetIndustry || '',
        avatarFile: null
      });
    }
  }, [user]);

  // مزامنة المحتوى المستلم من الـ API
  useEffect(() => {
    if (data?.contents) {
      setContentList(data.contents);
    } else if ((data as any)?.profile?.contents) {
      setContentList((data as any).profile.contents);
    }
  }, [data]);

  // فحص حقول صورة البروفايل
  const avatarPath = 
    user?.avatarUrl || 
    user?.avatar || 
    user?.profilePicture || 
    user?.photo ||
    (data as any)?.avatarUrl ||
    (data as any)?.avatar;

  const avatarSrc = getFullImageUrl(avatarPath);

  useEffect(() => {
    setImgError(false);
  }, [avatarSrc, targetUsername]);

  // إقامة اتصال WebSocket
  useEffect(() => {
    if (!token) return;

    const wsUrl = `wss://live-alio-1.onrender.com/ws/live?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'incoming_call_request') {
          setIncomingCall({
            id: message.callId,
            callerName: message.callerName || 'Unknown User',
            callerRole: message.callerRole,
            callerAvatarUrl: message.callerAvatarUrl,
            note: message.note || ''
          });
        }

        if (message.type === 'call_accepted') {
          setIsCalling(false);
          navigate('/dashboard', { 
            state: { 
              autoConnectPeerId: message.peerId, 
              activeCallId: message.callId,
              roomId: message.callId,
              peerName: message.peerName || 'Partner' 
            } 
          });
        }

        if (message.type === 'call_declined') {
          setIsCalling(false);
          alert(message.message || 'تم رفض طلب الاتصال من قبل المستلم.');
        }
      } catch (err) {
        console.error('Error parsing WS message in Profile:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      setIsCalling(false);
    };

    return () => {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [token, navigate]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#121216', color: '#fff' }}>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error || !data || !user) {
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

  const { primaryColor = '#e056fd' } = data;
  const targetUserId = String(user.id || user._id || '');

  const isOwner = Boolean(
    token && currentUser && (
      (currentUser.id && String(currentUser.id) === targetUserId) ||
      (currentUser._id && String(currentUser._id) === targetUserId) ||
      (currentUser.username && user.username && currentUser.username.toLowerCase() === user.username.toLowerCase()) ||
      (currentUser.email && user.email && currentUser.email.toLowerCase() === user.email.toLowerCase())
    )
  );

  const handleConnectClick = () => {
    if (!token) {
      alert('يرجى تسجيل الدخول أولاً للاتصال بالمستخدم.');
      return;
    }

    if (!targetUserId) {
      alert('عذراً، تعذر تحديد معرف المستخدم المستهدف.');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsCalling(true);
      wsRef.current.send(JSON.stringify({
        type: 'send_call_request',
        targetUserId: targetUserId,
        callerName: currentUser?.fullName || currentUser?.username || 'مستخدم',
        callerRole: currentUser?.role || 'User',
        callerAvatarUrl: currentUser?.avatarUrl || currentUser?.avatar
      }));
    } else {
      alert('خطأ في الاتصال بالخادم، يرجى إعادة المحاولة.');
    }
  };

  const handleAcceptCall = (requestId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'accept_call_request',
        callId: requestId
      }));
    }
    const callerName = incomingCall?.callerName || 'Partner';
    setIncomingCall(null);
    navigate('/dashboard', { state: { roomId: requestId, activeCallId: requestId, peerName: callerName } });
  };

  const handleDeclineCall = (requestId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'decline_call_request',
        callId: requestId
      }));
    }
    setIncomingCall(null);
  };

  // دالة حفظ التعديلات المصححة بالكامل
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      const skillsArray = editFormData.skills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      
      const focusArray = editFormData.focusAreas
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      let response: Response;

      if (editFormData.avatarFile) {
        const formData = new FormData();
        formData.append('fullName', editFormData.fullName);
        formData.append('role', editFormData.role);
        formData.append('bio', editFormData.bio);
        formData.append('location', editFormData.location);
        formData.append('website', editFormData.website);
        formData.append('targetIndustry', editFormData.targetIndustry);
        formData.append('skills', JSON.stringify(skillsArray));
        formData.append('focusAreas', JSON.stringify(focusArray));
        formData.append('avatar', editFormData.avatarFile);

        response = await fetch(`${API_BASE_URL}/api/user/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      } else {
        const payload = {
          fullName: editFormData.fullName,
          role: editFormData.role,
          bio: editFormData.bio,
          location: editFormData.location,
          website: editFormData.website,
          targetIndustry: editFormData.targetIndustry,
          skills: skillsArray,
          focusAreas: focusArray
        };

        response = await fetch(`${API_BASE_URL}/api/user/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update profile');
      }

      const updatedRes = await response.json();

      if (currentUser) {
        const newUserData = { ...currentUser, ...(updatedRes.user || updatedRes) };
        localStorage.setItem('user', JSON.stringify(newUserData));
        setCurrentUser(newUserData);
      }

      if (refetch) refetch();
      setIsEditing(false);
      alert('تم تحديث البروفايل بنجاح!');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      alert(err.message || 'حدث خطأ أثناء حفظ البيانات، يرجى المحاولة لاحقاً.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // دالة رفع المحتوى إلى السيرفر
  const handleUploadContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.title.trim()) {
      alert('يرجى إدخال عنوان للمحتوى.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', newContent.title);
      formData.append('description', newContent.description);
      formData.append('type', newContent.type);
      if (newContent.externalLink) formData.append('externalLink', newContent.externalLink);
      if (newContent.mediaFile) formData.append('media', newContent.mediaFile);
      if (newContent.thumbnailFile) formData.append('thumbnail', newContent.thumbnailFile);

      const response = await fetch(`${API_BASE_URL}/api/content/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('فشل رفع المحتوى');
      }

      const result = await response.json();
      const createdItem: ContentItem = result.content || {
        id: result.id || String(Date.now()),
        title: newContent.title,
        description: newContent.description,
        type: newContent.type,
        externalLink: newContent.externalLink,
        mediaUrl: result.mediaUrl || (newContent.mediaFile ? URL.createObjectURL(newContent.mediaFile) : undefined),
        thumbnailUrl: result.thumbnailUrl || (newContent.thumbnailFile ? URL.createObjectURL(newContent.thumbnailFile) : undefined),
        createdAt: new Date().toISOString()
      };

      setContentList((prev) => [createdItem, ...prev]);
      setShowAddContentModal(false);
      setNewContent({
        title: '',
        description: '',
        type: 'video',
        externalLink: '',
        mediaFile: null,
        thumbnailFile: null
      });
    } catch (err) {
      console.error('Error uploading content:', err);
      alert('فشل رفع المحتوى للسيرفر. يرجى التحقق من الاتصال.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="profile-page-container" dir="ltr">
      <LiveCallNotification 
        request={incomingCall} 
        onAccept={handleAcceptCall} 
        onDecline={handleDeclineCall} 
      />

      <div className="profile-hero">
        <div className="profile-cover" style={{ background: `linear-gradient(135deg, ${primaryColor}22 0%, #121216 100%)` }} />
        
        <div className="profile-header-wrapper">
          <div className="profile-header-content">
            <div className="profile-avatar-group">
              <div className="profile-avatar-wrapper" style={{ position: 'relative', width: '110px', height: '110px' }}>
                {avatarSrc && !imgError ? (
                  <img 
                    key={avatarSrc}
                    src={avatarSrc} 
                    alt={user.fullName || 'User Avatar'} 
                    className="profile-avatar-img" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', border: '3px solid #1e1e24' }}
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="profile-avatar-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e24', color: '#fff', width: '100%', height: '100%', borderRadius: '50%', border: '3px solid #333' }}>
                    <UserIcon size={48} />
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
                  {user.focusAreas.map((area: string, idx: number) => (
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
                {user.skills.map((skill: string, idx: number) => (
                  <span key={idx} className="tech-tag">{skill}</span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Modal لعرض التفاصيل/الميديا */}
      {selectedMedia && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: '#18181c', borderRadius: '12px', width: '100%', maxWidth: '800px', overflow: 'hidden', border: '1px solid #27272a', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>{selectedMedia.title}</h3>
              <button onClick={() => setSelectedMedia(null)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', maxHeight: '500px', overflow: 'hidden' }}>
              {selectedMedia.mediaUrl ? (
                selectedMedia.type === 'video' || selectedMedia.mediaUrl.endsWith('.mp4') || selectedMedia.mediaUrl.endsWith('.webm') ? (
                  <video 
                    src={getFullImageUrl(selectedMedia.mediaUrl)} 
                    controls 
                    autoPlay 
                    style={{ width: '100%', maxHeight: '480px', objectFit: 'contain' }} 
                  />
                ) : (
                  <img 
                    src={getFullImageUrl(selectedMedia.mediaUrl)} 
                    alt={selectedMedia.title} 
                    style={{ width: '100%', maxHeight: '480px', objectFit: 'contain' }} 
                  />
                )
              ) : (
                <div style={{ padding: '3rem', color: '#a1a1aa', textAlign: 'center' }}>
                  <FileText size={48} style={{ marginBottom: '0.5rem' }} />
                  <p>No preview file attached.</p>
                </div>
              )}
            </div>

            <div style={{ padding: '1.25rem', overflowY: 'auto' }}>
              {selectedMedia.description && (
                <p style={{ color: '#d4d4d8', fontSize: '0.9rem', marginTop: 0, lineHeight: 1.6 }}>
                  {selectedMedia.description}
                </p>
              )}

              {selectedMedia.externalLink && (
                <a 
                  href={selectedMedia.externalLink} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: primaryColor, color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.5rem' }}
                >
                  <ExternalLink size={16} /> Open External Demo / Repository
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal إضافة محتوى جديد */}
      {showAddContentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e1e24', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '520px', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={18} style={{ color: primaryColor }} /> Add New Content
              </h3>
              <button onClick={() => setShowAddContentModal(false)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadContent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Title *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Real-time Video Analytics Demo"
                  value={newContent.title}
                  onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                  style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Content Type</label>
                <select
                  value={newContent.type}
                  onChange={(e) => setNewContent({ ...newContent, type: e.target.value as any })}
                  style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                >
                  <option value="video">Video Showcase</option>
                  <option value="project">Project / Portfolio</option>
                  <option value="document">Documentation / Article</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Description</label>
                <textarea 
                  rows={3}
                  placeholder="Provide details about your project or video pitch..."
                  value={newContent.description}
                  onChange={(e) => setNewContent({ ...newContent, description: e.target.value })}
                  style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>External Link (GitHub / Live Demo)</label>
                <input 
                  type="url" 
                  placeholder="https://..."
                  value={newContent.externalLink}
                  onChange={(e) => setNewContent({ ...newContent, externalLink: e.target.value })}
                  style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.8rem', marginBottom: '0.4rem' }}>Media File (Video/Img)</label>
                  <input 
                    type="file" 
                    accept="video/*,image/*"
                    onChange={(e) => setNewContent({ ...newContent, mediaFile: e.target.files?.[0] || null })}
                    style={{ fontSize: '0.75rem', color: '#a1a1aa', width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.8rem', marginBottom: '0.4rem' }}>Thumbnail</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setNewContent({ ...newContent, thumbnailFile: e.target.files?.[0] || null })}
                    style={{ fontSize: '0.75rem', color: '#a1a1aa', width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAddContentModal(false)}
                  style={{ background: '#27272a', color: '#fff', border: 'none', padding: '0.55rem 1.1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isUploading}
                  style={{ background: primaryColor, color: '#fff', border: 'none', padding: '0.55rem 1.1rem', borderRadius: '6px', cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {isUploading ? <Loader className="animate-spin" size={16} /> : <Upload size={16} />}
                  {isUploading ? 'Uploading...' : 'Publish Content'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal تعديل البروفايل */}
      {isEditing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e1e24', padding: '1.75rem', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #2a2a32', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={18} style={{ color: primaryColor }} /> Edit Profile Details
              </h3>
              <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  Profile Picture
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', background: '#121216', border: '1px solid #333' }}>
                    {editFormData.avatarFile ? (
                      <img src={URL.createObjectURL(editFormData.avatarFile)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      avatarSrc ? <img src={avatarSrc} alt="Current Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={30} style={{ margin: '15px' }} />
                    )}
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#27272a', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    <Camera size={16} /> Choose Photo
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={(e) => setEditFormData({ ...editFormData, avatarFile: e.target.files?.[0] || null })} 
                    />
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Full Name</label>
                  <input 
                    type="text" 
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Title / Role</label>
                  <input 
                    type="text" 
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    placeholder="e.g. Full-Stack Engineer"
                    style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Bio</label>
                <textarea 
                  rows={3}
                  value={editFormData.bio}
                  onChange={(e) => setEditFormData({ ...editFormData, bio: e.target.value })}
                  placeholder="Tell the community about yourself..."
                  style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Location</label>
                  <input 
                    type="text" 
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    placeholder="e.g. Algeria"
                    style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Website / Link</label>
                  <input 
                    type="url" 
                    value={editFormData.website}
                    onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                    placeholder="https://..."
                    style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Target Category / Industry</label>
                <input 
                  type="text" 
                  value={editFormData.targetIndustry}
                  onChange={(e) => setEditFormData({ ...editFormData, targetIndustry: e.target.value })}
                  placeholder="e.g. Software & Artificial Intelligence"
                  style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Skills (Comma Separated)</label>
                <input 
                  type="text" 
                  value={editFormData.skills}
                  onChange={(e) => setEditFormData({ ...editFormData, skills: e.target.value })}
                  placeholder="React, Go, C++, Python"
                  style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Focus Areas (Comma Separated)</label>
                <input 
                  type="text" 
                  value={editFormData.focusAreas}
                  onChange={(e) => setEditFormData({ ...editFormData, focusAreas: e.target.value })}
                  placeholder="Computer Vision, Web Architecture"
                  style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid #2a2a32', paddingTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsEditing(false)}
                  style={{ background: '#27272a', color: '#fff', border: 'none', padding: '0.55rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSavingProfile}
                  style={{ background: primaryColor, color: '#fff', border: 'none', padding: '0.55rem 1.2rem', borderRadius: '6px', cursor: isSavingProfile ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {isSavingProfile ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
                  {isSavingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;