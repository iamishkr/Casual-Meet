import type {
  DiscoverItem,
  DiscoverPersonDTO,
  EmergencyContactDTO,
  FeedResponseDTO,
  FollowDTO,
  MediaUploadResponseDTO,
  MeetingTimerDTO,
  MutualConnectionDTO,
  PostCommentDTO,
  PostDTO,
  Relationship,
  RelationshipDTO,
  SafeZoneDTO,
  SearchResultDTO,
  SocialNotificationDTO,
  SosIncidentDTO,
  StoryDTO,
  StoryGroupDTO,
  StoryViewDTO,
  UserReportDTO,
  VerificationMineDTO,
  UserProfileDTO,
  ChatMessageDTO,
  ConversationDTO,
  ChatReadResponseDTO,
  CommunityDTO,
  CommunityMemberDTO,
  CommunityMembershipRequestDTO,
  CommunityFeedResponseDTO,
} from './types';


export const isCapacitor =
  typeof window !== 'undefined' &&
  (Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
   Boolean((window as any).Capacitor) ||
   window.location.protocol === 'capacitor:' ||
   (window.location.hostname === 'localhost' && window.location.port === ''));

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('casualmeet_server_url');
    if (custom) return custom.replace(/\/api\/?$/, '') + '/api';
  }
  const envBase = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envBase) return envBase;
  return isCapacitor ? 'http://10.151.192.137:5000/api' : '/api';
}

