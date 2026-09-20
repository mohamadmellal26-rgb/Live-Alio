import React, { useState, useEffect, useRef } from 'react';
import { Zap, Globe2, Sparkles, Users, PhoneOff, SkipForward, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import './hirosenction.css';

export const HeroSection: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<'all' | 'creators'>('all');
  
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelay',
        credential: 'openrelay',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelay',
        credential: 'openrelay',
      },
    ],
  };

  const startLocalCamera = async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { max: 1280 },
          height: { max: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error("خطأ في الوصول للكاميرا/الميكروفون:", err);
      return null;
    }
  };

  useEffect(() => {
    startLocalCamera();

    return () => {
      closeEverything();
    };
  }, []);

  useEffect(() => {
    if (isConnected && remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play().catch((err) => {
        console.warn("Autoplay handling:", err);
      });
    }
  }, [isConnected]);

  const stopPeerConnection = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    remoteStreamRef.current = null;
    pendingCandidatesRef.current = [];
    setIsConnected(false);
    setIsMatching(false);
  };

  const closeEverything = () => {
    stopPeerConnection();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  };

  const startMatch = async () => {
    stopPeerConnection();

    const stream = await startLocalCamera();
    if (!stream) {
      alert("يرجى السماح بالوصول للكاميرا والميكروفون لبدء المحادثة.");
      return;
    }

    setIsMatching(true);

    const backendRole = selectedRole === 'creators' ? 'youtuber' : 'all';
    // تم تحديث الرابط هنا ليطابق سيرفر Render الجديد
    const wsUrl = `wss://live-alio.onrender.com/ws/live?role=${backendRole}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to signaling server");
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'match_found':
          setIsMatching(false);
          await initPeerConnection(data.initiator);
          setIsConnected(true);
          break;

        case 'offer':
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.payload));
            
            while (pendingCandidatesRef.current.length > 0) {
              const candidate = pendingCandidatesRef.current.shift();
              if (candidate) {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              }
            }

            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', payload: answer }));
          }
          break;

        case 'answer':
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.payload));
            
            while (pendingCandidatesRef.current.length > 0) {
              const candidate = pendingCandidatesRef.current.shift();
              if (candidate) {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              }
            }
          }
          break;

        case 'ice_candidate':
          if (data.payload) {
            if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.payload));
            } else {
              pendingCandidatesRef.current.push(data.payload);
            }
          }
          break;

        case 'peer_disconnected':
          handleNextMatch();
          break;

        default:
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsMatching(false);
    };
  };

  const initPeerConnection = async (isInitiator: boolean) => {
    const pc = new RTCPeerConnection(rtcConfiguration);
    peerConnectionRef.current = pc;
    pendingCandidatesRef.current = [];

    remoteStreamRef.current = new MediaStream();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      if (remoteStreamRef.current) {
        event.streams[0].getTracks().forEach((track) => {
          remoteStreamRef.current?.addTrack(track);
        });
      }

      if (remoteVideoRef.current && remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch((err) => {
          console.warn("Autoplay block workaround:", err);
        });
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'ice_candidate',
            payload: event.candidate,
          })
        );
      }
    };

    if (isInitiator) {
      await createAndSendOffer(pc);
    }
  };

  const createAndSendOffer = async (pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'offer',
            payload: offer,
          })
        );
      }
    } catch (err) {
      console.error("Error creating offer:", err);
    }
  };

  const handleNextMatch = () => {
    stopPeerConnection();
    startMatch();
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
    <section className="hero-section" dir="ltr">
      <div className="hero-breadcrumb">
        <span>Home</span>
        <span className="breadcrumb-separator">&gt;</span>
        <span className="breadcrumb-current">Random Video Chat</span>
      </div>

      <div className="hero-header-content">
        <h1 className="hero-title">Instant Random Video Chat with People & Content Creators Worldwide</h1>
        <p className="hero-description">
          Connect 1-on-1 instantly with random people, YouTubers, and content creators around the globe. 
          Talk, share ideas, discover new friends, and skip to the next camera with just one click.
        </p>
      </div>

      <div className="hero-grid">
        <div className="hero-preview-card">
          {isConnected ? (
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className="preview-image video-stream" 
            />
          ) : (
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop" 
              alt="Random Video Call Preview" 
              className="preview-image"
            />
          )}

          <div className="local-video-wrapper">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="local-video-preview" 
            />
          </div>

          <div className="live-status-badge">
            <span className="live-dot"></span> {isConnected ? 'LIVE MATCHED' : 'LIVE CHAT'}
          </div>

          {!isConnected && !isMatching && (
            <div className="preview-overlay-text">
              <h2>Aleo_live Chat</h2>
              <p>1-ON-1 VIDEO ROOM</p>
              <span className="preview-tag">Online Now: +12,400 users & streamers</span>
            </div>
          )}

          {isMatching && (
            <div className="preview-overlay-text matching-active">
              <h2>Searching for partner...</h2>
              <p>Role Filter: {selectedRole === 'creators' ? 'Youtubers Only' : 'Everyone'}</p>
            </div>
          )}
        </div>

        <div className="hero-upload-card">
          <div className="ai-enhance-badge">
            <div className="live-stats-row">
              <span className="stat-pill"><Users size={14} /> +85,000 Chats Today</span>
              <span className="stat-pill"><Globe2 size={14} /> +120 Countries</span>
            </div>
            <div className="badge-title">
              <Sparkles size={18} className="sparkle-icon" />
              <span>Start Random Chat Now</span>
            </div>
          </div>

          <div className="match-interactive-zone">
            <div className="role-selector">
              <button 
                className={`role-btn ${selectedRole === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedRole('all')}
                disabled={isMatching || isConnected}
              >
                Everyone
              </button>
              <button 
                className={`role-btn ${selectedRole === 'creators' ? 'active' : ''}`}
                onClick={() => setSelectedRole('creators')}
                disabled={isMatching || isConnected}
              >
                Creators & YouTubers
              </button>
            </div>

            {!isConnected && !isMatching ? (
              <button className="btn-start-match" onClick={startMatch}>
                <Zap size={20} />
                <span>Start Random Match</span>
              </button>
            ) : isMatching ? (
              <button className="btn-start-match matching-btn" onClick={stopPeerConnection}>
                <PhoneOff size={20} />
                <span>Searching... (Cancel)</span>
              </button>
            ) : (
              <div className="live-controls">
                <button className="btn-control skip-btn" onClick={handleNextMatch}>
                  <SkipForward size={20} />
                  <span>Next Person</span>
                </button>
                <button className={`btn-control icon-btn ${isMuted ? 'disabled' : ''}`} onClick={toggleMute}>
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button className={`btn-control icon-btn ${isVideoOff ? 'disabled' : ''}`} onClick={toggleVideo}>
                  {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
                <button className="btn-control stop-btn" onClick={stopPeerConnection}>
                  <PhoneOff size={20} />
                </button>
              </div>
            )}
            
            <p className="dropzone-text">
              {isConnected 
                ? "You are connected! Enjoy your chat." 
                : "You will be matched instantly with a random person"}
            </p>
          </div>

          <p className="upload-terms">
            By joining, you agree to our <a href="#" className="terms-link">Terms of Service</a> and <a href="#" className="terms-link">Community Guidelines</a>.
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;