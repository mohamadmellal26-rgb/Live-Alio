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
  ExternalLink
} from 'lucide-react';
import { useUserProfile } from './hooks/useUserProfile';
import LiveCallNotification, { type CallRequestData } from './LiveCallNotification';
import { EditProfileModal } from './EditProfileModal';
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
  // التقاط البرامتر سواء كان id أو username
  const params = useParams<{ username?: string; id?: string }>();
  const pathIdentifier = params.username || params.id;

  const [searchParams] = useSearchParams();
  const queryUsername = searchParams.get('user') || searchParams.get('profile') || searchParams.get('identifier');

  // قراءة بيانات الجلسة الحالية أولاً لنتمكن من استخدامها كقيمة افتراضية إذا لم يوجد معرف في الرابط
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const storedUserRaw = localStorage.getItem('user');
    if (storedUserRaw) {
      try {
        return JSON.parse(storedUserRaw);
      } catch (e) {
        console.error('Failed to parse user session:', e);
        return null;
      }
    }
    return null;
  });

  // إذا لم يتم تمرير أي معرف في الرابط وكانت صفحة البروفايل الشخصي (/profile)، نلجأ لمعرف المستخدم الحالي لجلب بروفايله الخاص صحيحاً
  const targetIdentifierRaw = pathIdentifier || queryUsername;
  const targetUsername = targetIdentifierRaw || (window.location.pathname === '/profile' && (currentUser?.username || currentUser?.id || currentUser?.ID) ? String(currentUser.username || currentUser.id || currentUser.ID) : undefined);

  const { data, isLoading, error, refetch } = useUserProfile(targetUsername) as any;

  // حالة محلية للبروفايل لضمان التحديث الفوري للواجهة
  const [localProfile, setLocalProfile] = useState<any>(null);

  const [imgError, setImgError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddContentModal, setShowAddContentModal] = useState(false);

  // حالات إدارة وتفاصيل المحتوى المضاف
  const [contentList, setContentList] = useState<ContentItem[]>([]);
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

  // حالات الاتصال المباشر والـ WebSockets
  const [isCalling, setIsCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallRequestData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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

  // مزامنة الـ Data القادمة من الـ API مع الـ Local State
  useEffect(() => {
    if (data) {
      const extractedUser = data.user || data.profile || data.data || data;
      setLocalProfile(extractedUser);
    }
  }, [data]);

  // استخدام localProfile لضمان سرعة الاستجابة
  const user = localProfile;

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
    user?.avatar || 
    user?.Avatar || 
    user?.avatarUrl || 
    user?.profilePicture;

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
          navigate('/Dashboard', { 
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

  if (error || !user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#121216', color: '#ff22ff', gap: '1rem' }}>
        <ShieldCheck size={48} />
        <h2>Profile Not Found</h2>
        <p style={{ color: '#a1a1aa' }}>
          {targetUsername ? `User "${targetUsername}" does not exist or profile is private.` : 'Please check the profile link or sign in.'}
        </p>
      </div>
    );
  }

  const { primaryColor = '#e056fd' } = data || {};
  const targetUserId = String(user.id || user.ID || user._id || '');

  // التحقق الفعّال مما إذا كان المستخدم الحالي هو مالك البروفايل المعروض
  const isOwner = Boolean(
    token && currentUser && (
      !targetUsername || // زيارة /profile المباشرة
      (currentUser.id && String(currentUser.id) === targetUserId) ||
      (currentUser.ID && String(currentUser.ID) === targetUserId) ||
      (currentUser.username && targetUsername && currentUser.username.toLowerCase() === targetUsername.toLowerCase()) ||
      (currentUser.email && user.email && currentUser.email.toLowerCase() === user.email.toLowerCase())
    )
  );

  const handleConnectClick = () => {
    if (!token) {
      alert('يرجى تسجيل الدخول أولاً للاتصال بالمستخدم.');
      navigate('/login');
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
        callerName: currentUser?.fullName || currentUser?.FullName || 'مستخدم',
        callerRole: currentUser?.role || currentUser?.Role || 'User',
        callerAvatarUrl: currentUser?.avatar || currentUser?.Avatar
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
    navigate('/Dashboard', { state: { roomId: requestId, activeCallId: requestId, peerName: callerName } });
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

  // دالة رفع المحتوى
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
      if (newContent.mediaFile) formData.append('file', newContent.mediaFile);

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
      const createdItem: ContentItem = result.content ? {
        id: result.content.id,
        title: result.content.title,
        type: result.content.type,
        mediaUrl: result.content.url,
        description: newContent.description,
        externalLink: newContent.externalLink
      } : {
        id: String(Date.now()),
        title: newContent.title,
        description: newContent.description,
        type: newContent.type,
        externalLink: newContent.externalLink,
        mediaUrl: newContent.mediaFile ? URL.createObjectURL(newContent.mediaFile) : undefined
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
                    alt={user.fullName || user.FullName || 'User Avatar'} 
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
                  {user.fullName || user.FullName}
                  {user.isVerified && <CheckCircle size={20} className="verified-badge" />}
                </h1>
                <p className="profile-role" style={{ textTransform: 'capitalize' }}>{user.role || user.Role}</p>
              </div>
            </div>

            <div className="profile-actions" style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                className="btn-secondary-action" 
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('تم نسخ رابط البروفايل بنجاح!');
                }}
              >
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
            {(user.bio || user.Bio) && <p className="profile-bio-text">{user.bio || user.Bio}</p>}
            <div className="profile-meta-row">
              {user.email && isOwner && <div className="meta-item"><Mail size={15} /> {user.email}</div>}
              {(user.location || user.Location) && <div className="meta-item"><MapPin size={15} /> {user.location || user.Location}</div>}
              {(user.website || user.Website) && (
                <div className="meta-item">
                  <Globe size={15} /> <a href={user.website || user.Website} target="_blank" rel="noreferrer" style={{ color: primaryColor, textDecoration: 'none' }}>Website / Channel</a>
                </div>
              )}
              {user.joinedDate && <div className="meta-item"><Calendar size={15} /> Joined {user.joinedDate}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="profile-main-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', marginTop: '1.5rem' }}>
        {/* قسم المحتوى والمعرض */}
        <main className="profile-content-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} style={{ color: primaryColor }} /> Content & Portfolio
            </h3>
            {isOwner && (
              <button 
                onClick={() => setShowAddContentModal(true)}
                style={{ background: 'transparent', border: `1px solid ${primaryColor}`, color: primaryColor, padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Plus size={14} /> Add New
              </button>
            )}
          </div>

          {contentList.length === 0 ? (
            <div className="dark-card" style={{ textAlign: 'center', padding: '2.5rem', color: '#a1a1aa', background: '#18181c', borderRadius: '12px', border: '1px solid #27272a' }}>
              <FileText size={40} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>No published content or showcases yet.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              {contentList.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedMedia(item)}
                  style={{ cursor: 'pointer', padding: '0.75rem', background: '#18181c', borderRadius: '10px', border: '1px solid #27272a', transition: 'transform 0.2s' }}
                >
                  {item.mediaUrl ? (
                    <div style={{ height: '130px', borderRadius: '6px', overflow: 'hidden', background: '#000', marginBottom: '0.5rem' }}>
                      {item.type === 'video' ? (
                        <video src={getFullImageUrl(item.mediaUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <img src={getFullImageUrl(item.mediaUrl)} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                  ) : (
                    <div style={{ height: '130px', borderRadius: '6px', background: '#121216', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', marginBottom: '0.5rem' }}>
                      <FileText size={32} />
                    </div>
                  )}
                  <h4 style={{ color: '#fff', margin: '0 0 0.25rem 0', fontSize: '0.9rem' }}>{item.title}</h4>
                  {item.description && (
                    <p style={{ color: '#a1a1aa', fontSize: '0.78rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* الشريط الجانبي */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(user.targetIndustry || user.TargetIndustry) && (
            <div className="dark-card" style={{ background: '#18181c', padding: '1.25rem', borderRadius: '12px', border: '1px solid #27272a' }}>
              <h3 className="card-header-title" style={{ color: '#fff', fontSize: '1rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} style={{ color: primaryColor }} /> Target & Focus
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: '0 0 1rem 0' }}>
                Category: <strong style={{ color: '#fff' }}>{user.targetIndustry || user.TargetIndustry}</strong>
              </p>
              {(user.focusAreas || user.FocusAreas) && (user.focusAreas || user.FocusAreas).length > 0 && (
                <div className="tag-cloud" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {(user.focusAreas || user.FocusAreas).map((area: string, idx: number) => (
                    <span key={idx} className="tech-tag" style={{ borderColor: `${primaryColor}66`, color: primaryColor, border: '1px solid', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                      {area}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {(user.skills || user.Skills) && (user.skills || user.Skills).length > 0 && (
            <div className="dark-card" style={{ background: '#18181c', padding: '1.25rem', borderRadius: '12px', border: '1px solid #27272a' }}>
              <h3 className="card-header-title" style={{ color: '#fff', fontSize: '1rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={18} style={{ color: '#eab308' }} /> Tech Stack & Skills
              </h3>
              <div className="tag-cloud" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {(user.skills || user.Skills).map((skill: string, idx: number) => (
                  <span key={idx} className="tech-tag" style={{ background: '#27272a', color: '#d4d4d8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Modal تفاصيل المحتوى */}
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

      {/* Modal إضافة محتوى جديد (يظهر فقط لمالك البروفايل) */}
      {isOwner && showAddContentModal && (
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

              <div>
                <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.8rem', marginBottom: '0.4rem' }}>Media File (Video/Img)</label>
                <input 
                  type="file" 
                  accept="video/*,image/*"
                  onChange={(e) => setNewContent({ ...newContent, mediaFile: e.target.files?.[0] || null })}
                  style={{ fontSize: '0.75rem', color: '#a1a1aa', width: '100%' }}
                />
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

      {/* Modal تعديل البروفايل المنفصل (يظهر فقط لمالك البروفايل) */}
      {isOwner && (
        <EditProfileModal 
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          user={user}
          token={token}
          apiBaseUrl={API_BASE_URL}
          primaryColor={primaryColor}
          avatarSrc={avatarSrc}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          setLocalProfile={setLocalProfile}
          refetch={refetch}
        />
      )}
    </div>
  );
};

export default ProfilePage;