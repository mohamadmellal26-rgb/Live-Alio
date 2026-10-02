import React, { useState, useEffect, useRef } from 'react';
import './Dashboard.css';

interface MatchFilter {
  targetType: 'all' | 'youtuber' | 'investor';
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

// إعداد سيرفرات STUN المجانية من Google لتأمين اتصال WebRTC Peer-to-Peer
const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'match' | 'history' | 'favorites'>('match');
  const [isSearching, setIsSearching] = useState(false);
  const [isConnectedToPeer, setIsConnectedToPeer] = useState(false);
  const [peerName, setPeerName] = useState<string>('');

  // إعدادات المايك والكاميرا
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoStopped, setIsVideoStopped] = useState(false);

  // الفلاتر
  const [filters, setFilters] = useState<MatchFilter>({
    targetType: 'all',
    ageFilter: '18+',
    genderFilter: 'Both',
  });

  // عناصر الفيديو المباشر
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // إشارات التوصيل WebRTC و WebSocket
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // بيانات حساب المستخدم الحالية
  const [user, setUser] = useState<any>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : { fullName: 'Mohamad', role: 'user' };
  });

  // 1. تهيئة الكاميرا المحلية عند تحميل الصفحة
  useEffect(() => {
    startLocalCamera();

    return () => {
      stopLocalCamera();
      closePeerConnection();
      closeWebSocket();
    };
  }, []);

  const startLocalCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing media devices:', err);
      alert('الرجاء السماح بالوصول للكاميرا والمايكروفون للبدء في البث.');
    }
  };

  const stopLocalCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  // 2. التحكم في بداية المطابقة واقتران WebRTC
  const handleStartMatching = () => {
    closePeerConnection();
    closeWebSocket();

    setIsSearching(true);
    setIsConnectedToPeer(false);
    setPeerName('');

    const token = localStorage.getItem('token') || '';
    const activeRole = filters.targetType;

    // فتح اتصال WebSocket مع Go Backend
    const wsUrl = `wss://live-alio.onrender.com/ws/live?role=${activeRole}&token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Signaling WebSocket Server');
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSignalingMessage(data);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      setIsSearching(false);
    };

    ws.onclose = () => {
      console.log('WebSocket Connection Closed');
    };
  };

  const handleCancelMatching = () => {
    closeWebSocket();
    closePeerConnection();
    setIsSearching(false);
    setIsConnectedToPeer(false);
  };

  // 3. معالجة إشارات WebRTC بين الطرفين (Offer / Answer / ICE Candidates)
  const handleSignalingMessage = async (data: any) => {
    switch (data.type) {
      case 'match_found':
        console.log('Match found! Initiator:', data.initiator);
        setIsSearching(false);
        setIsConnectedToPeer(true);
        setPeerName(data.peerName || 'Partner');

        createPeerConnection();

        if (data.initiator) {
          // الطرف المبادئ يتكفل بإنشاء Offer
          try {
            const offer = await peerConnectionRef.current?.createOffer();
            await peerConnectionRef.current?.setLocalDescription(offer);
            sendSignal({ type: 'offer', offer });
          } catch (e) {
            console.error('Error creating offer:', e);
          }
        }
        break;

      case 'offer':
        if (!peerConnectionRef.current) createPeerConnection();
        await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        const answer = await peerConnectionRef.current?.createAnswer();
        await peerConnectionRef.current?.setLocalDescription(answer);
        sendSignal({ type: 'answer', answer });
        break;

      case 'answer':
        await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
        break;

      case 'ice-candidate':
        if (data.candidate && peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.error('Error adding ICE Candidate:', e);
          }
        }
        break;

      case 'peer_disconnected':
        alert(data.message || 'Partner disconnected');
        closePeerConnection();
        setIsConnectedToPeer(false);
        setPeerName('');
        break;
    }
  };

  const sendSignal = (payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  // 4. إنشاء وتجهيز اتصال RTCPeerConnection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(rtcConfiguration);
    peerConnectionRef.current = pc;

    // إضافة مسارات الصوت والفيديو المحلية للاتصال
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // استقبال مسارات البث القادمة من الطرف الآخر
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // إرسال ICE Candidates للطرف الآخر
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: 'ice-candidate', candidate: event.candidate });
      }
    };
  };

  const closePeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const closeWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // 5. مفاتيح التحكم بالصوت والكاميرا
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoStopped(!videoTrack.enabled);
      }
    }
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
          {isSearching ? 'Searching Match...' : isConnectedToPeer ? 'Next Match 🔄' : 'Start 1v1 Match'}
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
          
          <div className="filter-group">
            <label className="filter-label">Match With:</label>
            <select 
              className="filter-select"
              value={filters.targetType}
              onChange={(e) => setFilters({ ...filters, targetType: e.target.value as any })}
            >
              <option value="all">All Users</option>
              <option value="youtuber">Youtubers Only</option>
              <option value="investor">Investors Only</option>
            </select>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">{user.fullName?.[0]?.toUpperCase() || 'M'}</div>
            <div className="user-info">
              <span className="user-name">{user.fullName || 'User'}</span>
              <span className="user-email">{user.email || 'online'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
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

        <div className="dashboard-content">
          {/* 1v1 Dual Camera Studio Canvas */}
          <div className="cam-studio-wrapper">
            
            {/* Local Video Box (User) */}
            <div className="cam-box local-cam">
              <span className="cam-label">YOU ({user.fullName || 'Mohamad'})</span>
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
              {isVideoStopped && (
                <div className="cam-placeholder" style={{ position: 'absolute', inset: 0, background: '#111' }}>
                  <p>Camera Paused</p>
                </div>
              )}
            </div>

            {/* Remote Video Box (Matched Partner) */}
            <div className={`cam-box remote-cam ${isSearching ? 'searching' : ''}`}>
              <span className="cam-label">
                {isSearching 
                  ? 'SEARCHING FOR A MATCH...' 
                  : isConnectedToPeer 
                  ? `MATCHED WITH: ${peerName}` 
                  : 'MATCHED PARTNER'}
              </span>
              
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  display: isConnectedToPeer ? 'block' : 'none' 
                }}
              />

              {!isConnectedToPeer && (
                isSearching ? (
                  <div className="search-loader">
                    <div className="spinner"></div>
                    <p>Finding a match ({filters.targetType})...</p>
                    <button className="btn-cancel" onClick={handleCancelMatching}>Cancel</button>
                  </div>
                ) : (
                  <div className="cam-placeholder">
                    <div className="cam-avatar glow">📷</div>
                    <p>Click "Start 1v1 Match" to start session</p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Quick Actions Control Bar */}
          <div className="match-controls-bar">
            <button className={`btn-control btn-mic ${isMuted ? 'active-off' : ''}`} onClick={toggleMute}>
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button className={`btn-control btn-video ${isVideoStopped ? 'active-off' : ''}`} onClick={toggleVideo}>
              {isVideoStopped ? 'Start Video' : 'Stop Video'}
            </button>
            <button className="btn-start-create btn-next" onClick={handleStartMatching}>
              Next Match ➔
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;