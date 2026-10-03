import React, { useState, useEffect } from 'react';
import { Video, X, Check, User } from 'lucide-react';
import './LiveCallNotification.css';

export interface CallRequestData {
  id: string;
  callerName: string;
  callerRole?: string;
  callerAvatarUrl?: string;
  note?: string;
}

interface LiveCallNotificationProps {
  /** تمرير طلب اتصال لتجربة المكون فوراً أو ربطه بـ WebSockets */
  request?: CallRequestData | null;
  onAccept?: (requestId: string) => void;
  onDecline?: (requestId: string) => void;
}

export const LiveCallNotification: React.FC<LiveCallNotificationProps> = ({
  request: propRequest,
  onAccept,
  onDecline,
}) => {
  const [activeRequest, setActiveRequest] = useState<CallRequestData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // إظهار الإشعار عند وصول طلب جديد
  useEffect(() => {
    if (propRequest) {
      setActiveRequest(propRequest);
      setIsVisible(true);
    }
  }, [propRequest]);

  const handleAccept = () => {
    if (!activeRequest) return;
    setIsVisible(false);
    if (onAccept) onAccept(activeRequest.id);
  };

  const handleDecline = () => {
    if (!activeRequest) return;
    setIsVisible(false);
    if (onDecline) onDecline(activeRequest.id);
  };

  if (!isVisible || !activeRequest) return null;

  return (
    <div className="live-call-toast-container">
      <div className="live-call-card">
        {/* الأيقونة النابضة للاتصال */}
        <div className="live-call-pulse-wrapper">
          <div className="live-call-pulse-ring" />
          <div className="live-call-icon-box">
            <Video size={22} className="live-call-icon" />
          </div>
        </div>

        {/* معلومات المتصل */}
        <div className="live-call-details">
          <div className="live-call-header">
            <span className="live-badge">
              <span className="live-dot" /> Incoming Pitch
            </span>
            <button className="live-call-close-btn" onClick={handleDecline} title="Dismiss">
              <X size={16} />
            </button>
          </div>

          <div className="live-caller-info">
            <div className="live-caller-avatar">
              {activeRequest.callerAvatarUrl ? (
                <img src={activeRequest.callerAvatarUrl} alt={activeRequest.callerName} />
              ) : (
                <User size={20} />
              )}
            </div>
            <div>
              <h4 className="live-caller-name">{activeRequest.callerName}</h4>
              {activeRequest.callerRole && (
                <p className="live-caller-role">{activeRequest.callerRole}</p>
              )}
            </div>
          </div>

          {activeRequest.note && (
            <p className="live-call-note">"{activeRequest.note}"</p>
          )}

          {/* أزرار القبول والرفض */}
          <div className="live-call-actions">
            <button className="btn-call-decline" onClick={handleDecline}>
              <X size={16} /> Decline
            </button>
            <button className="btn-call-accept" onClick={handleAccept}>
              <Check size={16} /> Accept & Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCallNotification;