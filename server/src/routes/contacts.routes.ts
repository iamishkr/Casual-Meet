import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { EmergencyContact, Relationship } from '../models/EmergencyContact.js';
import { isValidPhone, normalizePhone } from '../utils/scanner.js';

const router = Router();

// All contact routes require authentication
router.use(authenticate);

const VALID_RELATIONSHIPS: Relationship[] = ['family', 'friend', 'partner', 'colleague', 'other'];

// GET /api/contacts — List only the authenticated user's emergency contacts
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const contacts = await EmergencyContact.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json(contacts);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch emergency contacts.' });
  }
});

// POST /api/contacts — Add a new emergency contact (Ownership strictly derived from JWT)
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { name, phone, relationship, notifyOnSos } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Contact name is required.' });
      return;
    }

    if (!phone || typeof phone !== 'string' || !isValidPhone(phone.trim())) {
      res.status(400).json({ error: 'Valid phone number is required (min 10 digits).' });
      return;
    }

    const rel: Relationship = VALID_RELATIONSHIPS.includes(relationship) ? relationship : 'family';

    // Maximum 5 emergency contacts per user for safety spam prevention
    const count = await EmergencyContact.countDocuments({ userId: user._id });
    if (count >= 5) {
      res.status(400).json({ error: 'Maximum limit of 5 emergency contacts reached.' });
      return;
    }

    const contact = await EmergencyContact.create({
      userId: user._id, // Server-enforced ownership
      name: name.trim(),
      phone: normalizePhone(phone.trim()),
      relationship: rel,
      notifyOnSos: notifyOnSos !== false,
    });

    res.status(201).json(contact);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create emergency contact.' });
  }
});

// PUT /api/contacts/:id — Update an emergency contact (Strict ownership check)
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: 'Emergency contact not found.' });
      return;
    }

    const contact = await EmergencyContact.findOne({
      _id: req.params.id,
      userId: user._id, // Must match caller
    });

    if (!contact) {
      res.status(404).json({ error: 'Emergency contact not found or unauthorized.' });
      return;
    }

    const { name, phone, relationship, notifyOnSos } = req.body;

    if (name && typeof name === 'string' && name.trim()) {
      contact.name = name.trim();
    }

    if (phone && typeof phone === 'string') {
      if (!isValidPhone(phone.trim())) {
        res.status(400).json({ error: 'Invalid phone format.' });
        return;
      }
      contact.phone = normalizePhone(phone.trim());
    }

    if (relationship && VALID_RELATIONSHIPS.includes(relationship)) {
      contact.relationship = relationship;
    }

    if (typeof notifyOnSos === 'boolean') {
      contact.notifyOnSos = notifyOnSos;
    }

    await contact.save();
    res.json(contact);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update emergency contact.' });
  }
});

// DELETE /api/contacts/:id — Remove an emergency contact (Strict ownership check)
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: 'Emergency contact not found.' });
      return;
    }

    const contact = await EmergencyContact.findOneAndDelete({
      _id: req.params.id,
      userId: user._id, // Enforce ownership
    });

    if (!contact) {
      res.status(404).json({ error: 'Emergency contact not found or unauthorized.' });
      return;
    }

    res.json({ success: true, message: 'Emergency contact removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete emergency contact.' });
  }
});

export default router;
