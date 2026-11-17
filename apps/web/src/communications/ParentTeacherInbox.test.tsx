import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParentTeacherInbox } from './ParentTeacherInbox.js';

const mocks = vi.hoisted(() => ({
  useThreads: vi.fn(),
  useThreadDetail: vi.fn(),
  useSendReply: vi.fn(),
  useStartConversation: vi.fn(),
  useMessagingContacts: vi.fn(),
}));

vi.mock('./communications-api.js', () => mocks);

const thread = {
  id: 'thread-1',
  organizationId: 'org-1',
  studentId: 'student-1',
  teacherUserId: 'teacher-1',
  guardianUserId: 'parent-1',
  subjectTitle: 'Mathematics Progress',
  status: 'active',
  lastMessageAt: '2026-11-16T09:30:00.000Z',
  createdAt: '2026-11-16T09:00:00.000Z',
  updatedAt: '2026-11-16T09:30:00.000Z',
};

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

function renderInbox() {
  return render(
    <ParentTeacherInbox
      organizationId="org-1"
      currentUserId="parent-1"
      userRole="parent_guardian"
    />,
  );
}

describe('ParentTeacherInbox responsive layout', () => {
  beforeEach(() => {
    setViewport(1280);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    mocks.useThreads.mockReturnValue({
      data: { items: [thread] },
      isLoading: false,
    });
    mocks.useThreadDetail.mockImplementation(
      (_organizationId: string, threadId: string | null) => ({
        data: threadId
          ? {
              thread,
              messages: [
                {
                  id: 'message-1',
                  organizationId: 'org-1',
                  threadId,
                  senderUserId: 'teacher-1',
                  senderRole: 'teacher',
                  content: 'Please review chapter four.',
                  createdAt: '2026-11-16T09:30:00.000Z',
                },
              ],
            }
          : undefined,
        isLoading: false,
      }),
    );
    mocks.useSendReply.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mocks.useStartConversation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mocks.useMessagingContacts.mockReturnValue({
      data: {
        items: [
          {
            studentId: 'student-1',
            studentName: 'Ammar Saeed',
            className: 'First Year',
            sectionName: 'A',
            teachers: [{ userId: 'teacher-1', displayName: 'Class Teacher' }],
            guardians: [{ userId: 'parent-1', displayName: 'Parent' }],
          },
        ],
      },
      isPending: false,
      isError: false,
    });
  });

  it('shows the list first on desktop, then opens one full conversation view', async () => {
    renderInbox();

    expect(
      screen.getByRole('complementary', { name: 'Conversations' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Messages' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('All chats')).toBeVisible();
    expect(
      screen.getByText('Select a conversation to view messages.'),
    ).toBeVisible();
    expect(
      screen.queryByLabelText('Filter conversations by student'),
    ).not.toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole('button', { name: /Mathematics Progress/ }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Mathematics Progress' }),
    ).toBeVisible();
    expect(
      screen.getByRole('complementary', { name: 'Conversations' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Back to conversations' }),
    ).toBeVisible();
    expect(
      document.querySelector('.parent-teacher-inbox.is-conversation-open'),
    ).not.toBeNull();
    expect(
      screen.queryByLabelText('Change student conversation'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Filter conversations by student'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Please review chapter four.')).toBeVisible();
    expect(document.querySelector('.inbox-message-sender')).toBeNull();
    expect(screen.queryByText('You')).not.toBeInTheDocument();
    const messageTime = document.querySelector('.inbox-message-time');
    expect(messageTime).not.toBeNull();
    expect(messageTime).toHaveTextContent('2026');
    expect(messageTime?.closest('.inbox-message-bubble')).toBeNull();
  });

  it('keeps the mobile back action available when a conversation cannot load', async () => {
    setViewport(390);
    mocks.useThreadDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Request failed'),
    });
    renderInbox();

    fireEvent.click(
      await screen.findByRole('button', { name: /Mathematics Progress/ }),
    );

    expect(
      await screen.findByText('Conversation could not be loaded.'),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to conversations' }),
    );
    expect(
      screen.getByRole('complementary', { name: 'Conversations' }),
    ).toBeVisible();
  });

  it('shows only the list first on mobile, then opens the chat with a back action', async () => {
    setViewport(390);
    renderInbox();

    expect(
      await screen.findByRole('complementary', { name: 'Conversations' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Mathematics Progress' }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('.parent-teacher-inbox.is-list-only'),
    ).not.toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: /Mathematics Progress/ }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Mathematics Progress' }),
    ).toBeVisible();
    expect(
      document.querySelector('.parent-teacher-inbox.is-conversation-open'),
    ).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Back to conversations' }),
    ).toBeVisible();
    expect(
      document.querySelector('.parent-teacher-inbox.is-conversation-open'),
    ).not.toBeNull();
    expect(
      screen.queryByLabelText('Change student conversation'),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to conversations' }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('complementary', { name: 'Conversations' }),
      ).toBeVisible();
    });
    expect(
      screen.queryByRole('heading', { name: 'Mathematics Progress' }),
    ).not.toBeInTheDocument();
  });
});
