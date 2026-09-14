import React, { useState } from 'react';
import { Modal, Button } from '../ui';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface BlockModalProps {
  open: boolean;
  onClose: () => void;
  targetUserId: string;
  targetName: string;
  onBlocked?: () => void;
}

export default function BlockModal({
  open,
  onClose,
  targetUserId,
  targetName,
  onBlocked,
}: BlockModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    setLoading(true);
    try {
      await api.connections.block(targetUserId);
      toast('ok', 'User Blocked', `${targetName} has been blocked. They can no longer see your profile or content.`);
      onClose();
      if (onBlocked) onBlocked();
    } catch (err: any) {
      toast('err', 'Block Failed', err?.message || 'Unable to block user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Block User"
      description="Block this member to immediately sever all social ties."
    >
      <div className="space-y-4 pt-1">
        <div className="rounded-xl border border-sos/30 bg-sos/10 p-3 text-xs text-mute flex items-start gap-2.5">
          <ShieldAlert size={18} className="text-sos shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-ink">What happens when you block {targetName}?</p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-mute">
              <li>They cannot view your posts, stories, or profile.</li>
              <li>They cannot follow you or send you messages.</li>
              <li>Any existing connection or follow relationship will be removed.</li>
              <li>They will not be notified that they were blocked.</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-soft">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleBlock}
            disabled={loading}
            leftIcon={loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
          >
            {loading ? 'Blocking...' : `Block ${targetName}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
