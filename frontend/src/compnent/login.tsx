import React, { useState, useEffect, useRef } from 'react';
import { Mail, Lock, User, ArrowRight, ArrowLeft, Video, Briefcase, FileText, CreditCard, ShieldCheck, Camera } from 'lucide-react';
import './login.css';

type UserRole = 'user' | 'youtuber' | 'investor';

interface AuthProps {
  onLoginSuccess?: (token: string, user: any) => void;
  onBackToHome?: () => void;
}

const YoutubeIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = "#FF0000", className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill={color} 
    className={className} 
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess, onBackToHome }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  
  // Profile Picture State
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Youtuber Specific Fields
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Investor Specific Fields
  const [pyCardId, setPyCardId] = useState('');
  const [projectProof, setProjectProof] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const API_BASE_URL = 'https://live-alio-1.onrender.com/api/v1';

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should not exceed 5MB.');
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateYoutubeUrl = (url: string) => {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(channel\/|c\/|@)|youtu\.be\/).+/;
    return pattern.test(url);
  };

  const connectWebSocket = (token: string, activeRole: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`wss://live-alio-1.onrender.com/ws/live?role=${activeRole}&token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => console.log('Connected to WebSocket server as:', activeRole);
    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Signal received:', data);
      } catch (e) {
        console.log('Raw message received:', event.data);
      }
    };
    ws.onerror = (err) => console.error('WebSocket Error:', err);
    ws.onclose = () => console.log('WebSocket connection closed');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSignUp) {
      if (!fullName.trim()) {
        setError('Full Name is required.');
        return;
      }

      if (role === 'youtuber' && (!youtubeUrl || !validateYoutubeUrl(youtubeUrl))) {
        setError('Please provide a valid YouTube channel or video URL.');
        return;
      }

      if (role === 'investor') {
        if (!pyCardId.trim()) {
          setError('Py / Payment Card verification ID is required for Investors.');
          return;
        }
        if (!projectProof) {
          setError('Please upload proof of project ownership or business documentation.');
          return;
        }
      }
    }

    setLoading(true);

    const endpoint = isSignUp ? `${API_BASE_URL}/signup` : `${API_BASE_URL}/login`;

    try {
      let response: Response;

      if (isSignUp && (avatarFile || projectProof)) {
        const formData = new FormData();
        formData.append('fullName', fullName);
        formData.append('email', email);
        formData.append('password', password);
        formData.append('role', role);

        if (avatarFile) {
          formData.append('avatar', avatarFile);
        }

        if (role === 'youtuber') {
          formData.append('youtubeUrl', youtubeUrl);
        }

        if (role === 'investor') {
          formData.append('pyCardId', pyCardId);
          if (projectProof) {
            formData.append('projectProof', projectProof);
          }
        }

        response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });
      } else {
        const payload: Record<string, any> = isSignUp
          ? { fullName, email, password, role }
          : { email, password };

        if (isSignUp && role === 'youtuber') {
          payload.youtubeUrl = youtubeUrl;
        }

        if (isSignUp && role === 'investor') {
          payload.pyCardId = pyCardId;
        }

        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload),
        });
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        data = { message: responseText || 'Server returned an invalid response.' };
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Operation failed. Please check your inputs.');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      const rawUserData = data.user || {
        fullName,
        email,
        role,
        youtubeUrl,
      };

      // تحديد اسم مستخدم افتراضي آمن في حالة عدم توفره من الـ API
      const fallbackUsername = 
        rawUserData.username || 
        rawUserData.id || 
        rawUserData._id || 
        (rawUserData.fullName ? rawUserData.fullName.replace(/\s+/g, '').toLowerCase() : '') || 
        email.split('@')[0];

      const userData = {
        ...rawUserData,
        username: fallbackUsername
      };

      localStorage.setItem('user', JSON.stringify(userData));

      const userRole = userData.role || role;
      if (data.token) {
        connectWebSocket(data.token, userRole);
      }

      if (onLoginSuccess) {
        onLoginSuccess(data.token, userData);
      } else if (onBackToHome) {
        onBackToHome();
      } else {
        // التوجيه الصحيح بالرابط الديناميكي
        window.location.href = `/profile/${userData.username}`;
      }

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
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
        <button 
          type="button" 
          onClick={handleBackToHome}
          className="btn-back-home"
        >
          <ArrowLeft size={18} />
          <span>Back to Home</span>
        </button>

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
              ? 'Choose your identity and join the global creator network'
              : 'Sign in to start matching with creators worldwide'}
          </p>
        </div>

        {error && (
          <div className="error-alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {/* Avatar Upload (Sign Up Only) */}
          {isSignUp && (
            <div className="avatar-upload-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
              <label htmlFor="avatar-input" style={{ cursor: 'pointer', position: 'relative' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: '#1f2937',
                  border: '2px dashed #4b5563',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Camera size={28} color="#9ca3af" />
                  )}
                </div>
              </label>
              <input
                type="file"
                id="avatar-input"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
              <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.4rem' }}>
                Upload Profile Picture (Optional)
              </span>
            </div>
          )}

          {/* Select User Role (Sign Up Only) */}
          {isSignUp && (
            <div className="form-group">
              <label>Select Role</label>
              <div className="role-selector-grid">
                <button
                  type="button"
                  onClick={() => setRole('user')}
                  className={`btn-role ${role === 'user' ? 'active-user' : ''}`}
                >
                  <User size={20} />
                  <span>Standard</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('youtuber')}
                  className={`btn-role ${role === 'youtuber' ? 'active-youtuber' : ''}`}
                >
                  <YoutubeIcon size={20} color="#FF0000" />
                  <span>Youtuber</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('investor')}
                  className={`btn-role ${role === 'investor' ? 'active-investor' : ''}`}
                >
                  <Briefcase size={20} color="#10b981" />
                  <span>Investor</span>
                </button>
              </div>
            </div>
          )}

          {/* Full Name Input */}
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
                <a href="#forgot" onClick={(e) => e.preventDefault()} className="forgot-link">
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

          {/* YOUTUBER Dynamic Requirement */}
          {isSignUp && role === 'youtuber' && (
            <div className="form-group youtuber-field-wrapper">
              <label htmlFor="youtubeUrl">YouTube Channel / Video Link</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <YoutubeIcon size={18} color="#FF0000" />
                </span>
                <input
                  type="url"
                  id="youtubeUrl"
                  placeholder="https://youtube.com/@channelname"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* INVESTOR Dynamic Verification Requirements */}
          {isSignUp && role === 'investor' && (
            <div className="investor-verification-card">
              <div className="investor-card-header">
                <ShieldCheck size={16} />
                <span>Investor & Project Verification Required</span>
              </div>

              <div className="form-group">
                <label htmlFor="pyCardId">Payoneer / Py Merchant Card ID</label>
                <div className="input-wrapper">
                  <CreditCard size={18} className="input-icon" />
                  <input
                    type="text"
                    id="pyCardId"
                    placeholder="PY-XXXX-XXXX-XXXX"
                    value={pyCardId}
                    onChange={(e) => setPyCardId(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="projectProof">Project Proof / Business Pitch Deck (PDF)</label>
                <div className="input-wrapper">
                  <FileText size={18} className="input-icon" />
                  <input
                    type="file"
                    id="projectProof"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setProjectProof(e.target.files?.[0] || null)}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="btn-login" disabled={loading}>
            <span>{loading ? 'Processing...' : isSignUp ? `Create ${role.toUpperCase()} Account` : 'Sign In'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="login-divider">
          <span>Or continue with</span>
        </div>

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

        <p className="login-footer">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <a href="#toggle" className="signup-link" onClick={toggleAuthMode}>
            {isSignUp ? 'Sign in' : 'Sign up now'}
          </a>
        </p>
      </div>
    </div>
  );
};

export default Auth;