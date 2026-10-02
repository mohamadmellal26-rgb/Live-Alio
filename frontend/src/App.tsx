import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './compnent/header';
import HeroSection from './compnent/hirosenction';
import Footer from './compnent/Footer';
import Login from './compnent/login';
import Dashboard from './compnent/Dashboard';
import Profile from './compnent/Profile';

function App() {
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

            {/* إذا أردت دعم رابط بدون اسم مستخدم ليتم توجيهه إلى الملف الشخصي الحالي */}
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default App;