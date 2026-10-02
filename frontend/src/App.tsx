import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './compnent/header';
import HeroSection from './compnent/hirosenction';
import Footer from './compnent/Footer';
import Login from './compnent/login'; // تأكد من اسم المجلد والمكون لديك
import Dashboard from './compnent/Dashboard';
import Profile from './compnent/Profile';

function App() {
  return (
    <Router>
      <div className="app-main-wrapper">
        <Header />
        
        <main className="app-content">
          <Routes>
            <Route path="/protfile" element={<Profile />} />

            <Route path="/Dashboard" element={<Dashboard />} />
            {/* الصفحة الرئيسية */}
            <Route path="/" element={<HeroSection />} />
            
            {/* صفحة تسجيل الدخول */}
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default App;