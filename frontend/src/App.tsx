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

  const token = localStorage.getItem('token');

  // دالة تحديث أيقونة الموقع (Favicon) ديناميكياً وإضافة/إزالة النقطة الخضراء
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

      // 1. رسم الشعار الأصلي
      ctx.drawImage(img, 0, 0, size, size);

      // 2. إعدادات النقطة الخضراء في أعلى اليمين
      const dotRadius = 10;
      const dotX = size - dotRadius - 2;
      const dotY = dotRadius + 2;

      // رسم إطار أبيض عازل
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius + 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // رسم النقطة الخضراء
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#22c55e';
      ctx.fill();

      // 3. تطبيق الصورة الجديدة للـ Favicon
      favicon.href = canvas.toDataURL('image/png');
    };
  }, []);

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
            note: message.note || 'Hello! This user wants to start a direct call with you.'
          });

          // تفعيل النقطة الخضراء على أيقونة التبويب
          updateFaviconWithGreenDot(true);
        }

        if (message.type === 'call_accepted') {
          // إزالة النقطة الخضراء
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
          // إزالة النقطة الخضراء
          updateFaviconWithGreenDot(false);
          alert(message.message || 'Call was declined by the user.');
        }
      } catch (err) {
        console.error('Error parsing Global WS message:', err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
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

    // إعادة الأيقونة لحالتها الأصلية عند القبول
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

    // إعادة الأيقونة لحالتها الأصلية عند الرفض
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
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/profile" element={<Profile />} />
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