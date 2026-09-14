import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChatScreen from '../../../components/phone/ChatScreen';

export default function MobileMessagesView() {
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
    <div className="h-[calc(100vh-8.5rem)] rounded-2xl border border-line-soft bg-night-900/90 overflow-hidden shadow-lg">
      <ChatScreen threadId={threadId} openThread={handleOpenThread} />
    </div>
  );
}

