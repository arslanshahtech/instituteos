import React, { useState } from 'react';
import {
  useThreads,
  useThreadDetail,
  useSendReply,
  type ConversationThread,
} from './communications-api.js';

interface ParentTeacherInboxProps {
  organizationId: string;
  currentUserId: string;
  userRole: string;
}

export const ParentTeacherInbox: React.FC<ParentTeacherInboxProps> = ({
  organizationId,
  currentUserId,
  userRole,
}) => {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data: threadsData, isLoading: loadingThreads } = useThreads(organizationId);
  const { data: activeThreadData, isLoading: loadingMessages } = useThreadDetail(
    organizationId,
    selectedThreadId,
  );

  const replyMutation = useSendReply(organizationId, selectedThreadId ?? '');

  const threads = threadsData?.items ?? [];
  const messages = activeThreadData?.messages ?? [];
  const currentThread = activeThreadData?.thread;

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedThreadId) return;

    try {
      await replyMutation.mutateAsync(replyText.trim());
      setReplyText('');
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '600px',
        border: '1px solid #e2e8f0',
        borderRadius: '0.5rem',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        marginTop: '1rem',
      }}
    >
      {/* Left Panel: Thread List */}
      <div
        style={{
          width: '320px',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f8fafc',
        }}
      >
        <div
          style={{
            padding: '1rem',
            borderBottom: '1px solid #e2e8f0',
            fontWeight: 600,
            fontSize: '1rem',
          }}
        >
          Conversations
        </div>
        <div style={{ flexGrow: 1, overflowY: 'auto' }}>
          {loadingThreads ? (
            <div style={{ padding: '1rem', color: '#64748b' }}>Loading threads...</div>
          ) : threads.length === 0 ? (
            <div style={{ padding: '1rem', color: '#64748b' }}>No conversations yet.</div>
          ) : (
            threads.map((thread) => {
              const isSelected = thread.id === selectedThreadId;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.75rem 1rem',
                    border: 'none',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: isSelected ? '#e2e8f0' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {thread.subjectTitle}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Updated: {new Date(thread.lastMessageAt).toLocaleDateString()}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel: Chat Messages */}
      <div
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {selectedThreadId && currentThread ? (
          <>
            {/* Thread Header */}
            <div
              style={{
                padding: '1rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem' }}>{currentThread.subjectTitle}</h4>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Status: {currentThread.status} | Privacy: Contact details masked
                </div>
              </div>
            </div>

            {/* Privacy & Quiet Hours Banner */}
            <div
              style={{
                backgroundColor: '#eff6ff',
                color: '#1e40af',
                padding: '0.5rem 1rem',
                fontSize: '0.75rem',
                borderBottom: '1px solid #dbeafe',
              }}
            >
              <strong>Notice:</strong> Teachers reply during school working hours. Personal phone numbers and emails remain protected.
            </div>

            {/* Messages Body */}
            <div
              style={{
                flexGrow: 1,
                padding: '1rem',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                backgroundColor: '#f8fafc',
              }}
            >
              {loadingMessages ? (
                <div style={{ color: '#64748b' }}>Loading messages...</div>
              ) : messages.length === 0 ? (
                <div style={{ color: '#64748b' }}>No messages in this thread.</div>
              ) : (
                messages.map((msg) => {
                  const isSelf = msg.senderUserId === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isSelf ? 'flex-end' : 'flex-start',
                        maxWidth: '70%',
                        backgroundColor: isSelf ? '#2563eb' : '#ffffff',
                        color: isSelf ? '#ffffff' : '#0f172a',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        border: isSelf ? 'none' : '1px solid #e2e8f0',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.7rem',
                          marginBottom: '0.25rem',
                          opacity: 0.8,
                        }}
                      >
                        {isSelf ? 'You' : msg.senderRole === 'teacher' ? 'Class Teacher' : 'Parent'}
                      </div>
                      <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </div>
                      <div
                        style={{
                          fontSize: '0.65rem',
                          marginTop: '0.25rem',
                          textAlign: 'right',
                          opacity: 0.7,
                        }}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Input Form */}
            <form
              onSubmit={handleSendReply}
              style={{
                padding: '0.75rem',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                gap: '0.5rem',
                backgroundColor: '#ffffff',
              }}
            >
              <input
                type="text"
                placeholder="Type your message..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={replyMutation.isPending}
                style={{
                  flexGrow: 1,
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem',
                }}
              />
              <button
                type="submit"
                disabled={replyMutation.isPending || !replyText.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div
            style={{
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
            }}
          >
            Select a conversation from the left to read and reply.
          </div>
        )}
      </div>
    </div>
  );
};