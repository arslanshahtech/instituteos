import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  ArrowLeft,
  MessageSquare,
  Send,
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
  studentFilterId?: string;
}

export const ParentTeacherInbox: React.FC<ParentTeacherInboxProps> = ({
  organizationId,
  currentUserId,
  userRole,
  studentFilterId,
}) => {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeStudentFilterId, setActiveStudentFilterId] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Parent contact choices come from the authenticated account's linked students
  // and the teachers actually assigned to those students' active sections.
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTeacherUserId, setSelectedTeacherUserId] = useState('');
  const [selectedGuardianUserId, setSelectedGuardianUserId] = useState('');
  const [subjectTitle, setSubjectTitle] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [formError, setFormError] = useState('');

  const {
    data: threadsData,
    isLoading: loadingThreads,
    error: threadsError,
  } = useThreads(organizationId);
  const contactsQuery = useMessagingContacts(
    organizationId,
    userRole === 'parent_guardian' || userRole === 'teacher',
  );
  const contacts = contactsQuery.data?.items ?? [];
  const selectedStudent = contacts.find(
    (contact) => contact.studentId === selectedStudentId,
  );
  const availableTeachers = selectedStudent?.teachers ?? [];
  const availableGuardians = selectedStudent?.guardians ?? [];
  const {
    data: activeThreadData,
    isLoading: loadingMessages,
    error: threadError,
  } = useThreadDetail(organizationId, selectedThreadId);

  const replyMutation = useSendReply(organizationId, selectedThreadId ?? '');
  const startMutation = useStartConversation(organizationId);

  const threads = threadsData?.items ?? [];
  const messages = activeThreadData?.messages ?? [];
  const currentThread = activeThreadData?.thread;

  useEffect(() => {
    if (contacts.length === 0) return;
    const contact =
      contacts.find((item) => item.studentId === selectedStudentId) ??
      contacts[0]!;
    if (selectedStudentId !== contact.studentId)
      setSelectedStudentId(contact.studentId);
    if (
      userRole === 'parent_guardian' &&
      !contact.teachers.some((item) => item.userId === selectedTeacherUserId)
    ) {
      setSelectedTeacherUserId(contact.teachers[0]?.userId ?? '');
    }
    if (
      userRole === 'teacher' &&
      !contact.guardians?.some((item) => item.userId === selectedGuardianUserId)
    ) {
      setSelectedGuardianUserId(contact.guardians?.[0]?.userId ?? '');
    }
  }, [
    contacts,
    userRole,
    selectedStudentId,
    selectedTeacherUserId,
    selectedGuardianUserId,
  ]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const recipientSelected =
      userRole === 'teacher'
        ? Boolean(selectedGuardianUserId)
        : Boolean(selectedTeacherUserId);
    if (
      !selectedStudentId ||
      !recipientSelected ||
      !subjectTitle.trim() ||
      !initialMessage.trim()
    ) {
      setFormError(
        userRole === 'teacher'
          ? 'Select an assigned student and linked parent, then enter a subject and message.'
          : 'Select a linked student and assigned teacher, then enter a subject and message.',
      );
      return;
    }
    if (
      !selectedStudent ||
      (userRole === 'teacher'
        ? !availableGuardians.some(
            (guardian) => guardian.userId === selectedGuardianUserId,
          )
        : !availableTeachers.some(
            (teacher) => teacher.userId === selectedTeacherUserId,
          ))
    ) {
      setFormError(
        'The selected contact is not linked to this student. Refresh contacts and try again.',
      );
      return;
    }

    try {
      const result = await startMutation.mutateAsync({
        studentId: selectedStudentId,
        teacherUserId:
          userRole === 'teacher' ? currentUserId : selectedTeacherUserId,
        ...(userRole === 'teacher'
          ? { guardianUserId: selectedGuardianUserId }
          : {}),
        subjectTitle: `[${selectedStudent.studentName}] ${subjectTitle.trim()}`,
        initialMessage: initialMessage.trim(),
      });

      setNewChatOpen(false);
      setSubjectTitle('');
      setInitialMessage('');
      if (result.thread?.id) {
        if (studentFilterId === undefined)
          setActiveStudentFilterId(result.thread.studentId);
        setSelectedThreadId(result.thread.id);
      }
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to start conversation.',
      );
    }
  };

  const emptyConversationMessage =
    userRole !== 'parent_guardian' && userRole !== 'teacher'
      ? 'A linked parent can start a conversation.'
      : contactsQuery.isPending
        ? 'Checking linked contacts?'
        : contactsQuery.isError
          ? 'Contacts could not be loaded. Refresh and try again.'
          : contacts.length === 0
            ? userRole === 'teacher'
              ? 'No assigned students have linked parent accounts.'
              : 'No linked students found. Contact the college office.'
            : !contacts.some((contact) =>
                  userRole === 'teacher'
                    ? (contact.guardians?.length ?? 0) > 0
                    : contact.teachers.length > 0,
                )
              ? userRole === 'teacher'
                ? 'No assigned students have linked parent accounts.'
                : 'No linked students have assigned teachers yet.'
              : 'Select New message to start a conversation.';

  const effectiveStudentFilterId = studentFilterId ?? activeStudentFilterId;
  const visibleThreads = effectiveStudentFilterId
    ? threads.filter((thread) => thread.studentId === effectiveStudentFilterId)
    : threads;
  const displaySubject = (value: string) => value.replace(/^\[[^\]]+\]\s*/, '');
  // Desktop keeps the inbox and active conversation side by side.
  // Mobile switches between the list and conversation through CSS state.
  const showList = true;
  const showChat = true;

  return (
    <>
      <div
        className={`parent-teacher-inbox${selectedThreadId ? ' is-conversation-open' : ' is-list-only'}`}
      >
        {/* Conversation list */}
        {showList && (
          <aside className="inbox-conversation-list" aria-label="Conversations">
            <div className="message-list-toolbar">
              <span className="message-list-title">All chats</span>
              {(userRole === 'parent_guardian' || userRole === 'teacher') && (
                <Button
                  type="button"
                  variant="secondary"
                  className="message-new-button"
                  onClick={() => {
                    setFormError('');
                    setNewChatOpen(true);
                  }}
                >
                  <Plus size={16} aria-hidden="true" />
                  New message
                </Button>
              )}
            </div>

            <div className="inbox-conversation-items">
              {loadingThreads ? (
                <p className="inbox-list-state" role="status">
                  Loading conversations...
                </p>
              ) : threadsError ? (
                <p className="inbox-list-state" role="alert">
                  Conversations could not be loaded. Refresh and try again.
                </p>
              ) : visibleThreads.length === 0 ? (
                <div className="inbox-list-empty">
                  <span className="inbox-list-empty-icon">
                    <MessageSquare size={20} aria-hidden="true" />
                  </span>
                  <strong>No conversations yet</strong>
                  <p>
                    {effectiveStudentFilterId
                      ? 'No conversations for this student yet.'
                      : emptyConversationMessage}
                  </p>
                </div>
              ) : (
                visibleThreads.map((thread) => {
                  const isSelected = thread.id === selectedThreadId;
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => {
                        setSelectedThreadId(thread.id);
                        if (studentFilterId === undefined)
                          setActiveStudentFilterId(thread.studentId);
                        setReplyError('');
                      }}
                      className={`inbox-conversation-item${isSelected ? ' is-selected' : ''}`}
                      aria-current={isSelected ? 'true' : undefined}
                    >
                      <strong>{displaySubject(thread.subjectTitle)}</strong>
                      <time dateTime={thread.lastMessageAt}>
                        {new Date(thread.lastMessageAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </time>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* Right Chat View */}
        {showChat && (
          <div className="inbox-chat-panel">
            {selectedThreadId && currentThread ? (
              <>
                {/* Conversation header */}
                <div className="inbox-chat-header">
                  <button
                    type="button"
                    onClick={() => setSelectedThreadId(null)}
                    className="inbox-back-button"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft size={18} aria-hidden="true" />
                  </button>
                  <div className="inbox-chat-title">
                    <h2>{displaySubject(currentThread.subjectTitle)}</h2>
                  </div>
                </div>

                {/* Messages */}
                <div className="inbox-messages-body">
                  {loadingMessages ? (
                    <p className="inbox-chat-state" role="status">
                      Loading messages...
                    </p>
                  ) : messages.length === 0 ? (
                    <p className="inbox-chat-state">No messages yet.</p>
                  ) : (
                    messages.map((msg) => {
                      const isSelf = msg.senderUserId === currentUserId;
                      return (
                        <div
                          className={`inbox-message-row${isSelf ? ' is-self' : ' is-received'}`}
                          key={msg.id}
                        >
                          <article className="inbox-message-bubble">
                            <div className="inbox-message-content">
                              {msg.content}
                            </div>
                          </article>
                          <time
                            className="inbox-message-time"
                            dateTime={msg.createdAt}
                          >
                            {new Date(msg.createdAt).toLocaleString([], {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </time>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Error Banner (if any) */}
                {replyError && (
                  <div className="inbox-reply-error" role="alert">
                    <AlertCircle size={14} />
                    <span>{replyError}</span>
                  </div>
                )}

                {/* Reply Form */}
                <form
                  className="inbox-reply-form"
                  onSubmit={(e) => void handleSendReply(e)}
                >
                  <input
                    type="text"
                    aria-label="Type your message"
                    placeholder="Type your message..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    enterKeyHint="send"
                    disabled={replyMutation.isPending}
                    className="inbox-reply-input"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    aria-label="Send message"
                    disabled={replyMutation.isPending || !replyText.trim()}
                    className="inbox-send-button"
                  >
                    <Send size={15} />
                  </Button>
                </form>
              </>
            ) : selectedThreadId ? (
              <div className="inbox-chat-unavailable">
                <button
                  type="button"
                  onClick={() => setSelectedThreadId(null)}
                  className="inbox-back-button"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                </button>
                <p
                  className="inbox-chat-state"
                  role={loadingMessages ? 'status' : 'alert'}
                >
                  {loadingMessages
                    ? 'Loading messages...'
                    : threadError
                      ? 'Conversation could not be loaded.'
                      : 'Conversation unavailable.'}
                </p>
              </div>
            ) : (
              <div className="inbox-chat-state">
                Select a conversation to view messages.
              </div>
            )}
          </div>
        )}

        {/* Start New Conversation Modal */}
        <Dialog
          open={newChatOpen}
          title="New message"
          onOpenChange={(open) => {
            if (!open) setNewChatOpen(false);
          }}
        >
          <form
            onSubmit={handleStartConversation}
            className="inbox-new-conversation-form"
          >
            <div>
              <label className="inbox-form-label" htmlFor="inbox-student">
                Select student
              </label>
              <select
                id="inbox-student"
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
                  setSelectedGuardianUserId(
                    nextStudent?.guardians?.[0]?.userId ?? '',
                  );
                }}
                disabled={contactsQuery.isPending || contacts.length === 0}
                className="inbox-form-control"
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
              <label className="inbox-form-label">
                {userRole === 'teacher'
                  ? 'Select Parent / Guardian'
                  : 'Select Assigned Teacher'}
              </label>
              <select
                aria-label={
                  userRole === 'teacher'
                    ? 'Select linked parent'
                    : 'Select assigned teacher'
                }
                required
                value={
                  userRole === 'teacher'
                    ? selectedGuardianUserId
                    : selectedTeacherUserId
                }
                onChange={(event) =>
                  userRole === 'teacher'
                    ? setSelectedGuardianUserId(event.target.value)
                    : setSelectedTeacherUserId(event.target.value)
                }
                disabled={
                  contactsQuery.isPending ||
                  (userRole === 'teacher'
                    ? availableGuardians.length === 0
                    : availableTeachers.length === 0)
                }
                className="inbox-form-control"
              >
                <option value="">
                  {userRole === 'teacher'
                    ? 'Select a linked parent or guardian'
                    : 'Select a teacher assigned to this section'}
                </option>
                {(userRole === 'teacher'
                  ? availableGuardians
                  : availableTeachers
                ).map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="inbox-form-label" htmlFor="inbox-subject">
                Subject
              </label>
              <input
                id="inbox-subject"
                type="text"
                required
                placeholder="e.g. Mathematics Progress / Leave Inquiry"
                value={subjectTitle}
                onChange={(e) => setSubjectTitle(e.target.value)}
                className="inbox-form-control"
              />
            </div>

            <div>
              <label
                className="inbox-form-label"
                htmlFor="inbox-initial-message"
              >
                Message
              </label>
              <textarea
                id="inbox-initial-message"
                required
                rows={3}
                placeholder="Write your note..."
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                className="inbox-form-control"
              />
            </div>

            {formError && (
              <p className="inbox-form-error" role="alert">
                {formError}
              </p>
            )}

            <div className="inbox-form-actions">
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
    </>
  );
};
