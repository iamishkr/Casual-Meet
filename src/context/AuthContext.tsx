import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { disconnectSocket } from '../lib/socket';
import type { Role, User } from '../lib/types';

interface AuthSession {
  userId: string;
  token: string;
  user?: any;
}

export interface RegisterData {
  name: string;
  username: string;
  email: string;
  password?: string;
  phone: string;
  city: string;
  occupation: string;
  role?: Role;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

interface AuthContextType {
  currentUser: User | null;
  role: Role | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (identifier: string, password?: string, targetRole?: Role) => Promise<{ ok: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ ok: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message: string; resetToken?: string }>;
  resetPassword: (resetToken: string, newPassword: string) => Promise<{ ok: boolean; message: string }>;
  logout: () => void;
  quickLogin: (username: string, targetRole?: Role) => Promise<{ ok: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const STORAGE_KEY = 'casualmeet_auth_session_v1';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (session?.user) {
      return {
        id: session.user._id || session.user.id,
        name: session.user.name,
        username: session.user.username,
        email: session.user.email,
        phone: session.user.phone,
        age: session.user.age || 25,
        bio: session.user.bio || '',
        occupation: session.user.occupation || 'Member',
        city: session.user.city || 'Bengaluru',
        interests: session.user.interests || ['Tech', 'Coffee'],
        lookingFor: session.user.lookingFor || 'Casual meetup',
        role: session.user.role || 'user',
        isVerified: !!session.user.isVerified,
        trustScore: session.user.trustScore ?? 100,
        showLocation: session.user.showLocation !== false,
        allowMessages: session.user.allowMessages || 'everyone',
        onboardingComplete: session.user.onboardingComplete !== false,
        expoPushToken: session.user.expoPushToken || '',
        avatarHue: session.user.avatarHue ?? 40,
        joinedDaysAgo: 1,
      };
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const saveSession = useCallback((sess: AuthSession | null) => {
    setSession(sess);
    if (sess) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      disconnectSocket();
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.auth.me();
      if (res?.user) {
        const u = res.user;
        const normalized: User = {
          id: u._id || u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          phone: u.phone,
          age: u.age || 25,
          bio: u.bio || '',
          occupation: u.occupation || 'Member',
          city: u.city || 'Bengaluru',
          interests: u.interests || ['Tech', 'Coffee'],
          lookingFor: u.lookingFor || 'Casual meetup',
          role: u.role || 'user',
          isVerified: !!u.isVerified,
          trustScore: u.trustScore ?? 100,
          showLocation: u.showLocation !== false,
          allowMessages: u.allowMessages || 'everyone',
          onboardingComplete: u.onboardingComplete !== false,
          expoPushToken: u.expoPushToken || '',
          avatarHue: u.avatarHue ?? 40,
          joinedDaysAgo: 1,
        };
        setCurrentUser(normalized);
      }
    } catch {
      // If token is invalid or expired, clear session
      saveSession(null);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [saveSession]);

  useEffect(() => {
    if (session?.token) {
      refreshUser();
    } else {
      setIsLoading(false);
    }
  }, [session?.token, refreshUser]);

  const role = currentUser?.role || null;
  const isAuthenticated = !!currentUser;
  const isAdmin = role === 'super_admin' || role === 'moderator';

  const login = async (identifier: string, password?: string, targetRole?: Role) => {
    const cleanId = identifier.trim().toLowerCase();
    try {
      const res = await api.auth.login(cleanId, password, targetRole);
      if (res?.token && res?.user) {
        const u = res.user;
        const sess: AuthSession = {
          userId: u._id || u.id,
          token: res.token,
          user: u,
        };
        saveSession(sess);
        const normalized: User = {
          id: u._id || u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          phone: u.phone,
          age: u.age || 25,
          bio: u.bio || '',
          occupation: u.occupation || 'Member',
          city: u.city || 'Bengaluru',
          interests: u.interests || ['Tech', 'Coffee'],
          lookingFor: u.lookingFor || 'Casual meetup',
          role: u.role || 'user',
          isVerified: !!u.isVerified,
          trustScore: u.trustScore ?? 100,
          showLocation: u.showLocation !== false,
          allowMessages: u.allowMessages || 'everyone',
          onboardingComplete: u.onboardingComplete !== false,
          expoPushToken: u.expoPushToken || '',
          avatarHue: u.avatarHue ?? 40,
          joinedDaysAgo: 1,
        };
        setCurrentUser(normalized);
        return { ok: true };
      }
      return { ok: false, error: 'Invalid response from server' };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Login failed' };
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const res = await api.auth.register(data);
      if (res?.token && res?.user) {
        const u = res.user;
        const sess: AuthSession = {
          userId: u._id || u.id,
          token: res.token,
          user: u,
        };
        saveSession(sess);
        const normalized: User = {
          id: u._id || u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          phone: u.phone,
          age: u.age || 25,
          bio: u.bio || '',
          occupation: u.occupation || data.occupation,
          city: u.city || data.city,
          interests: u.interests || ['Tech', 'Coffee'],
          lookingFor: u.lookingFor || 'Casual meetup',
          role: u.role || 'user',
          isVerified: !!u.isVerified,
          trustScore: u.trustScore ?? 100,
          showLocation: u.showLocation !== false,
          allowMessages: u.allowMessages || 'everyone',
          onboardingComplete: true,
          expoPushToken: '',
          avatarHue: u.avatarHue ?? 40,
          joinedDaysAgo: 1,
        };
        setCurrentUser(normalized);

        // If emergency contact was provided during registration, create it on backend
        if (data.emergencyContactName && data.emergencyContactPhone) {
          try {
            await api.contacts.create({
              name: data.emergencyContactName,
              phone: data.emergencyContactPhone,
              relationship: 'family',
            });
          } catch {
            // Non-blocking
          }
        }

        return { ok: true };
      }
      return { ok: false, error: 'Registration response invalid' };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Registration failed' };
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await api.auth.forgotPassword(email);
      return { ok: true, message: res.message, resetToken: res.resetToken };
    } catch (err: any) {
      return { ok: false, message: err.message || 'Failed to initiate password reset.' };
    }
  };

  const resetPassword = async (resetToken: string, newPassword: string) => {
    try {
      const res = await api.auth.resetPassword(resetToken, newPassword);
      return { ok: true, message: res.message };
    } catch (err: any) {
      return { ok: false, message: err.message || 'Failed to reset password.' };
    }
  };

  const logout = () => {
    api.auth.logout().catch(() => {});
    saveSession(null);
    setCurrentUser(null);
  };

  const quickLogin = async (username: string, targetRole?: Role) => {
    const cleanUser = username.trim().toLowerCase();
    const pwd = targetRole === 'super_admin' || cleanUser.includes('admin') || cleanUser.includes('kavita')
      ? 'admin123'
      : 'user123';
    return login(cleanUser, pwd, targetRole);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        token: session?.token || null,
        isAuthenticated,
        isAdmin,
        isLoading,
        login,
        register,
        forgotPassword,
        resetPassword,
        logout,
        quickLogin,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
