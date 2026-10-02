import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Dashboard.css';

interface MatchFilter {
  targetType: 'all' | 'youtuber' | 'investor';
  ageFilter: 'All' | '18+' | 'Teens';
  genderFilter: 'Both' | 'Male' | 'Female';
}

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
  const [isMuted, setIsMuted] = useState(false);

  // عناصر الفيديو
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // مراجع الاتصالات والبث
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // طابور لتخزين ICE Candidates قبل إعداد Remote Description
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  // بيانات المستخدم
  const [user] = useState<any>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : { fullName: 'Mohamad', role: 'user' };
  });

  // الفلاتر
  const [filters, setFilters] = useState<MatchFilter>({
    targetType: 'all',
    ageFilter: '18+',
    genderFilter: 'Both',
  });

  const isRegularUser = !user?.role || user?.role === 'user' || user?.role === 'regular';

  useEffect(() => {
    if (isRegularUser && filters.targetType !== 'all') {
      setFilters((prev) => ({ ...prev, targetType: 'all' }));
    }
  }, [user, isRegularUser, filters.targetType]);

  // تشغيل الكاميرا المحلية عند التحميل
  useEffect(() => {
    startLocalCamera();

    return () => {
      stopLocalCamera();
      cleanupConnection();
    };
  }, []);

  const startLocalCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: true 
      });
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
      localStreamRef.current = null;
    }
  };

  // إرسال الإشارات عبر WebSocket
  const sendSignal = useCallback((payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  // إغلاق الاتصالات وتنظيف الذاكرة
  const cleanupConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    iceCandidatesQueue.current = [];
  }, []);

  // تفريغ ICE Candidates من الطابور بعد إعداد السيرفر البعيد
  const processQueuedCandidates = async () => {
    if (!peerConnectionRef.current) return;
    while (iceCandidatesQueue.current.length > 0) {
      const candidate = iceCandidatesQueue.current.shift();
      if (candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding queued ICE Candidate:', e);
        }
      }
    }
  };

  // إنشاء PeerConnection
  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(rtcConfiguration);
    peerConnectionRef.current = pc;

    // إضافة المسارات المحلية (المرئية والصوتية)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // استلام المسارات من الطرف الآخر
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // إرسال ICE Candidate المحلي للطرف الآخر
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: 'ice-candidate', candidate: event.candidate });
      }
    };

    return pc;
  }, [sendSignal]);

  // معالجة إشارات الـ WebRTC والـ WebSocket
  const handleSignalingMessage = useCallback(async (data: any) => {
    switch (data.type) {
      case 'match_found':
        console.log('Match found! Initiator:', data.initiator);
        setIsSearching(false);
        setIsConnectedToPeer(true);
        setPeerName(data.peerName || 'Partner');

        const pc = createPeerConnection();

        if (data.initiator) {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal({ type: 'offer', offer });
          } catch (e) {
            console.error('Error creating offer:', e);
          }
        }
        break;

      case 'offer': {
        let currentPc = peerConnectionRef.current || createPeerConnection();
        await currentPc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await processQueuedCandidates();

        const answer = await currentPc.createAnswer();
        await currentPc.setLocalDescription(answer);
        sendSignal({ type: 'answer', answer });
        break;
      }

      case 'answer': {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          await processQueuedCandidates();
        }
        break;
      }

      case 'ice-candidate': {
        if (data.candidate) {
          if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
              console.error('Error adding ICE Candidate directly:', e);
            }
          } else {
            // تخزين الـ candidate مؤقتاً في الطابور لحين إعداد الـ Remote Description
            iceCandidatesQueue.current.push(data.candidate);
          }
        }
        break;
      }

      case 'peer_disconnected':
        cleanupConnection();
        setIsConnectedToPeer(false);
        setPeerName('');
        alert(data.message || 'Partner disconnected');
        break;

      default:
        break;
    }
  }, [createPeerConnection, sendSignal, cleanupConnection]);

  // بدء البحث والمطابقة
  const handleStartMatching = () => {
    cleanupConnection();

    setIsSearching(true);
    setIsConnectedToPeer(false);
    setPeerName('');

    const token = localStorage.getItem('token') || '';
    const activeRole = filters.targetType;

    const wsUrl = `wss://live-alio.onrender.com/ws/live?role=${activeRole}&token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Signaling WebSocket Server');
    };

    ws.onmessage = (event) => {
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

  const handleStopMatch = () => {
    cleanupConnection();
    setIsSearching(false);
    setIsConnectedToPeer(false);
    setPeerName('');
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar">
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
              disabled={isRegularUser}
              onChange={(e) => setFilters({ ...filters, targetType: e.target.value as any })}
            >
              <option value="all">All Users</option>
              {!isRegularUser && (
                <>
                  <option value="youtuber">Youtubers Only</option>
                  <option value="investor">Investors Only</option>
                </>
              )}
            </select>
            {isRegularUser && (
              <small style={{ color: '#888', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                قم بترقية حسابك لتصفية الفئات (Youtubers / Investors)
              </small>
            )}
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
          <div className="cam-studio-wrapper">
            {/* Local Video Box */}
            <div className="cam-box local-cam">
              <span className="cam-label">YOU ({user.fullName || 'Mohamad'})</span>
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            </div>

            {/* Remote Video Box */}
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
                    <button className="btn-cancel" onClick={handleStopMatch}>Cancel</button>
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
            
            {(isConnectedToPeer || isSearching) && (
              <button 
                className="btn-control" 
                onClick={handleStopMatch}
                style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
              >
                🛑 Stop Session
              </button>
            )}

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