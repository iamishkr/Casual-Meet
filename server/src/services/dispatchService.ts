/**
 * Real-Time Emergency SOS Dispatch Service & Provider Adapters
 * 
 * Supports production integration with Twilio & Fast2SMS with:
 * - Intelligent carrier routing (Fast2SMS for India, Twilio for International/India failover)
 * - Automatic carrier failover if primary provider encounters delivery errors
 * - Development Simulation Adapter when live credentials are not present
 * - Per-incident delivery logging with carrier SIDs and audit records in MongoDB
 * - Failed alert retry mechanisms & operational health inspection
 */

import mongoose from 'mongoose';
import { EmergencyContact } from '../models/EmergencyContact.js';
import { SosDeliveryLog } from '../models/SosDeliveryLog.js';
import { ISosEvent } from '../models/SosEvent.js';
import { isIndianNumber, normalizePhone } from '../utils/scanner.js';

export interface DispatchResult {
  contactId?: string;
  contactName?: string;
  phone: string;
  gateway: 'fast2sms' | 'twilio';
  status: 'sent' | 'simulated' | 'failed';
  sid: string;
  cost?: string;
  error?: string;
  failoverUsed?: boolean;
}

export interface GatewayStatus {
  mode: 'live' | 'simulated';
  fast2sms: {
    configured: boolean;
    route: string;
  };
  twilio: {
    configured: boolean;
    senderNumber: string | null;
  };
}

/**
 * Returns current configuration status of SMS gateways.
 */
export function getSmsGatewayStatus(): GatewayStatus {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  const fast2SmsKey = process.env.FAST2SMS_API_KEY;

  const hasTwilio = Boolean(twilioSid && twilioToken && twilioFrom);
  const hasFast2Sms = Boolean(fast2SmsKey);

  return {
    mode: hasFast2Sms || hasTwilio ? 'live' : 'simulated',
    fast2sms: {
      configured: hasFast2Sms,
      route: 'q',
    },
    twilio: {
      configured: hasTwilio,
      senderNumber: twilioFrom ? `${twilioFrom.slice(0, 4)}...${twilioFrom.slice(-4)}` : null,
    },
  };
}

/**
 * Helper to dispatch SMS via Fast2SMS Quick Route API (India).
 */
async function sendViaFast2Sms(phone: string, message: string, apiKey: string): Promise<{ ok: boolean; sid?: string; cost?: string; error?: string }> {
  try {
    const rawDigits = phone.replace(/^\+91/, '').replace(/\D/g, '');
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        message,
        language: 'english',
        numbers: rawDigits,
      }),
    });

    const data: any = await res.json().catch(() => ({}));
    if (res.ok && data.return === true) {
      const sid = data.request_id || `F2S_${Date.now()}`;
      return { ok: true, sid, cost: '₹0.16' };
    }

    const errorMsg = Array.isArray(data.message) ? data.message.join(', ') : (data.message || `HTTP ${res.status}`);
    return { ok: false, error: `Fast2SMS error: ${errorMsg}` };
  } catch (err: any) {
    return { ok: false, error: `Fast2SMS network error: ${err.message || err}` };
  }
}

/**
 * Helper to dispatch SMS via Twilio Messages REST API (Global).
 */
