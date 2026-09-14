import React, { useState, useRef } from 'react';
import { Modal, Button } from '../ui';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Image, X, Globe, Users, Sparkles, Loader2 } from 'lucide-react';
import type { StoryVisibility } from '../../lib/types';

interface CreateStoryModalProps {
  open: boolean;
  onClose: () => void;
  onStoryCreated?: () => void;
}

export default function CreateStoryModal({
  open,
  onClose,
  onStoryCreated,
}: CreateStoryModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<StoryVisibility>('followers');
  const [mediaFile, setMediaFile] = useState<{
    storageKey: string;
    url: string;
    mediaType: 'image' | 'video';
    previewUrl: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast('err', 'File Too Large', 'Story media cannot exceed 50MB.');
      return;
    }

    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await api.media.upload(base64, file.name);
      setMediaFile({
        storageKey: res.storageKey,
        url: res.url,
        mediaType: res.mediaType,
        previewUrl: base64,
      });
    } catch (err: any) {
      toast('err', 'Upload Failed', err?.message || 'Failed to upload story media.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile || submitting) return;

    setSubmitting(true);
    try {
      await api.stories.create({
        media: {
          storageKey: mediaFile.storageKey,
        },
        caption: caption.trim() || undefined,
        visibility,
      });

      toast('ok', 'Story Shared', 'Your 24-hour story is now visible to friends.');
      setCaption('');
      setMediaFile(null);
      onClose();
      if (onStoryCreated) onStoryCreated();
    } catch (err: any) {
      toast('err', 'Publish Failed', err?.message || 'Could not post story.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create 24-Hour Story"
      description="Share a moment that automatically vanishes in 24 hours."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* File Dropzone or Preview */}
        {!mediaFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line-soft bg-night-900/60 p-8 text-center cursor-pointer hover:border-amber/50 hover:bg-night-900 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
              onChange={handleFileChange}
              className="hidden"
            />
            {uploading ? (
              <Loader2 size={32} className="animate-spin text-amber mb-2" />
            ) : (
              <Image size={32} className="text-dim mb-2" />
            )}
            <p className="text-xs font-bold text-ink">
              {uploading ? 'Uploading media...' : 'Select Photo or Video'}
            </p>
            <p className="text-[11px] text-mute mt-1">
              Supports JPEG, PNG, WEBP, and MP4 up to 50MB
            </p>
          </div>
        ) : (
          <div className="relative h-64 w-full rounded-2xl overflow-hidden bg-night-950 border border-line-soft">
            {mediaFile.mediaType === 'video' ? (
              <video
                src={mediaFile.previewUrl}
                controls
                className="h-full w-full object-contain"
              />
            ) : (
              <img
                src={mediaFile.previewUrl}
                alt="Story preview"
                className="h-full w-full object-contain"
              />
            )}
            <button
              type="button"
              onClick={() => setMediaFile(null)}
              className="absolute top-2 right-2 rounded-full bg-night-950/80 p-1.5 text-ink hover:bg-sos hover:text-white transition-colors"
              title="Remove media"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Caption */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-dim mb-1">
            Story Caption (Optional)
          </label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a quick note..."
            maxLength={500}
            className="w-full rounded-xl border border-line bg-night-900 p-2.5 text-xs text-ink placeholder:text-dim outline-none focus:border-amber/60"
          />
        </div>

        {/* Visibility */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-dim mb-1">
            Who can view this story?
          </label>
          <div className="flex gap-2">
            {[
              { id: 'followers', label: 'Followers', icon: Users },
              { id: 'connections', label: 'Connections Only', icon: Users },
              { id: 'public', label: 'Public', icon: Globe },
            ].map((v) => {
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVisibility(v.id as StoryVisibility)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
                    visibility === v.id
                      ? 'border border-amber/40 bg-amber/15 text-amber font-bold'
                      : 'border border-line bg-night-850 text-mute hover:text-ink'
                  }`}
                >
                  <Icon size={13} />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-soft">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={!mediaFile || submitting || uploading}
            leftIcon={
              submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />
            }
          >
            {submitting ? 'Sharing...' : 'Share Story'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
