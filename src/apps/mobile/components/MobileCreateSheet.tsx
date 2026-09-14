import React, { useState, useRef } from 'react';
import { BottomSheet, Button } from '../../../components/ui';
import {
  Image,
  MapPin,
  Sparkles,
  Globe,
  Users,
  Lock,
  X,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { api } from '../../../lib/api';
import type { PostDTO, PostVisibility } from '../../../lib/types';

interface MobileCreateSheetProps {
  open: boolean;
  onClose: () => void;
  onPostCreated?: (newPost: PostDTO) => void;
}

export default function MobileCreateSheet({
  open,
  onClose,
  onPostCreated,
}: MobileCreateSheetProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [locationName, setLocationName] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<
    { storageKey: string; url: string; mediaType: 'image' | 'video'; previewUrl: string }[]
  >([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedMedia.length + files.length > 8) {
      toast('err', 'Limit Exceeded', 'You can attach up to 8 media items per post.');
      return;
    }

    setUploadingMedia(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) {
          toast('err', 'File Too Large', `${file.name} exceeds the 50MB maximum size limit.`);
          continue;
        }

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const uploadRes = await api.media.upload(base64, file.name);
        setUploadedMedia((prev) => [
          ...prev,
          {
            storageKey: uploadRes.storageKey,
            url: uploadRes.url,
            mediaType: uploadRes.mediaType,
            previewUrl: base64,
          },
        ]);
      }
    } catch (err: any) {
      toast('err', 'Upload Failed', err?.message || 'Could not upload media.');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveMedia = (index: number) => {
    setUploadedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const cleanCaption = caption.trim();

    if (!cleanCaption && uploadedMedia.length === 0) {
      toast('info', 'Content Required', 'Please enter some text or select media.');
      return;
    }

    setSubmitting(true);
    try {
      const mediaPayload = uploadedMedia.map((m) => ({
        storageKey: m.storageKey,
        mediaType: m.mediaType,
      }));

      const newPost = await api.posts.create({
        caption: cleanCaption,
        media: mediaPayload,
        visibility,
        locationName: locationName.trim() || undefined,
      });

      toast('ok', 'Post Shared', 'Your post is now live!');
      setCaption('');
      setLocationName('');
      setShowLocationInput(false);
      setUploadedMedia([]);
      onPostCreated?.(newPost);
      onClose();
    } catch (err: any) {
      toast('err', 'Post Failed', err?.message || 'Could not publish your post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Create Post">
      <div className="space-y-4 pt-1 pb-2">
        {/* User preview header & visibility picker */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-night-950"
              style={{
                background: `linear-gradient(135deg, hsl(${currentUser?.avatarHue ?? 210} 85% 68%), hsl(${((currentUser?.avatarHue ?? 210) + 42) % 360} 80% 55%))`,
              }}
            >
              {currentUser?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-ink">{currentUser?.name}</p>
              <p className="font-mono text-[10px] text-dim">@{currentUser?.username}</p>
            </div>
          </div>

          {/* Visibility Selector */}
          <div className="relative">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as PostVisibility)}
              className="appearance-none rounded-xl border border-line bg-night-850 py-1.5 pl-7 pr-3 text-[11px] font-medium text-ink focus:border-amber focus:outline-none"
            >
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="connections">Connections</option>
              <option value="private">Only Me</option>
            </select>
            <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mute">
              {visibility === 'public' && <Globe size={11} />}
              {visibility === 'followers' && <Users size={11} className="text-amber" />}
              {visibility === 'connections' && <Users size={11} className="text-safe" />}
              {visibility === 'private' && <Lock size={11} />}
            </div>
          </div>
        </div>

        {/* Text area */}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Share something with your verified community..."
          rows={4}
          className="w-full resize-none rounded-2xl border border-line bg-night-850 p-3.5 text-xs text-ink placeholder:text-dim outline-none focus:border-amber/50 leading-relaxed"
        />

        {/* Uploaded Media Thumbnails */}
        {uploadedMedia.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {uploadedMedia.map((m, idx) => (
              <div
                key={m.storageKey}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-night-900 shadow-sm group"
              >
                {m.mediaType === 'image' ? (
                  <img
                    src={m.previewUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-night-850 text-amber text-[10px] font-mono">
                    VIDEO
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveMedia(idx)}
                  className="absolute right-1 top-1 rounded-full bg-night-950/80 p-1 text-ink hover:bg-sos transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Coarse Location input (optional, never GPS) */}
        {showLocationInput && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-night-850 px-3 py-2">
            <MapPin size={13} className="text-amber shrink-0" />
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="City or neighborhood (e.g. Bandra West, Mumbai)"
              className="w-full bg-transparent text-xs text-ink placeholder:text-dim outline-none"
            />
            {locationName && (
              <button
                type="button"
                onClick={() => setLocationName('')}
                className="text-dim hover:text-ink"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Action Toolbar */}
        <div className="flex items-center justify-between pt-2 border-t border-line-soft">
          <div className="flex items-center gap-1.5 text-mute">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingMedia || submitting}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-night-850 px-3 py-2 text-xs font-semibold text-mute hover:border-amber/40 hover:text-ink transition-colors disabled:opacity-50"
              title="Attach Photo or Video"
            >
              {uploadingMedia ? (
                <Loader2 size={15} className="animate-spin text-amber" />
              ) : (
                <Image size={15} className="text-amber" />
              )}
              <span>Media</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLocationInput(!showLocationInput)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                showLocationInput
                  ? 'border-amber/50 bg-amber/15 text-amber'
                  : 'border-line bg-night-850 text-mute hover:text-ink'
              }`}
              title="Add Location Name"
            >
              <MapPin size={15} />
              <span>Location</span>
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            disabled={(!caption.trim() && uploadedMedia.length === 0) || uploadingMedia || submitting}
            onClick={handleSubmit}
            leftIcon={submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          >
            {submitting ? 'Sharing...' : 'Share Post'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
