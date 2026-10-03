import React, { useState, useEffect } from 'react';
import { X, Edit3, Camera, Save, Loader, User as UserIcon } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  token: string | null;
  apiBaseUrl: string;
  primaryColor: string;
  avatarSrc: string;
  currentUser: any;
  setCurrentUser: (user: any) => void;
  setLocalProfile: React.Dispatch<React.SetStateAction<any>>;
  refetch?: () => Promise<any>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  token,
  apiBaseUrl,
  primaryColor,
  avatarSrc,
  currentUser,
  setCurrentUser,
  setLocalProfile,
  refetch
}) => {
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    role: '',
    bio: '',
    location: '',
    website: '',
    skills: '',
    focusAreas: '',
    targetIndustry: '',
    avatarFile: null as File | null
  });

  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // تعبئة البيانات عند فتح الـ Modal أو تغيّر بيانات المستخدم
  useEffect(() => {
    if (user) {
      setEditFormData({
        fullName: user.fullName || user.FullName || '',
        role: user.role || user.Role || '',
        bio: user.bio || user.Bio || '',
        location: user.location || user.Location || '',
        website: user.website || user.Website || '',
        skills: Array.isArray(user.skills || user.Skills) 
          ? (user.skills || user.Skills).join(', ') 
          : (user.skills || user.Skills || ''),
        focusAreas: Array.isArray(user.focusAreas || user.FocusAreas) 
          ? (user.focusAreas || user.FocusAreas).join(', ') 
          : (user.focusAreas || user.FocusAreas || ''),
        targetIndustry: user.targetIndustry || user.TargetIndustry || '',
        avatarFile: null
      });
    }
  }, [user]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      const skillsArray = editFormData.skills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      
      const focusArray = editFormData.focusAreas
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      let response: Response;

      if (editFormData.avatarFile) {
        const formData = new FormData();
        formData.append('fullName', editFormData.fullName);
        formData.append('role', editFormData.role);
        formData.append('bio', editFormData.bio);
        formData.append('location', editFormData.location);
        formData.append('website', editFormData.website);
        formData.append('targetIndustry', editFormData.targetIndustry);
        formData.append('skills', JSON.stringify(skillsArray));
        formData.append('focusAreas', JSON.stringify(focusArray));
        formData.append('avatar', editFormData.avatarFile);

        response = await fetch(`${apiBaseUrl}/api/user/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      } else {
        const payload = {
          fullName: editFormData.fullName,
          role: editFormData.role,
          bio: editFormData.bio,
          location: editFormData.location,
          website: editFormData.website,
          targetIndustry: editFormData.targetIndustry,
          skills: skillsArray,
          focusAreas: focusArray
        };

        response = await fetch(`${apiBaseUrl}/api/user/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to update profile');
      }

      const updatedRes = await response.json();
      const updatedUser = updatedRes.user || updatedRes.profile || updatedRes;

      // تحديث الواجهة المحلية
      setLocalProfile((prev: any) => ({
        ...prev,
        ...updatedUser,
        fullName: updatedUser.fullName || updatedUser.FullName || editFormData.fullName,
        role: updatedUser.role || updatedUser.Role || editFormData.role,
        bio: updatedUser.bio || updatedUser.Bio || editFormData.bio,
        location: updatedUser.location || updatedUser.Location || editFormData.location,
        website: updatedUser.website || updatedUser.Website || editFormData.website,
        targetIndustry: updatedUser.targetIndustry || updatedUser.TargetIndustry || editFormData.targetIndustry,
        skills: updatedUser.skills || updatedUser.Skills || skillsArray,
        focusAreas: updatedUser.focusAreas || updatedUser.FocusAreas || focusArray,
        avatar: updatedUser.avatar || updatedUser.Avatar || prev?.avatar
      }));

      // تحديث LocalStorage
      if (currentUser) {
        const newUserData = { ...currentUser, ...updatedUser };
        localStorage.setItem('user', JSON.stringify(newUserData));
        setCurrentUser(newUserData);
      }

      if (refetch) {
        await refetch();
      }

      onClose();
      alert('تم تحديث البروفايل بنجاح!');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      alert(err.message || 'حدث خطأ أثناء حفظ البيانات.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ background: '#1e1e24', padding: '1.75rem', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #333' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #2a2a32', paddingBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit3 size={18} style={{ color: primaryColor }} /> Edit Profile Details
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              Profile Picture
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', background: '#121216', border: '1px solid #333' }}>
                {editFormData.avatarFile ? (
                  <img src={URL.createObjectURL(editFormData.avatarFile)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  avatarSrc ? <img src={avatarSrc} alt="Current Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={30} style={{ margin: '15px' }} />
                )}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#27272a', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                <Camera size={16} /> Choose Photo
                <input 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={(e) => setEditFormData({ ...editFormData, avatarFile: e.target.files?.[0] || null })} 
                />
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Full Name</label>
              <input 
                type="text" 
                value={editFormData.fullName}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Title / Role</label>
              <input 
                type="text" 
                value={editFormData.role}
                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                placeholder="e.g. Full-Stack Engineer"
                style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Bio</label>
            <textarea 
              rows={3}
              value={editFormData.bio}
              onChange={(e) => setEditFormData({ ...editFormData, bio: e.target.value })}
              placeholder="Tell the community about yourself..."
              style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Location</label>
              <input 
                type="text" 
                value={editFormData.location}
                onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                placeholder="e.g. Algeria"
                style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Website / Link</label>
              <input 
                type="url" 
                value={editFormData.website}
                onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                placeholder="https://..."
                style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Target Category / Industry</label>
            <input 
              type="text" 
              value={editFormData.targetIndustry}
              onChange={(e) => setEditFormData({ ...editFormData, targetIndustry: e.target.value })}
              placeholder="e.g. Software & Artificial Intelligence"
              style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Skills (Comma Separated)</label>
            <input 
              type="text" 
              value={editFormData.skills}
              onChange={(e) => setEditFormData({ ...editFormData, skills: e.target.value })}
              placeholder="React, Go, C++, Python"
              style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#d4d4d8', fontSize: '0.85rem', marginBottom: '0.4rem' }}>Focus Areas (Comma Separated)</label>
            <input 
              type="text" 
              value={editFormData.focusAreas}
              onChange={(e) => setEditFormData({ ...editFormData, focusAreas: e.target.value })}
              placeholder="Computer Vision, Web Architecture"
              style={{ width: '100%', background: '#121216', border: '1px solid #27272a', borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid #2a2a32', paddingTop: '1rem' }}>
            <button 
              type="button" 
              onClick={onClose}
              style={{ background: '#27272a', color: '#fff', border: 'none', padding: '0.55rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSavingProfile}
              style={{ background: primaryColor, color: '#fff', border: 'none', padding: '0.55rem 1.2rem', borderRadius: '6px', cursor: isSavingProfile ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {isSavingProfile ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
              {isSavingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};