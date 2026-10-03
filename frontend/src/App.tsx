import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './compnent/header';
import HeroSection from './compnent/hirosenction';
import Footer from './compnent/Footer';
import Login from './compnent/login';
import Dashboard from './compnent/Dashboard';
import Profile from './compnent/Profile';
import LiveCallNotification, { CallRequestData } from './compnent/LiveCallNotification';

export const App: React.FC = () => {
  const [incomingCall, setIncomingCall] = useState<CallRequestData | null>(null);

  // دالة استقبال الطلب (يمكنك ربطها بـ Socket.io لاحقاً)
  const triggerTestCall = () => {
    setIncomingCall({
      id: 'call_123',
      callerName: 'Sarah Connor',
      callerRole: 'Investor / Angel',
      note: 'Hey Mohamad, loved your Live-Alio pitch! Can we jump on a 2-min call?',
    });
  };

  const handleAcceptCall = (requestId: string) => {
    console.log('Call accepted:', requestId);
    // توجيه المستخدم لغرفة الاتصال المباشر أو فتح Modal المباشر
    setIncomingCall(null);
  };

  const handleDeclineCall = (requestId: string) => {
    console.log('Call declined:', requestId);
    setIncomingCall(null);
  };

  return (
    <Router>
      <div className="app-main-wrapper">
        <Header />
        
        <main className="app-content">
          <Routes>
            {/* الصفحة الرئيسية */}
            <Route path="/" element={<HeroSection />} />

            {/* صفحة تسجيل الدخول */}
            <Route path="/login" element={<Login />} />

            {/* لوحة التحكم */}
            <Route path="/Dashboard" element={<Dashboard />} />

            {/* مسار الملف الشخصي الديناميكي (Path Parameter) */}
            <Route path="/profile/:username" element={<Profile />} />

            {/* مسار الملف الشخصي للحساب الحالي */}
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>

        <Footer />

        {/* مكون إشعار الاتصال المباشر متاح على مستوى التطبيق بالكامل */}
        <LiveCallNotification 
          request={incomingCall}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      </div>
    </Router>
  );
};

export default App;