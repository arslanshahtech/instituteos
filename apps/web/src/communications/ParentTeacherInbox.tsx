import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  ArrowLeft,
  MessageSquare,
  Send,
  ShieldCheck,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { Dialog } from '../components/ui/Dialog.js';
import {
  useThreads,
  useThreadDetail,
  useSendReply,
  useStartConversation,
  useMessagingContacts,
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
  const [replyError, setReplyError] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Parent contact choices come from the authenticated account's linked students
  // and the teachers actually assigned to those students' active sections.
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTeacherUserId, setSelectedTeacherUserId] = useState('');
  const [subjectTitle, setSubjectTitle] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [formError, setFormError] = useState('');

  const { data: threadsData, isLoading: loadingThreads } =
    useThreads(organizationId);
  const contactsQuery = useMessagingContacts(
    organizationId,
    userRole === 'parent_guardian',
  );
  const contacts = contactsQuery.data?.items ?? [];
  const selectedStudent = contacts.find(
    (contact) => contact.studentId === selectedStudentId,
  );
  const availableTeachers = selectedStudent?.teachers ?? [];
  const { data: activeThreadData, isLoading: loadingMessages } =
    useThreadDetail(organizationId, selectedThreadId);

  const replyMutation = useSendReply(organizationId, selectedThreadId ?? '');
  const startMutation = useStartConversation(organizationId);

  const threads = threadsData?.items ?? [];
  const messages = activeThreadData?.messages ?? [];
  const currentThread = activeThreadData?.thread;

  useEffect(() => {
    if (userRole !== 'parent_guardian' || contacts.length === 0) return;
    const contact =
      contacts.find((item) => item.studentId === selectedStudentId) ??
      contacts[0]!;
    if (selectedStudentId !== contact.studentId) {
      setSelectedStudentId(contact.studentId);
    }
    if (
      !contact.teachers.some(
        (teacher) => teacher.userId === selectedTeacherUserId,
      )
    ) {
      setSelectedTeacherUserId(contact.teachers[0]?.userId ?? '');
    }
  }, [contacts, userRole, selectedStudentId, selectedTeacherUserId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-select first thread on desktop if available
  useEffect(() => {
    if (!isMobile && threads.length > 0 && !selectedThreadId) {
      setSelectedThreadId(threads[0]?.id ?? null);
    }
  }, [threads, isMobile, selectedThreadId]);

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setReplyError('');
    const textToSend = replyText.trim();
    if (!textToSend || !selectedThreadId || replyMutation.isPending) return;

    try {
      setReplyText('');
      await replyMutation.mutateAsync(textToSend);
    } catch (err: unknown) {
      setReplyText(textToSend);
      setReplyError(
        err instanceof Error
          ? err.message
          : 'Message send failed. Check connection or authorization.',
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendReply();
    }
  };

  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (
      !selectedStudentId ||
      !selectedTeacherUserId ||
      !subjectTitle.trim() ||
      !initialMessage.trim()
    ) {
      setFormError(
        'Select a linked student and assigned teacher, then enter a subject and message.',
      );
      return;
    }
    if (
      !selectedStudent ||
      !availableTeachers.some(
        (teacher) => teacher.userId === selectedTeacherUserId,
      )
    ) {
      setFormError(
        'The selected teacher is not available for this linked student. Refresh contacts and try again.',
      );
      return;
    }

    try {
      const result = await startMutation.mutateAsync({
        studentId: selectedStudentId,
        teacherUserId: selectedTeacherUserId,
        subjectTitle: `[${selectedStudent.studentName}] ${subjectTitle.trim()}`,
        initialMessage: initialMessage.trim(),
      });

      setNewChatOpen(false);
      setSubjectTitle('');
      setInitialMessage('');
      if (result.thread?.id) {
        setSelectedThreadId(result.thread.id);
      }
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to start conversation.',
      );
    }
  };

  const showList = !isMobile || (isMobile && !selectedThreadId);
  const showChat = !isMobile || (isMobile && Boolean(selectedThreadId));

  return (
    <div
      className="parent-teacher-inbox"
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: isMobile ? 'calc(100vh - 210px)' : '620px',
        minHeight: '440px',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Left List View */}
      {showList && (
        <div
          style={{
            width: isMobile ? '100%' : '320px',
            minWidth: isMobile ? '100%' : '300px',
            borderRight: isMobile ? 'none' : '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
          }}
        >
          <div
            style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                Messages
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                Parent-Teacher Desk
              </p>
            </div>
            {userRole === 'parent_guardian' && (
              <Button
                type="button"
                variant="primary"
                onClick={() => setNewChatOpen(true)}
                disabled={
                  contactsQuery.isPending ||
                  !contacts.some((contact) => contact.teachers.length > 0)
                }
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.78rem',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Plus size={14} /> New
              </Button>
            )}
          </div>

          <div style={{ flexGrow: 1, overflowY: 'auto' }}>
            {loadingThreads ? (
              <div
                style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                }}
              >
                Loading...
              </div>
            ) : threads.length === 0 ? (
              <div
                style={{
                  padding: '2rem 1.25rem',
                  textAlign: 'center',
                  color: '#64748b',
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.75rem',
                    color: '#2563eb',
                  }}
                >
                  <MessageSquare size={20} />
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: '#1e293b',
                  }}
                >
                  No conversations yet
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginTop: '0.25rem',
                  }}
                >
                  {userRole !== 'parent_guardian' ? (
                    'Messages will appear here after a linked parent starts a conversation.'
                  ) : contactsQuery.isPending ? (
                    'Checking linked children and assigned teachers…'
                  ) : contactsQuery.isError ? (
                    'Contact list could not be loaded. Refresh this page and try again.'
                  ) : contacts.length === 0 ? (
                    'No active children are linked to this guardian account yet. Contact the college office.'
                  ) : !contacts.some(
                      (contact) => contact.teachers.length > 0,
                    ) ? (
                    'No linked child has an assigned teacher account for the active academic year yet.'
                  ) : (
                    <>
                      Select <strong>New</strong> to start a conversation.
                    </>
                  )}
                </div>
              </div>
            ) : (
              threads.map((thread) => {
                const isSelected = thread.id === selectedThreadId;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                      setReplyError('');
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.85rem 1rem',
                      border: 'none',
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
                      borderLeft: isSelected
                        ? '3px solid #2563eb'
                        : '3px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: '#0f172a',
                      }}
                    >
                      {thread.subjectTitle}
                    </div>
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: '#94a3b8',
                        marginTop: '0.2rem',
                      }}
                    >
                      {new Date(thread.lastMessageAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Right Chat View */}
      {showChat && (
        <div
          style={{
            flexGrow: 1,
            width: isMobile ? '100%' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f8fafc',
          }}
        >
          {selectedThreadId && currentThread ? (
            <>
              {/* Header */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: '#ffffff',
                }}
              >
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => setSelectedThreadId(null)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      padding: '0.2rem',
                    }}
                  >
                    <ArrowLeft size={18} color="#334155" />
                  </button>
                )}
                <div>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: '#0f172a',
                    }}
                  >
                    {currentThread.subjectTitle}
                  </h4>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <ShieldCheck size={12} /> Contact privacy protected
                  </div>
                </div>
              </div>

              {/* Teacher Office Hours Notice (Workload Protection) */}
              <div
                style={{
                  backgroundColor: '#eff6ff',
                  color: '#1e40af',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.72rem',
                  borderBottom: '1px solid #dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Clock size={13} />
                <span>
                  <strong>Office Hours:</strong> Teachers reply between{' '}
                  <strong>2:00 PM – 3:30 PM</strong> to protect teaching time.
                </span>
              </div>

              {/* Messages Body */}
              <div
                style={{
                  flexGrow: 1,
                  padding: '1rem',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                {loadingMessages ? (
                  <div
                    style={{
                      color: '#94a3b8',
                      fontSize: '0.8rem',
                      textAlign: 'center',
                      margin: 'auto',
                    }}
                  >
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div
                    style={{
                      color: '#94a3b8',
                      fontSize: '0.8rem',
                      textAlign: 'center',
                      margin: 'auto',
                    }}
                  >
                    No messages yet in this conversation.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.senderUserId === currentUserId;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isSelf ? 'flex-end' : 'flex-start',
                          maxWidth: isMobile ? '82%' : '65%',
                          backgroundColor: isSelf ? '#2563eb' : '#ffffff',
                          color: isSelf ? '#ffffff' : '#0f172a',
                          padding: '0.6rem 0.85rem',
                          borderRadius: '0.6rem',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          border: isSelf ? 'none' : '1px solid #e2e8f0',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.65rem',
                            opacity: 0.8,
                            marginBottom: '0.15rem',
                          }}
                        >
                          {isSelf
                            ? 'You'
                            : msg.senderRole === 'teacher'
                              ? 'Class Teacher'
                              : 'Parent'}
                        </div>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {msg.content}
                        </div>
                        <div
                          style={{
                            fontSize: '0.6rem',
                            marginTop: '0.2rem',
                            textAlign: 'right',
                            opacity: 0.7,
                          }}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Error Banner (if any) */}
              {replyError && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    color: '#991b1b',
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    borderTop: '1px solid #fee2e2',
                  }}
                >
                  <AlertCircle size={14} />
                  <span>{replyError}</span>
                </div>
              )}

              {/* Reply Form */}
              <form
                onSubmit={(e) => void handleSendReply(e)}
                style={{
                  padding: '0.65rem 0.85rem',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  gap: '0.5rem',
                  backgroundColor: '#ffffff',
                }}
              >
                <input
                  type="text"
                  placeholder="Type your message... (Press Enter to send)"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  enterKeyHint="send"
                  disabled={replyMutation.isPending}
                  style={{
                    flexGrow: 1,
                    padding: '0.55rem 0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.4rem',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={replyMutation.isPending || !replyText.trim()}
                  style={{ padding: '0.5rem 0.85rem', borderRadius: '0.4rem' }}
                >
                  <Send size={15} />
                </Button>
              </form>
            </>
          ) : (
            <div
              style={{
                flexGrow: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '0.85rem',
              }}
            >
              Select a conversation from the left to read and reply.
            </div>
          )}
        </div>
      )}

      {/* Start New Conversation Modal */}
      <Dialog
        open={newChatOpen}
        title="Start New Conversation"
        description="Select student and teacher directly without typing any IDs."
        onOpenChange={(open) => {
          if (!open) setNewChatOpen(false);
        }}
      >
        <form
          onSubmit={handleStartConversation}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
        >
          <div>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Select Student
            </label>
            <select
              aria-label="Select linked student"
              required
              value={selectedStudentId}
              onChange={(event) => {
                const nextStudentId = event.target.value;
                const nextStudent = contacts.find(
                  (item) => item.studentId === nextStudentId,
                );
                setSelectedStudentId(nextStudentId);
                setSelectedTeacherUserId(
                  nextStudent?.teachers[0]?.userId ?? '',
                );
              }}
              disabled={contactsQuery.isPending || contacts.length === 0}
              style={{
                width: '100%',
                padding: '0.45rem',
                border: '1px solid #cbd5e1',
                borderRadius: '0.35rem',
                fontSize: '0.85rem',
              }}
            >
              <option value="">Select a linked student</option>
              {contacts.map((contact) => (
                <option key={contact.studentId} value={contact.studentId}>
                  {contact.studentName} · {contact.className}{' '}
                  {contact.sectionName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Select Assigned Teacher
            </label>
            <select
              aria-label="Select assigned teacher"
              required
              value={selectedTeacherUserId}
              onChange={(event) => setSelectedTeacherUserId(event.target.value)}
              disabled={
                contactsQuery.isPending || availableTeachers.length === 0
              }
              style={{
                width: '100%',
                padding: '0.45rem',
                border: '1px solid #cbd5e1',
                borderRadius: '0.35rem',
                fontSize: '0.85rem',
              }}
            >
              <option value="">
                Select a teacher assigned to this section
              </option>
              {availableTeachers.map((teacher) => (
                <option key={teacher.userId} value={teacher.userId}>
                  {teacher.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Subject
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Mathematics Progress / Leave Inquiry"
              value={subjectTitle}
              onChange={(e) => setSubjectTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem',
                border: '1px solid #cbd5e1',
                borderRadius: '0.35rem',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Initial Message
            </label>
            <textarea
              required
              rows={3}
              placeholder="Write your note..."
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem',
                border: '1px solid #cbd5e1',
                borderRadius: '0.35rem',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {formError && (
            <div style={{ color: '#dc2626', fontSize: '0.78rem' }}>
              {formError}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              marginTop: '0.4rem',
            }}
          >
            <Button
              type="button"
              variant="quiet"
              onClick={() => setNewChatOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
