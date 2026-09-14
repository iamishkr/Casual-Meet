import React, { useState } from 'react';
import { Modal, Button } from '../ui';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Flag, Loader2, ShieldCheck } from 'lucide-react';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: 'user' | 'post' | 'comment' | 'story';
  targetId: string;
  targetName?: string;
}

const REPORT_REASONS = [
  { id: 'harassment', label: 'Harassment or Bullying' },
  { id: 'inappropriate_content', label: 'Inappropriate or Explicit Content' },
  { id: 'spam_scam', label: 'Spam, Fraud, or Scam' },
  { id: 'hate_speech', label: 'Hate Speech or Discrimination' },
  { id: 'violence_threat', label: 'Violence or Physical Threat' },
  { id: 'impersonation', label: 'Impersonation or Fake Account' },
  { id: 'other', label: 'Other Community Guidelines Violation' },
];

export default function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
  targetName,
}: ReportModalProps) {
  const { toast } = useToast();
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0].id);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) return;

    setLoading(true);
    try {
      await api.reports.create({
        targetType,
        targetId,
        reportedUserId: targetType === 'user' ? targetId : undefined,
        reason: selectedReason,
        details: details.trim(),
      });

      toast(
        'ok',
        'Report Submitted',
        'Thank you for reporting. Our human safety team will review this item in the moderation queue.'
      );
      onClose();
      setDetails('');
    } catch (err: any) {
      toast('err', 'Submission Failed', err?.message || 'Could not submit report.');
    } finally {
      setLoading(false);
    }
  };

  const targetLabel =
    targetType === 'user'
      ? targetName || 'this user'
      : targetType === 'post'
      ? 'this post'
      : targetType === 'comment'
      ? 'this comment'
      : 'this story';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit Safety Report"
      description={`Report ${targetLabel} for review by our moderation team.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Safety Note */}
        <div className="flex items-start gap-2 rounded-xl bg-night-900 border border-line-soft p-3 text-xs text-mute">
          <ShieldCheck size={16} className="text-safe shrink-0 mt-0.5" />
          <p>
            Reports are confidential and reviewed by trained safety moderators. Reporting will not
            alert the author immediately.
          </p>
        </div>

        {/* Reason selector */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-dim mb-1.5">
            Select Reason
          </label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.id}
                className={`flex items-center gap-2.5 rounded-xl p-2 text-xs font-medium cursor-pointer transition-colors ${
                  selectedReason === r.id
                    ? 'border border-amber/50 bg-amber/10 text-amber font-bold'
                    : 'border border-line-soft bg-night-850/60 text-mute hover:text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="reportReason"
                  value={r.id}
                  checked={selectedReason === r.id}
                  onChange={() => setSelectedReason(r.id)}
                  className="accent-amber"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Additional details */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-dim mb-1">
            Additional Details (Optional)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Help our moderation team understand the context..."
            rows={3}
            maxLength={1000}
            className="w-full resize-none rounded-xl border border-line bg-night-900 p-2.5 text-xs text-ink placeholder:text-dim outline-none transition-colors focus:border-amber/60"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-soft">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading} type="button">
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            type="submit"
            disabled={loading}
            leftIcon={loading ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
