import React from 'react';
import { Modal } from '../../../components/ui';
import CreatePost from '../../../components/social/CreatePost';
import type { PostDTO } from '../../../lib/types';

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onPostCreated?: (newPost: PostDTO) => void;
}

export default function CreatePostModal({ open, onClose, onPostCreated }: CreatePostModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Post"
      description="Share updates, photos, or meetup thoughts with verified members."
      wide
    >
      <div className="pt-2">
        <CreatePost
          onPostCreated={(post) => {
            if (onPostCreated) onPostCreated(post);
            onClose();
          }}
          className="border-none p-0 bg-transparent shadow-none"
        />
      </div>
    </Modal>
  );
}
