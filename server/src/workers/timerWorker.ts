import { MeetingTimer } from '../models/MeetingTimer.js';
import { SosEvent } from '../models/SosEvent.js';
import { dispatchEmergencyAlerts } from '../services/dispatchService.js';
import { emitToUser, emitToAdmins } from '../socket.js';
import { sendNotification } from '../services/notificationService.js';

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Checks for expired safety meeting timers and atomically triggers
 * emergency SOS escalations with strict idempotency.
 */
export async function checkExpiredTimers(): Promise<{ processedCount: number; sosCreatedCount: number }> {
  if (isRunning) {
    return { processedCount: 0, sosCreatedCount: 0 };
  }

  isRunning = true;
  let processedCount = 0;
  let sosCreatedCount = 0;

  try {
    const now = new Date();

    // 1. Find all candidates that have exceeded their expiresAt timestamp
    const candidates = await MeetingTimer.find({
      status: { $in: ['active', 'extended'] },
      expiresAt: { $lte: now },
    }).limit(50);

    for (const candidate of candidates) {
      // 2. Atomically transition state to 'expired' to prevent race conditions
      const timer = await MeetingTimer.findOneAndUpdate(
        { _id: candidate._id, status: { $in: ['active', 'extended'] } },
        {
          $set: {
            status: 'expired',
            checkSentAt: now,
          },
        },
        { new: true }
      );

      // If already claimed/resolved concurrently, skip
      if (!timer) continue;

      processedCount++;
      console.warn(`[TimerWorker] Safety timer ${timer._id} expired for user ${timer.userId}. Escalating to SOS.`);

      // 3. Idempotency check: Ensure an active SOS doesn't already exist for this timer or user
      const existingSos = await SosEvent.findOne({
        $or: [
          { triggeredTimerId: timer._id },
          { userId: timer.userId, status: 'active' },
        ],
      });

      if (existingSos) {
        console.warn(`[TimerWorker] Active SOS incident ${existingSos._id} already exists for user ${timer.userId}. Skipping duplicate SOS creation.`);
        // Emit timer_expired event to user room
        emitToUser(timer.userId.toString(), 'timer_expired', {
          timerId: timer._id,
          sosId: existingSos._id,
          reason: 'Meeting timer expired. Existing active SOS associated.',
        });
        continue;
      }

      // 4. Create authoritative SOS incident
      const sos = await SosEvent.create({
        userId: timer.userId,
        source: 'timer_expired',
        location: timer.meetupLocation,
        locationName: timer.locationName || 'Timer Auto-Escalation Location',
        status: 'active',
        triggeredTimerId: timer._id,
        adminNotified: true,
      });

      sosCreatedCount++;

      // 5. Dispatch emergency alerts via provider adapter
      try {
        const dispatchResults = await dispatchEmergencyAlerts(sos);
        const delivered = dispatchResults.filter((r) => r.status === 'sent' || r.status === 'simulated').length;
        sos.contactsNotified = delivered;
        sos.smsSent = delivered > 0;
        sos.lastDispatchAt = new Date();
        await sos.save();
      } catch (dispatchErr: any) {
        console.error(`[TimerWorker] Error dispatching alerts for SOS ${sos._id}:`, dispatchErr.message);
      }

      // 6. Broadcast authoritative real-time socket events
      emitToUser(timer.userId.toString(), 'timer_expired', {
        timerId: timer._id,
        sosId: sos._id,
      });

      emitToUser(timer.userId.toString(), 'sos_triggered', sos);
      emitToAdmins('sos_triggered', sos);

      // Persist unified safety notification
      await sendNotification({
        recipientId: timer.userId,
        actor: { _id: timer.userId, name: 'CasualMeet Safety Engine', username: 'safety' },
        type: 'safety_timer',
        title: 'Safety Timer Expired',
        message: `Your meeting safety timer for "${timer.locationName || 'Meetup'}" has expired. Emergency escalation initiated.`,
        targetType: 'user',
        targetId: timer.userId,
      });
    }
  } catch (err: any) {
    console.error('[TimerWorker] Error in timer check cycle:', err.message);
  } finally {
    isRunning = false;
  }

  return { processedCount, sosCreatedCount };
}

/**
 * Initialize background timer inspection worker.
 * Runs every intervalMs (default: 5 seconds).
 */
export function initTimerWorker(intervalMs = 5000): void {
  if (intervalId) return;

  console.log(`⏱️ Initializing Server-Side Safety Timer Worker (Interval: ${intervalMs}ms)...`);
  intervalId = setInterval(async () => {
    try {
      await checkExpiredTimers();
    } catch (e: any) {
      console.error('[TimerWorker Interval Error]:', e);
    }
  }, intervalMs);
}

/**
 * Stop the background timer inspection worker.
 */
export function stopTimerWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏱️ Stopped Server-Side Safety Timer Worker.');
  }
}
