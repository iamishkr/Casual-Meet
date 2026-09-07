import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { VerificationRequest } from '../models/VerificationRequest.js';
import { emitToAdmins } from '../socket.js';

const router = Router();

router.use(authenticate);

// POST /api/verification/submit — Submit a selfie verification request
router.post('/submit', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { selfieUrl, selfieData } = req.body;

    if (user.isVerified) {
      res.status(400).json({ error: 'Your account is already identity verified.' });
      return;
    }

    // Check for duplicate pending requests
    const activePending = await VerificationRequest.findOne({
      userId: user._id,
      status: 'pending',
    });

    if (activePending) {
      res.status(400).json({
        error: 'A verification request is already pending review by safety administrators.',
        pendingRequestId: activePending._id,
      });
      return;
    }

    const payload = selfieUrl || selfieData;
    if (!payload || typeof payload !== 'string' || !payload.trim()) {
      res.status(400).json({ error: 'Verification selfie image payload is required.' });
      return;
    }

    // Size & Format Validation (Limit to 5MB payload to prevent server memory bloat)
    if (payload.length > 7 * 1024 * 1024) {
      res.status(400).json({ error: 'Verification selfie file size exceeds 5MB limit.' });
      return;
    }

    const isDataUri = payload.startsWith('data:image/');
    const isHttpUrl = payload.startsWith('http://') || payload.startsWith('https://');

    if (!isDataUri && !isHttpUrl) {
      res.status(400).json({ error: 'Invalid selfie image format. Provide image/jpeg, image/png, or webp.' });
      return;
    }

    const verif = await VerificationRequest.create({
      userId: user._id, // Enforce authenticated owner
      selfieUrl: payload.slice(0, 120000), // Secure storage bounded
      status: 'pending',
    });

    // Notify moderation admin console
    emitToAdmins('new_verification', {
      requestId: verif._id,
      userId: user._id,
      username: user.username,
      name: user.name,
    });

    res.status(201).json({
      success: true,
      message: 'Verification selfie submitted. An administrator will review your submission shortly.',
      verificationId: verif._id,
      status: 'pending',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit verification request.' });
  }
});

// GET /api/verification/mine — Check personal verification submission status
router.get('/mine', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const latest = await VerificationRequest.findOne({ userId: user._id })
      .sort({ createdAt: -1 })
      .select('-selfieUrl') // Do not unnecessarily return heavy image binary
      .lean();

    res.json({
      isVerified: user.isVerified,
      trustScore: user.trustScore,
      latestRequest: latest || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch verification status.' });
  }
});

export default router;
