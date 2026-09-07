import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { engine, useEngine } from '../lib/engine';
import type { Role, User } from '../lib/types';

interface AuthSession {
  userId: string;
  token: string;
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
  login: (identifier: string, password?: string, targetRole?: Role) => Promise<{ ok: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ ok: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message: string; resetToken?: string }>;
  resetPassword: (resetToken: string, newPassword: string) => Promise<{ ok: boolean; message: string }>;
  logout: () => void;
  quickLogin: (userId: string) => void;
}

const STORAGE_KEY = 'casualmeet_auth_session_v1';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const state = useEngine();
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  });

  const currentUser = session ? state.users.find((u) => u.id === session.userId) || null : null;
  const role = currentUser?.role || null;
  const isAuthenticated = !!currentUser;
  const isAdmin = role === 'super_admin' || role === 'moderator';

  // Bidirectionally synchronize session and engine persona
  useEffect(() => {
    // When engine persona changes externally (e.g. from persona switcher or phone simulator), update AuthContext session
    if (state.personaId && state.personaId !== session?.userId) {
      const targetUser = state.users.find((u) => u.id === state.personaId);
      if (targetUser) {
        const updatedSession: AuthSession = {
          userId: targetUser.id,
          token: session?.token || `jwt_${targetUser.id}_${Date.now()}`,
        };
        setSession(updatedSession);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));
      }
    } else if (session?.userId && state.personaId !== session.userId) {
      // If session exists on initial load but engine has default persona, align engine with session
      const userExists = state.users.some((u) => u.id === session.userId);
      if (userExists) {
        try {
          engine.setPersona(session.userId);
        } catch (e) {
          console.warn('Could not sync persona with engine:', e);
        }
      }
    }
  }, [state.personaId, session?.userId, state.users]);

  const saveSession = (sess: AuthSession | null) => {
    setSession(sess);
    if (sess) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
      try {
        engine.setPersona(sess.userId);
      } catch (e) {
        console.warn('Could not set persona in saveSession:', e);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const login = async (identifier: string, password?: string, targetRole?: Role) => {
    const cleanId = identifier.trim().toLowerCase();

    // 1. Try real MongoDB backend via api client
    try {
      const res = await api.auth.login(cleanId, password, targetRole);
      if (res?.token && res?.user) {
        const u = res.user;
        let localUser = state.users.find(
          (x) => x.username.toLowerCase() === u.username.toLowerCase() || x.id === u.id
        );
        if (!localUser) {
          localUser = engine.registerUser({
            id: u.id,
            name: u.name,
            username: u.username,
            email: u.email,
            phone: u.phone,
            role: u.role,
            city: u.city,
            occupation: u.occupation,
          });
        }
        const sess: AuthSession = {
          userId: localUser.id,
          token: res.token,
        };
        saveSession(sess);
        engine.log('auth', `JWT authenticated via MongoDB backend: @${u.username}`, 'POST /api/auth/login', 'ok');
        engine.toast('ok', `Welcome back, ${u.name.split(' ')[0]}!`, `Authenticated via MongoDB (${u.role})`);
        return { ok: true };
      }
    } catch (apiErr: any) {
      if (apiErr.message && !apiErr.message.includes('Failed to fetch') && !apiErr.message.includes('NetworkError')) {
        return { ok: false, error: apiErr.message };
      }
      // Fall through to local fallback if server unreachable
    }

    // 2. Local engine fallback
    let found = state.users.find(
      (u) =>
        u.username.toLowerCase() === cleanId ||
        u.email.toLowerCase() === cleanId ||
        u.id.toLowerCase() === cleanId
    );

    if (!found && targetRole === 'super_admin') {
      found = state.users.find((u) => u.role === 'super_admin');
    }

    if (!found) {
      return { ok: false, error: 'User not found. Use a seeded username like "aisha.k" or "kavita.ops".' };
    }

    const suspension = engine.activeSuspension(found.id);
    if (suspension) {
      return { ok: false, error: `Account is currently suspended: ${suspension.reason}` };
    }

    const sess: AuthSession = {
      userId: found.id,
      token: `jwt_${found.id}_${Date.now()}`,
    };
    saveSession(sess);
    engine.log('auth', `User logged in: @${found.username} (${found.role})`, 'POST /api/auth/login', 'ok');
    engine.toast('ok', `Welcome back, ${found.name.split(' ')[0]}!`, `Logged in as ${found.role}`);
    return { ok: true };
  };

  const register = async (data: RegisterData) => {
    // 1. Try real MongoDB backend via api client
    try {
      const res = await api.auth.register(data);
      if (res?.token && res?.user) {
        const u = res.user;
        const newUser = engine.registerUser({
          id: u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          phone: u.phone,
          city: u.city || data.city,
          occupation: u.occupation || data.occupation,
          role: u.role || data.role,
        });

        if (data.emergencyContactName && data.emergencyContactPhone) {
          engine.addContact({
            name: data.emergencyContactName,
            phone: data.emergencyContactPhone,
            relationship: 'family',
          });
        }

        const sess: AuthSession = {
          userId: newUser.id,
          token: res.token,
        };
        saveSession(sess);
        engine.log('auth', `User saved to MongoDB: @${u.username}`, 'POST /api/auth/register', 'ok');
        engine.toast('ok', 'Account created & saved in MongoDB!', 'Your safety circle is active.');
        return { ok: true };
      }
    } catch (apiErr: any) {
      if (apiErr.message && !apiErr.message.includes('Failed to fetch') && !apiErr.message.includes('NetworkError')) {
        return { ok: false, error: apiErr.message };
      }
    }

    // 2. Local engine fallback
    const existing = state.users.some(
      (u) => u.username.toLowerCase() === data.username.trim().toLowerCase() ||
             u.email.toLowerCase() === data.email.trim().toLowerCase()
    );
    if (existing) {
      return { ok: false, error: 'Username or email is already registered.' };
    }

    const newUser = engine.registerUser({
      name: data.name.trim(),
      username: data.username.trim().toLowerCase(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      city: data.city.trim() || 'Bengaluru',
      occupation: data.occupation.trim() || 'Professional',
      role: data.role || 'user',
    });

    if (data.emergencyContactName && data.emergencyContactPhone) {
      engine.addContact({
        name: data.emergencyContactName,
        phone: data.emergencyContactPhone,
        relationship: 'family',
      });
    }

    const sess: AuthSession = {
      userId: newUser.id,
      token: `jwt_${newUser.id}_${Date.now()}`,
    };
    saveSession(sess);
    engine.toast('ok', 'Account created successfully!', 'Your safety circle is active.');
    return { ok: true };
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
    if (currentUser) {
      engine.log('auth', `User logged out: @${currentUser.username}`, 'POST /api/auth/logout', 'info');
      engine.toast('info', 'Logged out', 'Your session has ended.');
    }
    saveSession(null);
  };

  const quickLogin = async (userId: string) => {
    const user = state.users.find((u) => u.id === userId);
    if (!user) return;

    // Try to obtain genuine backend JWT token
    try {
      const pwd = user.role === 'super_admin' ? 'admin123' : 'user123';
      const res = await api.auth.login(user.username, pwd, user.role);
      if (res?.token) {
        const sess: AuthSession = {
          userId: user.id,
          token: res.token,
        };
        saveSession(sess);
        engine.log('auth', `Quick-switch session → @${user.username} (${user.role}) with MongoDB JWT`, 'POST /api/auth/quick-switch', 'ok');
        engine.toast('ok', `Switched to ${user.name}`, `Role: ${user.role} · JWT verified`);
        return;
      }
    } catch {
      // Fallback if backend temporarily unreachable
    }

    const sess: AuthSession = {
      userId: user.id,
      token: `jwt_${user.id}_${Date.now()}`,
    };
    saveSession(sess);
    engine.log('auth', `Quick-switch session → @${user.username} (${user.role})`, 'POST /api/auth/quick-switch', 'ok');
    engine.toast('ok', `Switched to ${user.name}`, `Role: ${user.role}`);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        token: session?.token || null,
        isAuthenticated,
        isAdmin,
        login,
        register,
        forgotPassword,
        resetPassword,
        logout,
        quickLogin,
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
