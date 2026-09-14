import React, { useState } from 'react';
import type { PostMediaDTO } from '../../lib/types';
import { X, ChevronLeft, ChevronRight, Image as ImageIcon, Play } from 'lucide-react';

interface PostMediaProps {
  media: PostMediaDTO[];
  alt?: string;
}

export default function PostMedia({ media, alt = 'Post media' }: PostMediaProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loadErrors, setLoadErrors] = useState<Record<string, boolean>>({});

  if (!media || media.length === 0) return null;

  const handleImageError = (key: string) => {
    setLoadErrors((prev) => ({ ...prev, [key]: true }));
  };

  const count = media.length;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-line-soft bg-night-950 mt-3">
        {count === 1 ? (
          <div className="relative max-h-[520px] w-full flex items-center justify-center overflow-hidden bg-night-950">
            {media[0].mediaType === 'video' ? (
              <video
                src={media[0].url}
                controls
                playsInline
                preload="metadata"
                className="max-h-[520px] w-full object-contain"
              />
            ) : loadErrors[media[0].storageKey] ? (
              <div className="flex flex-col items-center justify-center py-16 text-dim gap-2">
                <ImageIcon size={32} />
                <span className="text-xs">Media unavailable</span>
              </div>
            ) : (
              <img
                src={media[0].url}
                alt={alt}
                loading="lazy"
                onError={() => handleImageError(media[0].storageKey)}
                onClick={() => setLightboxIndex(0)}
                className="max-h-[520px] w-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              />
            )}
          </div>
        ) : count === 2 ? (
          <div className="grid grid-cols-2 gap-1 max-h-[400px]">
            {media.slice(0, 2).map((item, idx) => (
              <div
                key={item.storageKey || idx}
                className="relative h-64 overflow-hidden bg-night-900 cursor-pointer"
                onClick={() => setLightboxIndex(idx)}
              >
                {item.mediaType === 'video' ? (
                  <div className="relative h-full w-full flex items-center justify-center bg-night-950">
                    <video src={item.url} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-night-950/40">
                      <Play size={32} className="text-amber drop-shadow" />
                    </div>
                  </div>
                ) : (
                  <img
                    src={item.url}
                    alt={`${alt} ${idx + 1}`}
                    loading="lazy"
                    onError={() => handleImageError(item.storageKey)}
                    className="h-full w-full object-cover hover:scale-102 transition-transform duration-200"
                  />
                )}
              </div>
            ))}
          </div>
        ) : count === 3 ? (
          <div className="grid grid-cols-2 gap-1 max-h-[420px]">
            <div
              className="relative h-full min-h-[260px] overflow-hidden bg-night-900 cursor-pointer row-span-2"
              onClick={() => setLightboxIndex(0)}
            >
              <img
                src={media[0].url}
                alt={`${alt} 1`}
                loading="lazy"
                onError={() => handleImageError(media[0].storageKey)}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col gap-1">
              {media.slice(1, 3).map((item, idx) => (
                <div
                  key={item.storageKey || idx}
                  className="relative h-[130px] overflow-hidden bg-night-900 cursor-pointer"
                  onClick={() => setLightboxIndex(idx + 1)}
                >
                  <img
                    src={item.url}
                    alt={`${alt} ${idx + 2}`}
                    loading="lazy"
                    onError={() => handleImageError(item.storageKey)}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1 max-h-[420px]">
            {media.slice(0, 4).map((item, idx) => {
              const isLast = idx === 3 && count > 4;
              return (
                <div
                  key={item.storageKey || idx}
                  className="relative h-44 overflow-hidden bg-night-900 cursor-pointer"
                  onClick={() => setLightboxIndex(idx)}
                >
                  <img
                    src={item.url}
                    alt={`${alt} ${idx + 1}`}
                    loading="lazy"
                    onError={() => handleImageError(item.storageKey)}
                    className="h-full w-full object-cover"
                  />
                  {isLast && (
                    <div className="absolute inset-0 flex items-center justify-center bg-night-950/70 font-display text-lg font-black text-ink backdrop-blur-xs">
                      +{count - 3}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/90 backdrop-blur-md p-4"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 z-10 rounded-full bg-night-850/80 p-2 text-mute hover:bg-night-800 hover:text-ink transition-colors"
          >
            <X size={20} />
          </button>

          {/* Navigation controls */}
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev! > 0 ? prev! - 1 : count - 1));
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-night-850/80 p-2 text-mute hover:bg-night-800 hover:text-ink transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev! < count - 1 ? prev! + 1 : 0));
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-night-850/80 p-2 text-mute hover:bg-night-800 hover:text-ink transition-colors"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Active Image/Video */}
          <div
            className="max-h-[85vh] max-w-[90vw] overflow-hidden rounded-2xl flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {media[lightboxIndex].mediaType === 'video' ? (
              <video
                src={media[lightboxIndex].url}
                controls
                autoPlay
                playsInline
                className="max-h-[85vh] max-w-[90vw] object-contain"
              />
            ) : (
              <img
                src={media[lightboxIndex].url}
                alt={`${alt} ${lightboxIndex + 1}`}
                className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
