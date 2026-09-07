const isCapacitor =
  typeof window !== 'undefined' &&
  (Boolean((window as any).Capacitor) || window.location.protocol === 'capacitor:');

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (isCapacitor ? 'http://192.168.1.6:5000/api' : '/api');

function getAuthHeaders(): HeadersInit {
  try {
    const raw = localStorage.getItem('casualmeet_auth_session_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token) {
        return {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parsed.token}`,
        };
      }
    }
  } catch {
    // ignore
  }
  return { 'Content-Type': 'application/json' };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

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
  health: () => request<{ status: string; service: string; database: string }>('/health'),

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

  discover: (maxKm: number = 10) => request<any[]>(`/discover?maxKm=${maxKm}`),

  connections: {
    list: () => request<any[]>('/connections'),
    request: (targetUserId: string) =>
      request<any>('/connections/request', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      }),
    accept: (id: string) =>
      request<any>(`/connections/${id}/accept`, {
        method: 'PUT',
      }),
    reject: (id: string) =>
      request<any>(`/connections/${id}/reject`, {
        method: 'PUT',
      }),
  },

  chats: {
    list: () => request<any[]>('/chats'),
    getMessages: (chatId: string) => request<any[]>(`/chats/${chatId}/messages`),
    sendMessage: (chatId: string, content: string, type: string = 'text') =>
      request<any>(`/chats/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, type }),
      }),
    revealMessage: (messageId: string) =>
      request<any>(`/chats/messages/${messageId}/reveal`, {
        method: 'PUT',
      }),
  },

  timers: {
    list: () => request<any[]>('/timers'),
    start: (data: { durationMinutes: number; locationName: string; meetWithUserId?: string }) =>
      request<any>('/timers/start', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    safe: (id: string) =>
      request<any>(`/timers/${id}/safe`, {
        method: 'PUT',
      }),
    extend: (id: string, extraMinutes: number = 15) =>
      request<any>(`/timers/${id}/extend`, {
        method: 'PUT',
        body: JSON.stringify({ extraMinutes }),
      }),
    cancel: (id: string) =>
      request<any>(`/timers/${id}/cancel`, {
        method: 'PUT',
      }),
  },

  sos: {
    getActive: () => request<any>('/sos/active'),
    trigger: (data: { locationName?: string; source?: string; timerId?: string; includeLocation?: boolean }) =>
      request<any>('/sos/trigger', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    resolve: (id: string, status: 'resolved' | 'false_alarm') =>
      request<any>(`/sos/${id}/resolve`, {
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
};
