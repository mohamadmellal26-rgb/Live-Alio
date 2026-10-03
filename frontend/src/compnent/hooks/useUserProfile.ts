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
    let isMounted = true;

    const fetchUserProfile = async () => {
      // 1. إعادة تصفير البيانات فوراً لضمان عدم إظهار بيانات الصفحة السابقة
      setData(null);
      setIsLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');
        const storedUserRaw = localStorage.getItem('user');
        const parsedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;

        // 2. إعداد الـ Endpoint (البحث عن معرف محدد إذا وُجد في الرابط)
        let endpoint = `${API_BASE_URL}/user/profile`;
        if (username) {
          endpoint += `?identifier=${encodeURIComponent(username)}`;
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // 3. طلب البيانات من الـ Backend
        const response = await fetch(endpoint, {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const result = await response.json();

          // التعامل مع استجابات الباك إند المختلفة (سواء أرجع profile أو user أو الكائن مباشرة)
          const extractedProfile = result.profile || result.user || result.data || result;

          if (extractedProfile && (extractedProfile.fullName || extractedProfile.FullName || extractedProfile.id || extractedProfile.ID)) {
            const apiAvatar =
              extractedProfile.avatarUrl ||
              extractedProfile.avatar ||
              extractedProfile.Avatar ||
              extractedProfile.profilePicture;

            const formattedResponse: UserSessionResponse = {
              profile: {
                id: String(extractedProfile.id || extractedProfile.ID || extractedProfile._id || username),
                fullName: extractedProfile.fullName || extractedProfile.FullName || extractedProfile.name || 'User Profile',
                role: extractedProfile.role || extractedProfile.Role || 'user',
                email: extractedProfile.email || extractedProfile.Email || '',
                isVerified: Boolean(extractedProfile.isVerified),
                isOnlineLive: Boolean(extractedProfile.isOnlineLive),
                avatarUrl: apiAvatar || '',
                location: extractedProfile.location || extractedProfile.Location || '',
                website: extractedProfile.youtubeUrl || extractedProfile.website || extractedProfile.Website || '',
                joinedDate: extractedProfile.createdAt || extractedProfile.joinedDate
                  ? new Date(extractedProfile.createdAt || extractedProfile.joinedDate).toLocaleDateString()
                  : 'Recent',
                bio: extractedProfile.bio || extractedProfile.Bio || '',
                targetIndustry: extractedProfile.targetIndustry || extractedProfile.TargetIndustry || '',
                skills: extractedProfile.skills || extractedProfile.Skills || [],
                focusAreas: extractedProfile.focusAreas || extractedProfile.FocusAreas || [],
                stats: extractedProfile.stats || undefined,
              },
              contents: result.contents || extractedProfile.contents || [],
              primaryColor: result.primaryColor || '#e056fd',
            };

            if (isMounted) {
              setData(formattedResponse);
              setIsLoading(false);
            }
            return;
          }
        }

        // 4. الـ Fallback المحلي يعمل فقط في مسار البروفايل الشخصي (/profile) دون وجود username بالرابط
        const isSelfProfileExplicit = !username || username === 'undefined' || username === 'null';

        if (parsedUser && isSelfProfileExplicit) {
          const rawAvatar = parsedUser.avatarUrl || parsedUser.avatar || parsedUser.profilePicture || '';

          if (isMounted) {
            setData({
              profile: {
                id: String(parsedUser.id || parsedUser._id || '1'),
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
            setIsLoading(false);
          }
        } else {
          // إذا كان الرابط يطلب مستخدمًا معينًا (مثلاً /profile/4) وفشلت الاستجابة، لا نُظهر بيانات المالك إطلاقاً
          throw new Error(username ? `User "${username}" not found.` : 'Failed to load profile.');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Error loading profile.');
          setIsLoading(false);
        }
      }
    };

    fetchUserProfile();

    return () => {
      isMounted = false;
    };
  }, [username]);

  return { data, isLoading, error };
};