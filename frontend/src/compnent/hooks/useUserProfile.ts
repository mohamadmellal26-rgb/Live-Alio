import { useState, useEffect } from 'react';

export interface UserProfileData {
  id: string;
  fullName: string;
  role: string;
  email?: string;
  isVerified?: boolean;
  isOnlineLive?: boolean;
  avatarUrl?: string;
  location?: string;
  website?: string;
  joinedDate?: string;
  bio?: string;
  targetIndustry?: string;
  stats?: {
    stat1Label?: string;
    stat1Value?: string | number;
    stat2Label?: string;
    stat2Value?: string | number;
    stat3Label?: string;
    stat3Value?: string | number;
    stat4Label?: string;
    stat4Value?: string | number;
  };
  skills?: string[];
  focusAreas?: string[];
}

export interface ContentItem {
  id: string;
  title: string;
  duration?: string;
  thumbnail?: string;
  views?: number;
  category?: string;
}

interface UserSessionResponse {
  profile: UserProfileData;
  contents?: ContentItem[];
  primaryColor?: string;
}

const API_BASE_URL = 'https://live-alio.onrender.com/api/v1';

export const useUserProfile = () => {
  const [data, setData] = useState<UserSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        const storedUserRaw = localStorage.getItem('user');

        if (!token && !storedUserRaw) {
          throw new Error('No authentication token found.');
        }

        let isSuccess = false;

        // 1. محاولة جلب البيانات الحقيقية من API الـ Render
        if (token) {
          try {
            const response = await fetch(`${API_BASE_URL}/profile`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
            });

            if (response.ok) {
              const result: UserSessionResponse = await response.json();
              
              // معالجة رابط الصورة القادم من الـ API
              if (result.profile) {
                const apiAvatar = result.profile.avatarUrl || (result.profile as any).avatar;
                if (apiAvatar) {
                  result.profile.avatarUrl = apiAvatar;
                }
              }

              setData(result);
              isSuccess = true;
            }
          } catch (networkErr) {
            console.warn('Network or API Error, fallback to LocalStorage:', networkErr);
          }
        }

        // 2. القراءة من LocalStorage في حال عدم توفر رد الـ API
        if (!isSuccess && storedUserRaw) {
          const parsedUser = JSON.parse(storedUserRaw);

          const rawAvatar = parsedUser.avatarUrl || parsedUser.avatar || parsedUser.profilePicture || '';
          
          setData({
            profile: {
              id: parsedUser.id || parsedUser._id || '',
              fullName: parsedUser.fullName || parsedUser.name || '',
              role: parsedUser.role || 'user',
              email: parsedUser.email || '',
              isVerified: Boolean(parsedUser.isVerified),
              isOnlineLive: false,
              avatarUrl: rawAvatar,
              location: parsedUser.location || '',
              website: parsedUser.youtubeUrl || parsedUser.website || '',
              joinedDate: parsedUser.createdAt ? new Date(parsedUser.createdAt).toLocaleDateString() : 'Recent',
              bio: parsedUser.bio || '',
              targetIndustry: parsedUser.targetIndustry || '',
              skills: parsedUser.skills || [],
              focusAreas: parsedUser.focusAreas || [],
              stats: parsedUser.stats || undefined
            },
            contents: parsedUser.contents || [],
            primaryColor: '#e056fd'
          });
        } else if (!isSuccess) {
          throw new Error('Failed to load profile session.');
        }
      } catch (err: any) {
        setError(err.message || 'Error loading profile.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  return { data, isLoading, error };
};