async function sendViaTwilio(
  phone: string,
  message: string,
  accountSid: string,
  authToken: string,
  fromNumber: string
): Promise<{ ok: boolean; sid?: string; cost?: string; error?: string }> {
  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const body = new URLSearchParams({
      To: phone,
      From: fromNumber,
      Body: message,
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data: any = await res.json().catch(() => ({}));
    if (res.ok && data.sid) {
      return { ok: true, sid: data.sid, cost: '$0.0079' };
    }

    const errorMsg = data.message || `Twilio error HTTP ${res.status}`;
    return { ok: false, error: errorMsg };
  } catch (err: any) {
    return { ok: false, error: `Twilio network error: ${err.message || err}` };
  }
}

/**
 * Dispatches a single SMS alert using carrier selection and automatic failover.
 */
export async function dispatchSingleAlert(params: {
  phone: string;
  message: string;
  sosId?: mongoose.Types.ObjectId | string;
  contactId?: mongoose.Types.ObjectId | string;
  contactName?: string;
  attempts?: number;
}): Promise<DispatchResult> {
  const { phone, message, sosId, contactId, contactName = 'Emergency Contact', attempts = 1 } = params;

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  const fast2SmsKey = process.env.FAST2SMS_API_KEY;

  const hasTwilio = Boolean(twilioSid && twilioToken && twilioFrom);
  const hasFast2Sms = Boolean(fast2SmsKey);

  const cleanPhone = normalizePhone(phone);
  const isIndia = isIndianNumber(cleanPhone);
  const primaryGateway: 'fast2sms' | 'twilio' = isIndia ? 'fast2sms' : 'twilio';

  let attemptedGateway: 'fast2sms' | 'twilio' = primaryGateway;
  let liveAttempted = false;
  let failoverUsed = false;
  let lastError: string | undefined;

  // 1. Primary Carrier Dispatch Attempt
  if (primaryGateway === 'fast2sms' && hasFast2Sms) {
    liveAttempted = true;
    const res = await sendViaFast2Sms(cleanPhone, message, fast2SmsKey!);
    if (res.ok && res.sid) {
      if (sosId) {
        await SosDeliveryLog.create({
          sosId: new mongoose.Types.ObjectId(sosId.toString()),
          contactId: contactId ? new mongoose.Types.ObjectId(contactId.toString()) : undefined,
          contactName,
          contactPhone: cleanPhone,
          gateway: 'fast2sms',
          status: 'sent',
          attempts,
          gatewayResponse: { sid: res.sid, status: 'delivered', cost: res.cost || '₹0.16' },
        });
      }
      return {
        contactId: contactId?.toString(),
        contactName,
        phone: cleanPhone,
        gateway: 'fast2sms',
        status: 'sent',
        sid: res.sid,
        cost: res.cost,
      };
    }
    lastError = res.error;
    console.warn(`[DispatchService] Primary Fast2SMS failed: ${lastError}. Checking failover...`);
  } else if (primaryGateway === 'twilio' && hasTwilio) {
    liveAttempted = true;
    const res = await sendViaTwilio(cleanPhone, message, twilioSid!, twilioToken!, twilioFrom!);
    if (res.ok && res.sid) {
      if (sosId) {
        await SosDeliveryLog.create({
          sosId: new mongoose.Types.ObjectId(sosId.toString()),
          contactId: contactId ? new mongoose.Types.ObjectId(contactId.toString()) : undefined,
          contactName,
          contactPhone: cleanPhone,
          gateway: 'twilio',
          status: 'sent',
          attempts,
          gatewayResponse: { sid: res.sid, status: 'sent', cost: res.cost || '$0.0079' },
        });
      }
      return {
        contactId: contactId?.toString(),
        contactName,
        phone: cleanPhone,
        gateway: 'twilio',
        status: 'sent',
        sid: res.sid,
        cost: res.cost,
      };
    }
    lastError = res.error;
    console.warn(`[DispatchService] Primary Twilio failed: ${lastError}.`);
  }

  // 2. Automatic Failover: If Fast2SMS failed or was absent for an Indian number, failover to Twilio
  if (isIndia && hasTwilio && (!hasFast2Sms || lastError)) {
    liveAttempted = true;
    attemptedGateway = 'twilio';
    failoverUsed = true;
    console.log(`[DispatchService] Attempting Twilio failover delivery to ${cleanPhone}...`);

    const twilioRes = await sendViaTwilio(cleanPhone, message, twilioSid!, twilioToken!, twilioFrom!);
    if (twilioRes.ok && twilioRes.sid) {
      if (sosId) {
        await SosDeliveryLog.create({
          sosId: new mongoose.Types.ObjectId(sosId.toString()),
          contactId: contactId ? new mongoose.Types.ObjectId(contactId.toString()) : undefined,
          contactName,
          contactPhone: cleanPhone,
          gateway: 'twilio',
          status: 'sent',
          attempts,
          gatewayResponse: {
            sid: twilioRes.sid,
            status: 'sent',
            cost: twilioRes.cost || '$0.0079',
            note: 'Delivered via carrier failover',
          },
        });
      }
      return {
        contactId: contactId?.toString(),
        contactName,
        phone: cleanPhone,
        gateway: 'twilio',
        status: 'sent',
        sid: twilioRes.sid,
        cost: twilioRes.cost,
        failoverUsed: true,
      };
    }
    lastError = `Primary & failover failed: ${lastError}; Twilio: ${twilioRes.error}`;
  }

  // 3. Live carrier was attempted but failed
  if (liveAttempted) {
    if (sosId) {
      await SosDeliveryLog.create({
        sosId: new mongoose.Types.ObjectId(sosId.toString()),
        contactId: contactId ? new mongoose.Types.ObjectId(contactId.toString()) : undefined,
        contactName,
        contactPhone: cleanPhone,
        gateway: attemptedGateway,
        status: 'failed',
        attempts,
        lastError,
      });
    }
    return {
      contactId: contactId?.toString(),
      contactName,
      phone: cleanPhone,
      gateway: attemptedGateway,
      status: 'failed',
      sid: 'NONE',
      error: lastError,
      failoverUsed,
    };
  }

  // 4. Development Simulation Adapter (Explicitly Labeled)
  const simulatedSid = primaryGateway === 'fast2sms'
    ? `SIM_F2S_${Date.now().toString(36).toUpperCase()}`
    : `SIM_TW_${Date.now().toString(36).toUpperCase()}`;

  if (sosId) {
    await SosDeliveryLog.create({
      sosId: new mongoose.Types.ObjectId(sosId.toString()),
      contactId: contactId ? new mongoose.Types.ObjectId(contactId.toString()) : undefined,
      contactName,
      contactPhone: cleanPhone,
      gateway: primaryGateway,
      status: 'sent',
      attempts,
      gatewayResponse: {
        sid: simulatedSid,
        mode: 'development_simulation',
        note: 'Live provider credentials not configured in environment. Alert payload recorded in database.',
        cost: primaryGateway === 'fast2sms' ? '₹0.00 (simulated)' : '$0.00 (simulated)',
      },
    });
  }

  return {
    contactId: contactId?.toString(),
    contactName,
    phone: cleanPhone,
    gateway: primaryGateway,
    status: 'simulated',
    sid: simulatedSid,
    cost: primaryGateway === 'fast2sms' ? '₹0.00 (simulated)' : '$0.00 (simulated)',
  };
}

/**
 * Dispatches emergency alerts to all designated emergency contacts for an active SOS incident.
 */
export async function dispatchEmergencyAlerts(sos: ISosEvent): Promise<DispatchResult[]> {
  const contacts = await EmergencyContact.find({ userId: sos.userId, notifyOnSos: true }).limit(5);
  const results: DispatchResult[] = [];

  const mapsUrl = sos.location?.coordinates
    ? `https://maps.google.com/?q=${sos.location.coordinates[1]},${sos.location.coordinates[0]}`
    : 'Location withheld';

  const alertMessage = `EMERGENCY SOS: CasualMeet user triggered safety alert at ${sos.locationName}. Track: ${mapsUrl}`;

  for (const c of contacts) {
    const res = await dispatchSingleAlert({
      phone: c.phone,
      message: alertMessage,
      sosId: sos._id as any,
      contactId: c._id as any,
      contactName: c.name,
    });
    results.push(res);
  }

  return results;
}

/**
 * Retries delivery for any failed emergency contact alerts for an SOS event.
 */
export async function retryFailedAlerts(sosId: string | mongoose.Types.ObjectId): Promise<DispatchResult[]> {
  const validSosId = new mongoose.Types.ObjectId(sosId.toString());
  const failedLogs = await SosDeliveryLog.find({ sosId: validSosId, status: 'failed' });

  if (failedLogs.length === 0) {
    return [];
  }

  const results: DispatchResult[] = [];
  const alertMessage = `EMERGENCY SOS RETRY: Safety alert update for active incident.`;

  for (const log of failedLogs) {
    const newAttempt = (log.attempts || 1) + 1;
    const res = await dispatchSingleAlert({
      phone: log.contactPhone,
      message: alertMessage,
      sosId: validSosId,
      contactId: log.contactId,
      contactName: log.contactName,
      attempts: newAttempt,
    });

    // Update existing delivery log record
    log.attempts = newAttempt;
    log.status = res.status === 'sent' || res.status === 'simulated' ? 'sent' : 'failed';
    log.lastError = res.error;
    if (res.sid && res.sid !== 'NONE') {
      log.gatewayResponse = {
        sid: res.sid,
        cost: res.cost,
        status: res.status,
      };
    }
    await log.save();
    results.push(res);
  }

  return results;
}

/**
 * Sends a standalone test SMS to verify carrier gateway configuration.
 */
export async function sendTestSms(targetPhone: string, customMessage?: string): Promise<DispatchResult> {
  const message = customMessage || 'CasualMeet SMS Carrier Verification: Test transmission succeeded.';
  return dispatchSingleAlert({
    phone: targetPhone,
    message,
    contactName: 'Carrier Test Recipient',
  });
}
