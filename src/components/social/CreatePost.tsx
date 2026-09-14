import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import type { PostDTO, PostVisibility } from '../../lib/types';
import {
  Image,
  MapPin,
  Globe,
  Users,
  Lock,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui';

interface CreatePostProps {
  communityId?: string;
  onPostCreated?: (newPost: PostDTO) => void;
  className?: string;
}

export default function CreatePost({ communityId, onPostCreated, className = '' }: CreatePostProps) {
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

  if (!currentUser) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedMedia.length + files.length > 10) {
      toast('err', 'Limit Exceeded', 'You can attach up to 10 media items to a post.');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCaption = caption.trim();

    if (!cleanCaption && uploadedMedia.length === 0) {
      toast('info', 'Post Content Required', 'Please enter some text or attach media.');
      return;
    }

    setSubmitting(true);
    try {
      const mediaPayload = uploadedMedia.map((m) => ({
        storageKey: m.storageKey,
        mediaType: m.mediaType,
      }));

      let newPost: PostDTO;
      if (communityId) {
        newPost = await api.communities.createPost(communityId, {
          caption: cleanCaption,
          media: mediaPayload,
          locationName: locationName.trim() || undefined,
        });
        toast('ok', 'Community Post Published', 'Your post is now visible in the community!');
      } else {
        newPost = await api.posts.create({
          caption: cleanCaption,
          media: mediaPayload,
          visibility,
          locationName: locationName.trim() || undefined,
        });
        toast('ok', 'Post Published', 'Your post is now live on the feed!');
      }
      setCaption('');
      setUploadedMedia([]);
      setLocationName('');
      setShowLocationInput(false);
      if (onPostCreated) onPostCreated(newPost);
    } catch (err: any) {
      toast('err', 'Failed to Publish', err?.message || 'Could not publish post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-3xl border border-line-soft bg-night-850/90 p-5 shadow-sm backdrop-blur-md ${className}`}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* User preview header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-display text-sm font-black text-night-950 shadow-md"
              style={{
                background: `linear-gradient(135deg, hsl(${currentUser.avatarHue} 85% 68%), hsl(${(currentUser.avatarHue + 42) % 360} 80% 55%))`,
              }}
            >
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-ink">{currentUser.name}</p>
              <p className="font-mono text-[10px] text-dim">@{currentUser.username}</p>
            </div>
          </div>

          {/* Visibility Selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-line-soft bg-night-900 px-2.5 py-1 text-xs">
            {visibility === 'public' ? (
              <Globe size={13} className="text-mute" />
            ) : visibility === 'followers' ? (
              <Users size={13} className="text-amber" />
            ) : visibility === 'connections' ? (
              <Users size={13} className="text-safe" />
            ) : (
              <Lock size={13} className="text-dim" />
            )}
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as PostVisibility)}
              className="bg-transparent text-[11px] font-semibold text-ink outline-none cursor-pointer"
            >
              <option value="public" className="bg-night-900 text-ink">
                Public
              </option>
              <option value="followers" className="bg-night-900 text-ink">
                Followers Only
              </option>
              <option value="connections" className="bg-night-900 text-ink">
                Connections Only
              </option>
              <option value="private" className="bg-night-900 text-ink">
                Private
              </option>
            </select>
          </div>
        </div>

        {/* Text Input */}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="What's happening? Share thoughts, meetups, or updates..."
          rows={3}
          maxLength={2200}
          className="w-full resize-none rounded-2xl border border-line bg-night-900/90 p-3 text-xs sm:text-sm text-ink placeholder:text-dim outline-none transition-colors focus:border-amber/60"
        />

        {/* Coarse Location Field */}
        {showLocationInput && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-night-900 px-3 py-1.5 text-xs">
            <MapPin size={14} className="text-amber shrink-0" />
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Add coarse location (e.g. Koramangala, Bengaluru)"
              maxLength={100}
              className="flex-1 bg-transparent text-xs text-ink placeholder:text-dim outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setLocationName('');
                setShowLocationInput(false);
              }}
              className="text-dim hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Uploaded Media Thumbnails */}
        {uploadedMedia.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {uploadedMedia.map((m, idx) => (
              <div
                key={m.storageKey}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line-soft bg-night-900"
              >
                {m.mediaType === 'video' ? (
                  <video src={m.previewUrl} className="h-full w-full object-cover" />
                ) : (
                  <img src={m.previewUrl} alt="Upload preview" className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveMedia(idx)}
                  className="absolute top-1 right-1 rounded-full bg-night-950/80 p-1 text-ink hover:bg-sos hover:text-white transition-colors"
                  title="Remove media"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar & Publish */}
        <div className="flex items-center justify-between border-t border-line-soft/60 pt-3">
          <div className="flex items-center gap-2">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingMedia || uploadedMedia.length >= 10}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-night-800 px-3 py-1.5 text-xs font-semibold text-mute hover:border-amber/40 hover:text-amber transition-colors disabled:opacity-50"
              title="Add photo or video"
            >
              {uploadingMedia ? (
                <Loader2 size={14} className="animate-spin text-amber" />
              ) : (
                <Image size={14} />
              )}
              <span className="hidden sm:inline">Media</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLocationInput(!showLocationInput)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                showLocationInput
                  ? 'border-amber/40 bg-amber/10 text-amber'
                  : 'border-line bg-night-800 text-mute hover:border-amber/40 hover:text-amber'
              }`}
              title="Add location"
            >
              <MapPin size={14} />
              <span className="hidden sm:inline">Location</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {caption.length > 1800 && (
              <span
                className={`font-mono text-[10px] ${
                  caption.length > 2150 ? 'text-sos font-bold' : 'text-dim'
                }`}
              >
                {2200 - caption.length} left
              </span>
            )}

            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={(!caption.trim() && uploadedMedia.length === 0) || submitting || uploadingMedia}
              leftIcon={
                submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />
              }
            >
              {submitting ? 'Publishing...' : 'Post to Feed'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