export function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('casualmeet_auth_session_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.token || null;
    }
  } catch {
    // ignore
  }
  return null;
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  if (token) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }
  return { 'Content-Type': 'application/json' };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  const res = await fetch(`${getApiBase()}${endpoint}`, { ...options, headers });

  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) errorMsg = data.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  health: () => request<{ status: string; service: string; database: string; serverTime: string }>('/health'),

  auth: {
    login: (identifier: string, password?: string, targetRole?: string) =>
      request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, targetRole }),
      }),
    register: (userData: any) =>
      request<{ token: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    me: () => request<any>('/auth/me'),
    forgotPassword: (email: string) =>
      request<{ message: string; resetToken?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (resetToken: string, newPassword: string) =>
      request<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ resetToken, newPassword }),
      }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    logout: () =>
      request<{ message: string }>('/auth/logout', {
        method: 'POST',
      }),
  },

  discover: Object.assign(
    (maxKm: number = 10) => request<DiscoverItem[]>(`/discover?maxKm=${maxKm}`),
    {
      nearby: (maxKm: number = 10) => request<DiscoverItem[]>(`/discover?maxKm=${maxKm}`),
      people: (params?: { page?: number; limit?: number; interest?: string }) => {
        const q = new URLSearchParams();
        if (params?.page) q.append('page', String(params.page));
        if (params?.limit) q.append('limit', String(params.limit));
        if (params?.interest) q.append('interest', params.interest);
        const queryStr = q.toString() ? `?${q.toString()}` : '';
        return request<{ people: DiscoverPersonDTO[]; total: number; page: number; limit: number }>(`/discover/people${queryStr}`);
      },
      search: (q: string, type: 'people' | 'posts' | 'all' = 'all', limit: number = 20) =>
        request<SearchResultDTO>(`/discover/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`),
    }
  ),

  location: {
    update: (latitude: number, longitude: number) =>
      request<{ success: boolean; updatedAt: string; message: string }>('/location', {
        method: 'PUT',
        body: JSON.stringify({ latitude, longitude }),
      }),
  },

  safeZones: {
    list: () => request<SafeZoneDTO[]>('/safe-zones'),
  },

  contacts: {
    list: () => request<EmergencyContactDTO[]>('/contacts'),
    create: (data: { name: string; phone: string; relationship?: Relationship; notifyOnSos?: boolean }) =>
      request<EmergencyContactDTO>('/contacts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<{ name: string; phone: string; relationship: Relationship; notifyOnSos: boolean }>) =>
      request<EmergencyContactDTO>(`/contacts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/contacts/${id}`, {
        method: 'DELETE',
      }),
  },

  verification: {
    mine: () => request<VerificationMineDTO>('/verification/mine'),
    submit: (selfieUrl: string) =>
      request<{ success: boolean; message: string; verificationId: string; status: string }>('/verification/submit', {
        method: 'POST',
        body: JSON.stringify({ selfieUrl }),
      }),
  },

  reports: {
    create: (data: {
      reportedUserId?: string;
      targetType?: 'user' | 'post' | 'comment' | 'story';
      targetId?: string;
      category?: string;
      reason: string;
      details?: string;
    }) =>
      request<{ success: boolean; message: string; reportId: string }>('/reports', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    mine: () => request<UserReportDTO[]>('/reports/mine'),
  },

  connections: {
    list: () => request<any[]>('/connections'),
    request: (targetUserId: string) =>
      request<any>('/connections/request', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      }),
    accept: (id: string) =>
      request<{ connection: any; chatId: string }>(`/connections/${id}/accept`, {
        method: 'PUT',
      }),
    reject: (id: string) =>
      request<any>(`/connections/${id}/reject`, {
        method: 'PUT',
      }),
    block: (targetUserId: string) =>
      request<{ success: boolean; message: string }>('/connections/block', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      }),
    unblock: (targetUserId: string) =>
      request<{ success: boolean; message: string; removedBlocks: number }>('/connections/unblock', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      }),
    remove: (id: string) =>
      request<{ success: boolean; message: string }>(`/connections/${id}`, {
        method: 'DELETE',
      }),
    removeByUser: (targetUserId: string) =>
      request<{ success: boolean; message: string }>(`/connections/user/${targetUserId}`, {
        method: 'DELETE',
      }),
  },


  chats: {
    list: (page: number = 1, limit: number = 20) =>
      request<ConversationDTO[]>(`/chats?page=${page}&limit=${limit}`),
    getMessages: (chatId: string, page: number = 1, limit: number = 50) =>
      request<ChatMessageDTO[]>(`/chats/${chatId}/messages?page=${page}&limit=${limit}`),
    sendMessage: (chatId: string, content: string, type: string = 'text') =>
      request<{ message: ChatMessageDTO; flagged: boolean; sensitiveDetails: string[] }>(`/chats/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, type }),
      }),
    markRead: (chatId: string) =>
      request<ChatReadResponseDTO>(`/chats/${chatId}/read`, {
        method: 'PUT',
      }),
    revealMessage: (messageId: string) =>
      request<ChatMessageDTO>(`/chats/messages/${messageId}/reveal`, {
        method: 'PUT',
      }),
    getWithUser: (userId: string) =>
      request<ConversationDTO>(`/chats/with/${userId}`),
  },

  timers: {
    list: () => request<MeetingTimerDTO[]>('/timers'),
    start: (data: { durationMinutes: number; locationName: string; meetWithUserId?: string; testExpireNow?: boolean }) =>
      request<MeetingTimerDTO>('/timers/start', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    safe: (id: string) =>
      request<MeetingTimerDTO>(`/timers/${id}/safe`, {
        method: 'PUT',
      }),
    extend: (id: string, extraMinutes: number = 15) =>
      request<MeetingTimerDTO>(`/timers/${id}/extend`, {
        method: 'PUT',
        body: JSON.stringify({ extraMinutes }),
      }),
    cancel: (id: string) =>
      request<MeetingTimerDTO>(`/timers/${id}/cancel`, {
        method: 'PUT',
      }),
  },

  sos: {
    getActive: () => request<SosIncidentDTO | null>('/sos/active'),
    trigger: (data: { locationName?: string; source?: string; timerId?: string; includeLocation?: boolean }) =>
      request<{ sos: SosIncidentDTO; contactsAlerted: number; dispatchDetails: any[] }>('/sos/trigger', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    resolve: (id: string, status: 'resolved' | 'false_alarm' = 'resolved') =>
      request<SosIncidentDTO>(`/sos/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
  },

  admin: {
    getSos: () => request<{ events: any[]; logs: any[] }>('/admin/sos'),
    getReports: () => request<any[]>('/admin/reports'),
    resolveReport: (id: string, outcome: string, note?: string) =>
      request<any>(`/admin/reports/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ outcome, note }),
      }),
    getVerifications: () => request<any[]>('/admin/verifications'),
    reviewVerification: (id: string, approve: boolean, note?: string) =>
      request<any>(`/admin/verifications/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ approve, note }),
      }),
    getUsers: () => request<{ users: any[]; suspensions: any[] }>('/admin/users'),
    suspendUser: (userId: string, type: string, reason: string, days?: number) =>
      request<any>(`/admin/users/${userId}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ type, reason, days }),
      }),
    liftSuspension: (suspensionId: string) =>
      request<any>(`/admin/suspensions/${suspensionId}`, {
        method: 'DELETE',
      }),
    getDailyAnalytics: () => request<any[]>('/admin/analytics/daily'),
    inspectDb: () => request<any>('/admin/inspect?format=json'),
    getSuspiciousActivity: () =>
      request<{
        flaggedMessages: any[];
        lowTrustUsers: any[];
        activeTimers: any[];
        recentSuspensions: any[];
      }>('/admin/suspicious'),
    getSafeZones: () => request<any[]>('/admin/safe-zones'),
    addSafeZone: (zone: { name: string; category: string; area: string; coordinates?: [number, number] }) =>
      request<any>('/admin/safe-zones', {
        method: 'POST',
        body: JSON.stringify(zone),
      }),
  },

  posts: {
    create: (data: { caption?: string; media?: any[]; visibility?: string; locationName?: string }) =>
      request<PostDTO>('/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: (id: string) => request<PostDTO>(`/posts/${id}`),
    update: (id: string, data: { caption?: string; visibility?: string }) =>
      request<PostDTO>(`/posts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/posts/${id}`, {
        method: 'DELETE',
      }),
    like: (id: string) =>
      request<{ success: boolean; liked: boolean; likeCount: number }>(`/posts/${id}/like`, {
        method: 'POST',
      }),
    unlike: (id: string) =>
      request<{ success: boolean; liked: boolean; likeCount: number }>(`/posts/${id}/like`, {
        method: 'DELETE',
      }),
    getLikes: (id: string, page: number = 1, limit: number = 20) =>
      request<{ likes: any[]; page: number; limit: number }>(`/posts/${id}/likes?page=${page}&limit=${limit}`),
    addComment: (id: string, text: string) =>
      request<PostCommentDTO>(`/posts/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
    getComments: (id: string, page: number = 1, limit: number = 20) =>
      request<{ comments: PostCommentDTO[]; total: number; page: number; limit: number }>(
        `/posts/${id}/comments?page=${page}&limit=${limit}`
      ),
    editComment: (commentId: string, text: string) =>
      request<PostCommentDTO>(`/posts/comments/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ text }),
      }),
    deleteComment: (commentId: string) =>
      request<{ success: boolean; message: string }>(`/posts/comments/${commentId}`, {
        method: 'DELETE',
      }),
  },

  feed: {
    get: (params: { limit?: number; cursor?: string; scope?: string } = {}) => {
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', String(params.limit));
      if (params.cursor) query.set('cursor', params.cursor);
      if (params.scope) query.set('scope', params.scope);
      const qs = query.toString();
      return request<FeedResponseDTO>(`/feed${qs ? `?${qs}` : ''}`);
    },
  },

  social: {
    follow: (userId: string) =>
      request<{ success: boolean; following: boolean; message: string }>(`/users/${userId}/follow`, {
        method: 'POST',
      }),
    unfollow: (userId: string) =>
      request<{ success: boolean; following: boolean; message: string }>(`/users/${userId}/follow`, {
        method: 'DELETE',
      }),
    getFollowers: (userId: string, page: number = 1, limit: number = 20) =>
      request<{ followers: FollowDTO[]; total: number; page: number; limit: number }>(
        `/users/${userId}/followers?page=${page}&limit=${limit}`
      ),
    getFollowing: (userId: string, page: number = 1, limit: number = 20) =>
      request<{ following: FollowDTO[]; total: number; page: number; limit: number }>(
        `/users/${userId}/following?page=${page}&limit=${limit}`
      ),
    getMutualConnections: (userId: string, page: number = 1, limit: number = 20) =>
      request<{ mutualConnections: MutualConnectionDTO[]; total: number; page: number; limit: number }>(
        `/users/${userId}/mutual-connections?page=${page}&limit=${limit}`
      ),
    getRelationship: (userId: string) =>

      request<RelationshipDTO>(`/users/${userId}/relationship`),
    getProfile: (userId: string) =>
      request<UserProfileDTO>(`/users/${userId}/profile`),
    getUserPosts: (userId: string, page: number = 1, limit: number = 20) =>
      request<{ posts: PostDTO[]; total: number; page: number; limit: number }>(
        `/users/${userId}/posts?page=${page}&limit=${limit}`
      ),
  },

  stories: {
    create: (data: { media: { storageKey: string; duration?: number }; caption?: string; visibility?: string }) =>
      request<StoryDTO>('/stories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    list: () => request<StoryGroupDTO[]>('/stories'),
    get: (id: string) => request<StoryDTO>(`/stories/${id}`),
    view: (id: string) =>
      request<{ success: boolean; viewed: boolean }>(`/stories/${id}/view`, {
        method: 'POST',
      }),
    getViews: (id: string) =>
      request<{ storyId: string; totalViews: number; views: StoryViewDTO[] }>(`/stories/${id}/views`),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/stories/${id}`, {
        method: 'DELETE',
      }),
  },

  notifications: {
    list: (page: number = 1, limit: number = 20) =>
      request<{ notifications: SocialNotificationDTO[]; unreadCount: number; total: number; page: number; limit: number }>(
        `/notifications?page=${page}&limit=${limit}`
      ),
    markRead: (id: string) =>
      request<{ success: boolean; message: string }>(`/notifications/${id}/read`, {
        method: 'PUT',
      }),
    markAllRead: () =>
      request<{ success: boolean; updatedCount: number }>('/notifications/read-all', {
        method: 'PUT',
      }),
  },

  media: {
    upload: (fileBase64: string, filename?: string) =>
      request<MediaUploadResponseDTO>('/media/upload', {
        method: 'POST',
        body: JSON.stringify({ fileBase64, filename }),
      }),
  },

  communities: {
    create: (data: { name: string; description?: string; privacy?: 'public' | 'private'; avatar?: string; coverImage?: string }) =>
      request<CommunityDTO>('/communities', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    list: (query?: string, privacy?: string, page: number = 1, limit: number = 20) => {
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      if (privacy) params.append('privacy', privacy);
      params.append('page', String(page));
      params.append('limit', String(limit));
      return request<{ communities: CommunityDTO[]; total: number; page: number; limit: number }>(
        `/communities?${params.toString()}`
      );
    },
    my: (page: number = 1, limit: number = 20) =>
      request<{ communities: CommunityDTO[]; total: number; page: number; limit: number }>(
        `/communities/my?page=${page}&limit=${limit}`
      ),
    get: (id: string) => request<CommunityDTO>(`/communities/${id}`),
    update: (id: string, data: Partial<{ name: string; description: string; privacy: 'public' | 'private'; avatar: string; coverImage: string }>) =>
      request<CommunityDTO>(`/communities/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    join: (id: string) =>
      request<{ message: string; membership: any; community: CommunityDTO }>(`/communities/${id}/join`, {
        method: 'POST',
      }),
    leave: (id: string) =>
      request<{ success: boolean; message: string }>(`/communities/${id}/leave`, {
        method: 'DELETE',
      }),
    getMembers: (id: string, page: number = 1, limit: number = 20) =>
      request<{ members: CommunityMemberDTO[]; total: number; page: number; limit: number }>(
        `/communities/${id}/members?page=${page}&limit=${limit}`
      ),
    getRequests: (id: string, page: number = 1, limit: number = 20) =>
      request<{ requests: CommunityMembershipRequestDTO[]; total: number; page: number; limit: number }>(
        `/communities/${id}/membership-requests?page=${page}&limit=${limit}`
      ),
    approveRequest: (id: string, targetUserId: string) =>
      request<{ success: boolean; message: string }>(`/communities/${id}/membership-requests/${targetUserId}/approve`, {
        method: 'POST',
      }),
    rejectRequest: (id: string, targetUserId: string) =>
      request<{ success: boolean; message: string }>(`/communities/${id}/membership-requests/${targetUserId}/reject`, {
        method: 'POST',
      }),
    updateRole: (id: string, targetUserId: string, role: 'admin' | 'member') =>
      request<{ success: boolean; message: string }>(`/communities/${id}/members/${targetUserId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    removeMember: (id: string, targetUserId: string) =>
      request<{ success: boolean; message: string }>(`/communities/${id}/members/${targetUserId}`, {
        method: 'DELETE',
      }),
    getPosts: (id: string, page: number = 1, limit: number = 20) =>
      request<CommunityFeedResponseDTO>(`/communities/${id}/posts?page=${page}&limit=${limit}`),
    createPost: (id: string, data: { caption?: string; media?: any[]; locationName?: string }) =>
      request<PostDTO>(`/communities/${id}/posts`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};

