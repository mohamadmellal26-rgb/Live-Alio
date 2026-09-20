import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, ArrowLeft, Video } from 'lucide-react';
import './login.css';

interface AuthProps {
  onLoginSuccess?: (token: string, user: any) => void;
  onBackToHome?: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess, onBackToHome }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // تم تحديث رابط الـ API ليوجه إلى سيرفر Render بدلاً من localhost
  const API_BASE_URL = 'https://live-alio.onrender.com/api/v1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = isSignUp ? `${API_BASE_URL}/signup` : `${API_BASE_URL}/login`;
    const payload = isSignUp ? { fullName, email, password } : { email, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء العملية');
      }

      // حفظ الـ JWT Token وبيانات المستخدم
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // الاتصال بالـ WebSocket باستخدام رابط Render
      connectWebSocket(data.token);

      // الانتقال مباشرة إلى الصفحة الرئيسية (/)
      if (onLoginSuccess) {
        onLoginSuccess(data.token, data.user);
      } else if (onBackToHome) {
        onBackToHome();
      } else {
        window.location.href = '/';
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = (token: string) => {
    // تحديث رابط الـ WebSocket ليتوافق مع سيرفر Render (wss)
    const ws = new WebSocket(`wss://live-alio.onrender.com/ws/live?role=youtuber&token=${token}`);

    ws.onopen = () => {
      console.log('Connected to WebSocket server');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Signal received:', data);
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };
  };

  const toggleAuthMode = (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    setIsSignUp((prev) => !prev);
  };

  const handleBackToHome = () => {
    if (onBackToHome) {
      onBackToHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="login-container" dir="ltr">
      <div className="login-card">
        {/* Back to Home Button */}
        <button 
          type="button" 
          onClick={handleBackToHome}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '14px',
            marginBottom: '16px',
            padding: 0,
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
        >
          <ArrowLeft size={18} />
          <span>Back to Home</span>
        </button>

        {/* Header */}
        <div className="login-header">
          <div className="login-logo">
            <Video size={28} className="logo-icon" />
            <span className="logo-text">Live-Aleo</span>
          </div>
          <h1 className="login-title">
            {isSignUp ? 'Create an Account' : 'Welcome Back'}
          </h1>
          <p className="login-subtitle">
            {isSignUp
              ? 'Join today to connect and match with creators worldwide'
              : 'Sign in to start matching with creators worldwide'}
          </p>
        </div>

        {/* Display Error Message */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#ef4444',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {/* Full Name Input (Sign Up Only) */}
          {isSignUp && (
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  id="fullName"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={isSignUp}
                />
              </div>
            </div>
          )}

          {/* Email Input */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                id="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="form-group">
            <div className="label-row">
              <label htmlFor="password">Password</label>
              {!isSignUp && (
                <a href="#" className="forgot-link">
                  Forgot password?
                </a>
              )}
            </div>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <button type="submit" className="btn-login" disabled={loading}>
            <span>{loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Divider */}
        <div className="login-divider">
          <span>Or continue with</span>
        </div>

        {/* Google Auth Button */}
        <div className="social-buttons">
          <button type="button" className="btn-social-google">
            <svg className="social-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Footer Toggle */}
        <p className="login-footer">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <a href="#" className="signup-link" onClick={toggleAuthMode}>
            {isSignUp ? 'Sign in' : 'Sign up now'}
          </a>
        </p>
      </div>
    </div>
  );
};

export default Auth;