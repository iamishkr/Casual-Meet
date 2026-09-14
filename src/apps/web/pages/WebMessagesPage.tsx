import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChatScreen from '../../../components/phone/ChatScreen';
import { MessageCircle } from 'lucide-react';

export default function WebMessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryChatId = searchParams.get('chatId');
  const [threadId, setThreadId] = useState<string | null>(queryChatId);

  useEffect(() => {
    if (queryChatId) {
      setThreadId(queryChatId);
    }
  }, [queryChatId]);

  const handleOpenThread = (id: string | null) => {
    setThreadId(id);
    if (id) {
      setSearchParams({ chatId: id });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-line-soft/60 pb-3">
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink flex items-center gap-2">
            <MessageCircle size={20} className="text-amber" />
            Messages & Conversations
          </h1>
          <p className="text-xs text-mute mt-0.5">
            Realtime Socket.io messaging protected by connection authorization and PII leak prevention.
          </p>
        </div>
      </div>

      {/* Main Chat Interface Container */}
      <div className="rounded-3xl border border-line-soft bg-night-900/80 shadow-xl backdrop-blur-xl h-[720px] overflow-hidden">
        <ChatScreen threadId={threadId} openThread={handleOpenThread} isWide={true} />
      </div>
    </div>
  );
}
