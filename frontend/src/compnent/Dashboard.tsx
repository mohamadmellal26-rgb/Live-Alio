import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PhoneOff, Mic, MicOff, Camera, VideoOff } from 'lucide-react';
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
  const location = useLocation();
  const locationState = location.state as { autoConnectPeerId?: string; peerName?: string; activeCallId?: string } | null;

  const [activeTab, setActiveTab] = useState<'match' | 'history' | 'favorites'>('match');
  const [isSearching, setIsSearching] = useState(false);
  const [isConnectedToPeer, setIsConnectedToPeer] = useState(false);
  const [peerName, setPeerName] = useState<string>(locationState?.peerName || '');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [onlineUsersCount, setOnlineUsersCount] = useState<number>(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  const [user] = useState<any>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : { fullName: 'Mohamad', role: 'user' };
  });

  const [filters, setFilters] = useState<MatchFilter>({
    targetType: 'all',
    ageFilter: '18+',
    genderFilter: 'Both',
  });

  const isRegularUser = !user?.role || user?.role === 'user' || user?.role === 'regular';

  // 1. تشغيل الكاميرا المحلية
  const startLocalCamera = useCallback(async () => {
    if (localStreamRef.current) return;
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
      console.error('Error accessing camera/mic:', err);
    }
  }, []);

  // 2. إيقاف الكاميرا المحلية
  const stopLocalCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, []);

  const sendSignal = useCallback((payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  // 3. تنظيف اتصال الـ WebRTC الحالي
  const cleanupPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    iceCandidatesQueue.current = [];
  }, []);

  // 4. العودة لوضع الكاميرا العادي
  const resetToCameraOnly = useCallback(() => {
    cleanupPeerConnection();
    setIsSearching(false);
    setIsConnectedToPeer(false);
    setPeerName('');
  }, [cleanupPeerConnection]);

  const handlePeerDisconnected = useCallback(() => {
    resetToCameraOnly();
  }, [resetToCameraOnly]);

  const processQueuedCandidates = async () => {
    if (!peerConnectionRef.current) return;
    while (iceCandidatesQueue.current.length > 0) {
      const candidate = iceCandidatesQueue.current.shift();
      if (candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding queued candidate:', e);
        }
      }
    }
  };

  const createPeerConnection = useCallback(() => {
    cleanupPeerConnection();

    const pc = new RTCPeerConnection(rtcConfiguration);
    peerConnectionRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: 'ice-candidate', candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (
        pc.iceConnectionState === 'disconnected' ||
        pc.iceConnectionState === 'failed' ||
        pc.iceConnectionState === 'closed'
      ) {
        handlePeerDisconnected();
      }
    };

    return pc;
  }, [cleanupPeerConnection, sendSignal, handlePeerDisconnected]);

  const handleSignalingMessage = useCallback(async (data: any) => {
    switch (data.type) {
      case 'online_count':
        if (typeof data.count === 'number') {
          setOnlineUsersCount(data.count);
        }
        break;

      case 'match_found':
      case 'direct_call_start': {
        setIsSearching(false);
        setIsConnectedToPeer(true);
        if (data.peerName) setPeerName(data.peerName);

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
      }

      case 'offer': {
        const currentPc = peerConnectionRef.current || createPeerConnection();
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
              console.error('Error adding ICE candidate:', e);
            }
          } else {
            iceCandidatesQueue.current.push(data.candidate);
          }
        }
        break;
      }

      case 'peer_disconnected':
        handlePeerDisconnected();
        break;

      default:
        break;
    }
  }, [createPeerConnection, sendSignal, handlePeerDisconnected]);

  const connectPresenceWS = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = localStorage.getItem('token') || '';
    const wsUrl = `wss://live-alio-1.onrender.com/ws/live?role=${filters.targetType}&token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (locationState?.activeCallId || locationState?.autoConnectPeerId) {
        setIsConnectedToPeer(true);
        ws.send(JSON.stringify({
          type: 'init_direct_call',
          callId: locationState.activeCallId,
          peerId: locationState.autoConnectPeerId
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSignalingMessage(data);
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  }, [filters.targetType, handleSignalingMessage, locationState]);

  const handleStopSession = useCallback(() => {
    sendSignal({ type: 'leave' });
    resetToCameraOnly();
  }, [sendSignal, resetToCameraOnly]);

  const handleStartMatching = useCallback(() => {
    sendSignal({ type: 'leave' });
    cleanupPeerConnection();
    setIsSearching(true);
    setIsConnectedToPeer(false);
    setPeerName('');

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connectPresenceWS();
    } else {
      sendSignal({ type: 'find_match' });
    }
  }, [sendSignal, cleanupPeerConnection, connectPresenceWS]);

  useEffect(() => {
    startLocalCamera();
    connectPresenceWS();

    const handleBeforeUnload = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'leave' }));
        wsRef.current.close();
      }
      cleanupPeerConnection();
      stopLocalCamera();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleStopSession();
      stopLocalCamera();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [startLocalCamera, connectPresenceWS, cleanupPeerConnection, stopLocalCamera, handleStopSession]);

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
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <div className="dashboard-layout">
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
              onChange={(e) => {
                setFilters({ ...filters, targetType: e.target.value as any });
                if (wsRef.current) wsRef.current.close();
                connectPresenceWS();
              }}
            >
              <option value="all">All Users</option>
              {!isRegularUser && (
                <>
                  <option value="youtuber">Youtubers Only</option>
                  <option value="investor">Investors Only</option>
                </>
              )}
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

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="match-status-indicator">
            <span className="status-dot online"></span>
            <span>Online Users: <strong>{onlineUsersCount.toLocaleString()}</strong></span>
          </div>

          <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-icon" onClick={toggleMute} title="Mute/Unmute">
              {isMuted ? <MicOff color="#ef4444" size={18} /> : <Mic size={18} />}
            </button>
            <button className="btn-icon" onClick={toggleVideo} title="Cam On/Off">
              {isVideoOff ? <VideoOff color="#ef4444" size={18} /> : <Camera size={18} />}
            </button>
            {isConnectedToPeer && (
              <button className="btn-login-outline btn-sm" style={{ background: '#ef4444', color: '#fff', border: 'none' }} onClick={handleStopSession}>
                <PhoneOff size={16} /> Disconnect
              </button>
            )}
          </div>
        </header>

        <div className="dashboard-content">
          <div className="cam-studio-wrapper">
            {/* الشاشة المحلية */}
            <div className="cam-box local-cam">
              <span className="cam-label">YOU ({user.fullName || 'User'})</span>
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            </div>

            {/* الشاشة البعيدة */}
            <div className={`cam-box remote-cam ${isSearching ? 'searching' : ''}`}>
              <span className="cam-label">
                {isSearching 
                  ? 'SEARCHING FOR A MATCH...' 
                  : isConnectedToPeer 
                  ? `MATCHED WITH: ${peerName || 'Partner'}` 
                  : 'CAMERA DISPLAY'}
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
                    <button className="btn-cancel" onClick={handleStopSession}>Cancel</button>
                  </div>
                ) : (
                  <div className="cam-placeholder">
                    <div className="cam-avatar glow">📷</div>
                    <p>Camera is Ready - Click "Start 1v1 Match" to Connect</p>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="match-controls-bar">
            <button className={`btn-control btn-mic ${isMuted ? 'active-off' : ''}`} onClick={toggleMute}>
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            
            {(isConnectedToPeer || isSearching) && (
              <button 
                className="btn-control" 
                onClick={handleStopSession}
                style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                Close Session ✖
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