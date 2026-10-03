import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';

import Header from './compnent/header';
import HeroSection from './compnent/hirosenction';
import Footer from './compnent/Footer';
import Login from './compnent/login';
import Dashboard from './compnent/Dashboard';
import Profile from './compnent/Profile';
import LiveCallNotification, { type CallRequestData } from './compnent/LiveCallNotification';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<CallRequestData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // إدارة التوكين ديناميكياً لتحديث الاتصال عند تسجيل الدخول أو الخروج
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const updateFaviconWithGreenDot = useCallback((showDot: boolean) => {
    const favicon = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (!favicon) return;

    if (!showDot) {
      favicon.href = '/logo.png';
      return;
    }

    const img = new Image();
    img.src = '/logo.png';
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 64;
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, size, size);

      const dotRadius = 10;
      const dotX = size - dotRadius - 2;
      const dotY = dotRadius + 2;

      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius + 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#22c55e';
      ctx.fill();

      favicon.href = canvas.toDataURL('image/png');
    };
  }, []);

  useEffect(() => {
    const activeToken = token || localStorage.getItem('token');
    if (!activeToken) return;

    const wsUrl = `wss://live-alio-1.onrender.com/ws/live?token=${activeToken}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // إرسال Ping كل 25 ثانية لمنع Render من قطع اتصال WebSocket الخامل
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'pong') return; // تجاهل استجابة الـ Ping

        if (message.type === 'incoming_call_request') {
          setIncomingCall({
            id: message.callId,
            callerName: message.callerName || 'Unknown User',
            callerRole: message.callerRole,
            callerAvatarUrl: message.callerAvatarUrl,
            note: message.note || 'Hello! This user wants to start a direct call with you.'
          });

          updateFaviconWithGreenDot(true);
        }

        if (message.type === 'call_accepted') {
          updateFaviconWithGreenDot(false);

          navigate('/Dashboard', { 
            state: { 
              roomId: message.callId,
              activeCallId: message.callId,
              peerName: message.peerName || 'Partner' 
            } 
          });
        }

        if (message.type === 'call_declined') {
          updateFaviconWithGreenDot(false);
          alert(message.message || 'Call was declined by the user.');
        }
      } catch (err) {
        console.error('Error parsing Global WS message:', err);
      }
    };

    return () => {
      clearInterval(pingInterval);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [token, navigate, updateFaviconWithGreenDot]);

  const handleAcceptCall = (requestId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'accept_call_request',
        callId: requestId
      }));
    }
    const callerName = incomingCall?.callerName || 'Partner';

    updateFaviconWithGreenDot(false);
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

    updateFaviconWithGreenDot(false);
    setIncomingCall(null);
  };

  return (
    <div className="app-main-wrapper">
      <Header />
      
      <main className="app-content">
        <Routes>
          <Route path="/" element={<HeroSection />} />
          <Route path="/login" element={<Login />} />
          <Route path="/Dashboard" element={<Dashboard />} />
          <Route path="/profile/:id" element={<Profile />} />
        </Routes>
      </main>

      <Footer />

      <LiveCallNotification 
        request={incomingCall}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;