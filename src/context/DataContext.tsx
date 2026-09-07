import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { connectSocket, getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import type { MeetingTimerDTO, SosIncidentDTO } from '../lib/types';

interface DataContextType {
  activeSos: SosIncidentDTO | null;
  activeTimer: MeetingTimerDTO | null;
  unreadCount: number;
  refreshSafetyState: () => Promise<void>;
  triggerSos: (data: { locationName?: string; source?: string; timerId?: string; includeLocation?: boolean }) => Promise<{ ok: boolean; error?: string; sos?: SosIncidentDTO }>;
  resolveSos: (id: string, status?: 'resolved' | 'false_alarm') => Promise<{ ok: boolean; error?: string }>;
  startTimer: (data: { durationMinutes: number; locationName: string; meetWithUserId?: string; testExpireNow?: boolean }) => Promise<{ ok: boolean; error?: string; timer?: MeetingTimerDTO }>;
  extendTimer: (id: string, extraMinutes?: number) => Promise<{ ok: boolean; error?: string; timer?: MeetingTimerDTO }>;
  markTimerSafe: (id: string) => Promise<{ ok: boolean; error?: string; timer?: MeetingTimerDTO }>;
  cancelTimer: (id: string) => Promise<{ ok: boolean; error?: string; timer?: MeetingTimerDTO }>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token, currentUser } = useAuth();
  const { toast } = useToast();

  const [activeSos, setActiveSos] = useState<SosIncidentDTO | null>(null);
  const [activeTimer, setActiveTimer] = useState<MeetingTimerDTO | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const refreshSafetyState = useCallback(async () => {
    if (!isAuthenticated) {
      setActiveSos(null);
      setActiveTimer(null);
      return;
    }

    try {
      const [sosRes, timersRes, chatsRes] = await Promise.allSettled([
        api.sos.getActive(),
        api.timers.list(),
        api.chats.list(),
      ]);

      if (sosRes.status === 'fulfilled') {
        setActiveSos(sosRes.value);
      }

      if (timersRes.status === 'fulfilled' && Array.isArray(timersRes.value)) {
        const found = timersRes.value.find(
          (t) => t.status === 'active' || t.status === 'extended' || t.status === 'expired'
        );
        setActiveTimer(found || null);
      }

      if (chatsRes.status === 'fulfilled' && Array.isArray(chatsRes.value)) {
        // Compute unread count from recent messages
        let unread = 0;
        for (const chat of chatsRes.value) {
          if (chat.unreadCount) unread += chat.unreadCount;
        }
        setUnreadCount(unread);
      }
    } catch {
      // ignore network errors gracefully
    }
  }, [isAuthenticated]);

  // Establish socket connection and register real-time listeners
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setActiveSos(null);
      setActiveTimer(null);
      return;
    }

    refreshSafetyState();
    const socket = connectSocket(token);

    const handleSosTriggered = (data: any) => {
      if (data?.sos) {
        setActiveSos(data.sos);
        toast('err', 'Emergency SOS Triggered', `Incident logged: ${data.sos.locationName || 'Location'}`);
      }
    };

    const handleSosUpdated = (data: any) => {
      if (data?.sos) {
        if (data.sos.status === 'resolved' || data.sos.status === 'false_alarm') {
          setActiveSos(null);
          toast('ok', 'SOS Incident Resolved', `Status: ${data.sos.status.replace('_', ' ')}`);
        } else {
          setActiveSos(data.sos);
        }
      }
    };

    const handleTimerExpired = (data: any) => {
      if (data?.timer) {
        setActiveTimer(data.timer);
        toast('err', 'Safety Timer Expired', 'Automatic SOS escalation dispatched to emergency contacts.');
      }
      refreshSafetyState();
    };

    const handleNotification = (data: any) => {
      if (data?.type === 'new_message') {
        toast('info', `New message from ${data.sender?.name || 'Contact'}`);
        setUnreadCount((c) => c + 1);
      } else if (data?.message) {
        toast('info', data.title || 'Notification', data.message);
      }
    };

    socket.on('sos_triggered', handleSosTriggered);
    socket.on('sos_updated', handleSosUpdated);
    socket.on('timer_expired', handleTimerExpired);
    socket.on('notification', handleNotification);

    return () => {
      socket.off('sos_triggered', handleSosTriggered);
      socket.off('sos_updated', handleSosUpdated);
      socket.off('timer_expired', handleTimerExpired);
      socket.off('notification', handleNotification);
    };
  }, [isAuthenticated, token, refreshSafetyState, toast]);

  const triggerSos = async (data: { locationName?: string; source?: string; timerId?: string; includeLocation?: boolean }) => {
    try {
      const res = await api.sos.trigger(data);
      if (res?.sos) {
        setActiveSos(res.sos);
        toast('err', 'SOS Alert Dispatched', `${res.contactsAlerted} emergency contact(s) notified.`);
        return { ok: true, sos: res.sos };
      }
      return { ok: false, error: 'Unexpected response from server' };
    } catch (err: any) {
      toast('err', 'Failed to Trigger SOS', err.message);
      return { ok: false, error: err.message };
    }
  };

  const resolveSos = async (id: string, status: 'resolved' | 'false_alarm' = 'resolved') => {
    try {
      const res = await api.sos.resolve(id, status);
      setActiveSos(null);
      toast('ok', 'SOS Emergency Resolved', `Marked as ${status.replace('_', ' ')}`);
      return { ok: true };
    } catch (err: any) {
      toast('err', 'Failed to Resolve SOS', err.message);
      return { ok: false, error: err.message };
    }
  };

  const startTimer = async (data: { durationMinutes: number; locationName: string; meetWithUserId?: string; testExpireNow?: boolean }) => {
    try {
      const res = await api.timers.start(data);
      setActiveTimer(res);
      toast('ok', 'Meeting Timer Armed', `${res.durationMinutes} min countdown active.`);
      return { ok: true, timer: res };
    } catch (err: any) {
      toast('err', 'Failed to Start Timer', err.message);
      return { ok: false, error: err.message };
    }
  };

  const extendTimer = async (id: string, extraMinutes: number = 15) => {
    try {
      const res = await api.timers.extend(id, extraMinutes);
      setActiveTimer(res);
      toast('ok', 'Timer Extended', `+${extraMinutes} minutes added.`);
      return { ok: true, timer: res };
    } catch (err: any) {
      toast('err', 'Failed to Extend Timer', err.message);
      return { ok: false, error: err.message };
    }
  };

  const markTimerSafe = async (id: string) => {
    try {
      const res = await api.timers.safe(id);
      setActiveTimer(null);
      toast('ok', 'Marked Safe', 'Meeting completed safely.');
      return { ok: true, timer: res };
    } catch (err: any) {
      toast('err', 'Failed to Resolve Timer', err.message);
      return { ok: false, error: err.message };
    }
  };

  const cancelTimer = async (id: string) => {
    try {
      const res = await api.timers.cancel(id);
      setActiveTimer(null);
      toast('info', 'Timer Cancelled', 'Meeting timer stood down.');
      return { ok: true, timer: res };
    } catch (err: any) {
      toast('err', 'Failed to Cancel Timer', err.message);
      return { ok: false, error: err.message };
    }
  };

  return (
    <DataContext.Provider
      value={{
        activeSos,
        activeTimer,
        unreadCount,
        refreshSafetyState,
        triggerSos,
        resolveSos,
        startTimer,
        extendTimer,
        markTimerSafe,
        cancelTimer,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useData must be used within a DataProvider');
  }
  return ctx;
}
