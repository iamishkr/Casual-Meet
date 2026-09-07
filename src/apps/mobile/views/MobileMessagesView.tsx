import React, { useState } from 'react';
import ChatScreen from '../../../components/phone/ChatScreen';

export default function MobileMessagesView() {
  const [threadId, setThreadId] = useState<string | null>(null);

  return (
    <div className="h-[calc(100vh-8.5rem)] rounded-2xl border border-line-soft bg-night-900/90 overflow-hidden shadow-lg">
      <ChatScreen threadId={threadId} openThread={setThreadId} />
    </div>
  );
}
