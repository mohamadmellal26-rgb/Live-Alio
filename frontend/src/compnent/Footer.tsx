import React from 'react';
import './Footer.css';

export const Footer: React.FC = () => {
  return (
    <footer className="aleo-footer">
      <div className="footer-container">
        {/* Top Section: Brand & Newsletter */}
        <div className="footer-top-grid">
          <div className="footer-brand-section">
            <a href="/" className="footer-logo">
              <span className="logo-brand">Live-Aleo</span>
            </a>
            <p className="footer-tagline">
              The ultimate customizable random live streaming platform. Connect instantly, match by interests, and create your unique live experience.
            </p>
            <div className="footer-socials">
              <a href="#twitter" aria-label="Twitter" className="social-link">
                <svg className="social-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>
              </a>
              <a href="#discord" aria-label="Discord" className="social-link">
                <svg className="social-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.893.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              </a>
              <a href="#youtube" aria-label="YouTube" className="social-link">
                <svg className="social-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
              <a href="#github" aria-label="GitHub" className="social-link">
                <svg className="social-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              </a>
            </div>
          </div>

          <div className="footer-newsletter">
            <h3 className="newsletter-title">Subscribe to Aleo Updates</h3>
            <p className="newsletter-desc">Get notified about new live features, matching algorithms, and creator tools.</p>
            <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="Enter your email address..." className="newsletter-input" required />
              <button type="submit" className="btn-subscribe">Subscribe</button>
            </form>
          </div>
        </div>

        {/* Middle Section: Links Columns */}
        <div className="footer-links-grid">
          <div className="footer-column">
            <h4 className="column-title">Live Experience</h4>
            <ul className="column-links">
              <li><a href="#random-match">Custom Random Match</a></li>
              <li><a href="#filters">Topic & Interest Filters</a></li>
              <li><a href="#creators">Creator Live Hub</a></li>
              <li><a href="#ai-enhance">AI Live Filters</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4 className="column-title">Company</h4>
            <ul className="column-links">
              <li><a href="#about">About Aleo_live</a></li>
              <li><a href="#careers">Careers <span className="hiring-badge">We're Hiring</span></a></li>
              <li><a href="#press">Press & Media</a></li>
              <li><a href="#blog">Tech Blog</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4 className="column-title">Resources</h4>
            <ul className="column-links">
              <li><a href="#community">Community Guidelines</a></li>
              <li><a href="#help">Help & Support</a></li>
              <li><a href="#api">Developer API</a></li>
              <li><a href="#status">System Status</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4 className="column-title">Safety & Legal</h4>
            <ul className="column-links">
              <li><a href="#privacy">Privacy Policy</a></li>
              <li><a href="#terms">Terms of Service</a></li>
              <li><a href="#safety">Safety Center</a></li>
              <li><a href="#cookies">Cookie Settings</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Section: Copyright & Bottom Status */}
        <div className="footer-bottom">
          <p className="copyright-text">
            © {new Date().getFullYear()} Aleo_live Inc. All rights reserved.
          </p>
          <div className="system-status">
            <span className="status-dot"></span>
            All Live Servers Operational
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;