import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';
import Header from './compnent/header';
import HeroSection from './compnent/hirosenction';
import Footer from './compnent/Footer';
import Login from './compnent/login';
import Dashboard from './compnent/Dashboard';
import Profile from './compnent/Profile';
import LiveCallNotification, { type CallRequestData } from './compnent/LiveCallNotification';

// مكون داخلي لاستخدام الموجه useNavigate داخل الـ Router
const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<CallRequestData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const token = localStorage.getItem('token');

  // إقامة اتصال WebSocket عام على مستوى التطبيق بأكمله
  useEffect(() => {
    if (!token) return;

    const wsUrl = `wss://live-alio-1.onrender.com/ws/live?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // استقبال طلب الاتصال الوارد في أي مكان
        if (message.type === 'incoming_call_request') {
          setIncomingCall({
            id: message.callId,
            callerName: message.callerName || 'Unknown User',
            callerRole: message.callerRole,
            callerAvatarUrl: message.callerAvatarUrl,
            note: message.note || 'مرحباً، يرغب هذا المستخدم بالاتصال بك مباشرة!'
          });
        }

        // عند قبول الاتصال من الطرف الآخر أثناء الانتظار
        if (message.type === 'call_accepted') {
          navigate('/Dashboard', { 
            state: { 
              roomId: message.callId, 
              activeCallId: message.callId,
              peerName: message.peerName || 'Partner' 
            } 
          });
        }

        // عند رفض الطلب
        if (message.type === 'call_declined') {
          alert(message.message || 'تم رفض طلب الاتصال من قبل المستلم.');
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
  }, [token, navigate]);

  const handleAcceptCall = (requestId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'accept_call_request',
        callId: requestId
      }));
    }
    const callerName = incomingCall?.callerName || 'Partner';
    setIncomingCall(null);
    // التوجيه الفوري للداشبورد لبدء المحادثة المرئية
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

      {/* الإشعار متاح الآن شمولياً في جميع الصفحات */}
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