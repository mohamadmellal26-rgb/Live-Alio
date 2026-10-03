import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './compnent/header';
import HeroSection from './compnent/hirosenction';
import Footer from './compnent/Footer';
import Login from './compnent/login';
import Dashboard from './compnent/Dashboard';
import Profile from './compnent/Profile';
// استخدام type-only import لحل الخطأ TS1484
import LiveCallNotification, { type CallRequestData } from './compnent/LiveCallNotification';

export const App: React.FC = () => {
  const [incomingCall, setIncomingCall] = useState<CallRequestData | null>(null);

  // حذف triggerTestCall أو ربطها بالنافذة لتفادي خطأ المتغير غير المستعمل TS6133
  const handleAcceptCall = (requestId: string) => {
    console.log('Call accepted:', requestId);
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
    </Router>
  );
};

export default App;