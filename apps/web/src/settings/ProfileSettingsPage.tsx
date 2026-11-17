import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider.js';
import { notifyAuthSessionChanged } from '../auth/auth-session-sync.js';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { ErrorState } from '../components/ui/States.js';
import './settings.css';

export function ProfileSettingsPage() {
  const auth = useAuth();
  const [displayName, setDisplayName] = useState(auth.user?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!auth.user) {
    return (
      <ErrorState
        title="Profile unavailable"
        description="Sign in again to view your account profile."
      />
    );
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setError('');
    setMessage('');
    try {
      await auth.updateProfile({ displayName });
      setMessage('Your profile name has been updated.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Profile could not be updated.',
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (newPassword.length < 12 || newPassword.length > 128) {
      setError('New password must be 12 to 128 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await apiRequest('/auth/password/change', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      notifyAuthSessionChanged();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage(
        'Your password has been changed. Other sessions have been signed out.',
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Password could not be changed.',
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="settings-profile-content reference-live-module">
      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <h2>Profile information</h2>
          </div>
        </div>
        <form className="settings-fields" onSubmit={saveProfile}>
          <label className="settings-field">
            <span>Full name</span>
            <input
              autoComplete="name"
              maxLength={120}
              minLength={2}
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>Email address</span>
            <input type="email" value={auth.user.email} readOnly />
          </label>
          <div className="settings-save-row">
            <Button type="submit" variant="primary" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </form>
      </section>
      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <h2>Change password</h2>
          </div>
        </div>
        <form className="settings-fields" onSubmit={savePassword}>
          <label className="settings-field">
            <span>Current password</span>
            <input
              autoComplete="current-password"
              required
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>New password</span>
            <input
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>Confirm new password</span>
            <input
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <div className="settings-save-row">
            <Button type="submit" variant="primary" disabled={savingPassword}>
              {savingPassword ? 'Updating…' : 'Update password'}
            </Button>
          </div>
        </form>
      </section>
      {message && (
        <p className="settings-readonly-note" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
