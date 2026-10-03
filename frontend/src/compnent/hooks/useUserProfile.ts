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

const API_BASE_URL = 'https://live-alio-1.onrender.com/api/v1';

export const useUserProfile = (username?: string) => {
  const [data, setData] = useState<UserSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        const storedUserRaw = localStorage.getItem('user');
        const parsedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;

        // 1. إعداد الـ Endpoint الصحيح المتوافق مع Go Fiber (/api/v1/user/profile)
        let endpoint = `${API_BASE_URL}/user/profile`;
        if (username) {
          endpoint += `?identifier=${encodeURIComponent(username)}`;
        }

        // 2. محاولة جلب البيانات من الـ API
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch(endpoint, {
            method: 'GET',
            headers,
          });

          if (response.ok) {
            const result: UserSessionResponse = await response.json();

            if (result.profile) {
              const apiAvatar = result.profile.avatarUrl || (result.profile as any).avatar;
              if (apiAvatar) {
                result.profile.avatarUrl = apiAvatar;
              }
            }

            setData(result);
            setIsLoading(false);
            return;
          }
        } catch (networkErr) {
          console.warn('Network or API Error, falling back to local user:', networkErr);
        }

        // 3. Fallback: استخدام البيانات المحلية إذا فشل الاتصال بالباك إند وكانت الصفحة تخص المستخدم الحالي
        const currentUserId = parsedUser?.id || parsedUser?._id;
        const currentUsername = parsedUser?.username;
        const currentEmail = parsedUser?.email;

        const isSelfProfile =
          !username ||
          username === currentUserId ||
          username === currentUsername ||
          username === currentEmail;

        if (parsedUser && isSelfProfile) {
          const rawAvatar = parsedUser.avatarUrl || parsedUser.avatar || parsedUser.profilePicture || '';

          setData({
            profile: {
              id: parsedUser.id || parsedUser._id || '1',
              fullName: parsedUser.fullName || parsedUser.name || 'User Profile',
              role: parsedUser.role || 'user',
              email: parsedUser.email || '',
              isVerified: Boolean(parsedUser.isVerified),
              isOnlineLive: false,
              avatarUrl: rawAvatar,
              location: parsedUser.location || '',
              website: parsedUser.youtubeUrl || parsedUser.website || '',
              joinedDate: parsedUser.createdAt
                ? new Date(parsedUser.createdAt).toLocaleDateString()
                : 'Recent',
              bio: parsedUser.bio || '',
              targetIndustry: parsedUser.targetIndustry || '',
              skills: parsedUser.skills || [],
              focusAreas: parsedUser.focusAreas || [],
              stats: parsedUser.stats || undefined,
            },
            contents: parsedUser.contents || [],
            primaryColor: '#e056fd',
          });
        } else {
          throw new Error(
            username ? `Could not load profile for "${username}".` : 'Failed to load profile session.'
          );
        }
      } catch (err: any) {
        setError(err.message || 'Error loading profile.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [username]);

  return { data, isLoading, error };
};