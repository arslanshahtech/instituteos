import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { apiMessage, useOrganizationAccess } from '../staff/StaffPageShared.js';
import {
  useOrganizationSettings,
  useUpdateOrganizationSettings,
} from './settings-api.js';
import type { OrganizationSettings } from './settings-api.js';
import './settings.css';

type SettingsForm = {
  branding: {
    logoUrl: string;
    primaryColor: string;
    tagLine: string;
  };
  contact: {
    email: string;
    phone: string;
    address: string;
    website: string;
  };
  localization: OrganizationSettings['localization'];
  notifications: OrganizationSettings['notifications'];
};

const initialForm: SettingsForm = {
  branding: { logoUrl: '', primaryColor: '#0f766e', tagLine: '' },
  contact: { email: '', phone: '', address: '', website: '' },
  localization: {
    timezone: 'Asia/Karachi',
    currency: 'PKR',
    dateFormat: 'YYYY-MM-DD',
  },
  notifications: {
    emailAlerts: true,
    smsAlerts: false,
    autoAttendanceAlerts: false,
  },
};

const managerRoles = ['organization_owner', 'organization_admin'];

function formFromSettings(settings: OrganizationSettings): SettingsForm {
  return {
    branding: {
      logoUrl: settings.branding.logoUrl ?? '',
      primaryColor: settings.branding.primaryColor,
      tagLine: settings.branding.tagLine ?? '',
    },
    contact: {
      email: settings.contact.email ?? '',
      phone: settings.contact.phone ?? '',
      address: settings.contact.address ?? '',
      website: settings.contact.website ?? '',
    },
    localization: { ...settings.localization },
    notifications: { ...settings.notifications },
  };
}

export function SettingsPage() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const canManageSettings =
    access.data !== undefined && managerRoles.includes(access.data.role);
  const settings = useOrganizationSettings(organizationId, canManageSettings);
  const updateSettings = useUpdateOrganizationSettings(organizationId);
  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [activeTab, setActiveTab] = useState<
    'branding' | 'contact' | 'localization' | 'notifications'
  >('branding');

  useEffect(() => {
    if (settings.data?.settings) {
      setForm(formFromSettings(settings.data.settings));
    }
  }, [settings.data?.settings]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateSettings.mutate(form);
  };

  if (access.isPending) {
    return <LoadingState message="Checking organization access..." />;
  }
  if (access.error || !access.data) {
    return (
      <ErrorState
        title="Organization unavailable"
        description={
          access.error
            ? apiMessage(access.error)
            : 'Settings access could not be verified for this organization.'
        }
        onRetry={() => void access.refetch()}
      />
    );
  }
  if (!canManageSettings) return <PermissionDeniedState />;
  if (settings.isPending) {
    return <LoadingState message="Loading organization settings..." />;
  }
  if (settings.error) {
    return (
      <ErrorState
        title="Settings unavailable"
        description={apiMessage(settings.error)}
        onRetry={() => void settings.refetch()}
      />
    );
  }

  return (
    <div className="settings-page reference-live-module">
      <header className="page-heading settings-heading">
        <div>
          <p className="eyebrow">Organization workspace</p>
          <h1>Organization settings</h1>
          <p className="page-description">
            Manage your organization identity, contact details, regional
            preferences, and notifications.
          </p>
        </div>
      </header>

      <form className="settings-form" onSubmit={submit}>
        <nav className="settings-tabs" aria-label="Settings sections">
          {(
            [
              ['branding', 'Branding'],
              ['contact', 'Contact'],
              ['localization', 'Localization'],
              ['notifications', 'Notifications'],
            ] as const
          ).map(([key, label]) => (
            <button
              aria-current={activeTab === key ? 'page' : undefined}
              aria-pressed={activeTab === key}
              className={`settings-tab${activeTab === key ? ' is-active' : ''}`}
              key={key}
              onClick={() => setActiveTab(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        {activeTab === 'branding' && (
          <section
            aria-labelledby="settings-branding-title"
            className="settings-card"
          >
            <div className="settings-card-heading">
              <div>
                <h2 id="settings-branding-title">Branding</h2>
                <p>
                  Set the name and visual identity shown across your workspace.
                </p>
              </div>
            </div>
            <div className="settings-fields">
              <label className="settings-field">
                <span>Logo URL</span>
                <input
                  autoComplete="url"
                  name="logoUrl"
                  type="url"
                  value={form.branding?.logoUrl ?? ''}
                  onChange={(event) => {
                    const val = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, logoUrl: val },
                    }));
                  }}
                />
              </label>
              <div className="settings-field">
                <span>Primary brand color</span>
                <div className="settings-color-control">
                  <input
                    aria-label="Choose primary brand color"
                    className="settings-color-picker"
                    type="color"
                    value={form.branding?.primaryColor ?? '#0f766e'}
                    onChange={(event) => {
                      const val = event.target.value;
                      setForm((prev) => ({
                        ...prev,
                        branding: { ...prev.branding, primaryColor: val },
                      }));
                    }}
                  />
                  <input
                    aria-label="Primary brand color hex value"
                    maxLength={7}
                    pattern="#[0-9A-Fa-f]{6}"
                    required
                    type="text"
                    value={form.branding?.primaryColor ?? ''}
                    onChange={(event) => {
                      const val = event.target.value;
                      setForm((prev) => ({
                        ...prev,
                        branding: { ...prev.branding, primaryColor: val },
                      }));
                    }}
                  />
                </div>
              </div>
              <label className="settings-field settings-field-wide">
                <span>Tagline</span>
                <input
                  maxLength={160}
                  name="tagLine"
                  type="text"
                  value={form.branding?.tagLine ?? ''}
                  onChange={(event) => {
                    const val = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, tagLine: val },
                    }));
                  }}
                />
                <small>Up to 160 characters.</small>
              </label>
            </div>
          </section>
        )}

        {activeTab === 'contact' && (
          <section
            aria-labelledby="settings-contact-title"
            className="settings-card"
          >
            <div className="settings-card-heading">
              <div>
                <h2 id="settings-contact-title">Contact &amp; details</h2>
                <p>Official contact information for your organization.</p>
              </div>
            </div>
            <div className="settings-fields">
              <label className="settings-field">
                <span>Official email</span>
                <input
                  autoComplete="email"
                  name="email"
                  type="email"
                  value={form.contact?.email ?? ''}
                  onChange={(event) => {
                    const val = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      contact: { ...prev.contact, email: val },
                    }));
                  }}
                />
              </label>
              <label className="settings-field">
                <span>Phone</span>
                <input
                  autoComplete="tel"
                  name="phone"
                  type="tel"
                  value={form.contact?.phone ?? ''}
                  onChange={(event) => {
                    const val = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      contact: { ...prev.contact, phone: val },
                    }));
                  }}
                />
              </label>
              <label className="settings-field settings-field-wide">
                <span>Address</span>
                <textarea
                  autoComplete="street-address"
                  name="address"
                  rows={3}
                  value={form.contact?.address ?? ''}
                  onChange={(event) => {
                    const val = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      contact: { ...prev.contact, address: val },
                    }));
                  }}
                />
              </label>
              <label className="settings-field settings-field-wide">
                <span>Website</span>
                <input
                  autoComplete="url"
                  name="website"
                  type="url"
                  value={form.contact?.website ?? ''}
                  onChange={(event) => {
                    const val = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      contact: { ...prev.contact, website: val },
                    }));
                  }}
                />
              </label>
            </div>
          </section>
        )}

        {activeTab === 'localization' && (
          <section
            aria-labelledby="settings-localization-title"
            className="settings-card"
          >
            <div className="settings-card-heading">
              <div>
                <h2 id="settings-localization-title">Localization</h2>
                <p>
                  Choose the regional conventions used in this organization.
                </p>
              </div>
            </div>
            <div className="settings-fields">
              <label className="settings-field">
                <span>Timezone</span>
                <select
                  value={form.localization?.timezone ?? 'Asia/Karachi'}
                  onChange={(event) => {
                    const val = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      localization: { ...prev.localization, timezone: val },
                    }));
                  }}
                >
                  <option value="Asia/Karachi">Pakistan (Asia/Karachi)</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">
                    United Kingdom (Europe/London)
                  </option>
                  <option value="America/New_York">
                    Eastern US (America/New_York)
                  </option>
                  <option value="Asia/Dubai">
                    United Arab Emirates (Asia/Dubai)
                  </option>
                </select>
              </label>
              <label className="settings-field">
                <span>Currency</span>
                <select
                  value={form.localization?.currency ?? 'PKR'}
                  onChange={(event) => {
                    const val = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      localization: { ...prev.localization, currency: val },
                    }));
                  }}
                >
                  <option value="PKR">PKR — Pakistani Rupee</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="GBP">GBP — Pound Sterling</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                </select>
              </label>
              <label className="settings-field">
                <span>Date format</span>
                <select
                  value={form.localization?.dateFormat ?? 'YYYY-MM-DD'}
                  onChange={(event) => {
                    const val = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      localization: { ...prev.localization, dateFormat: val },
                    }));
                  }}
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                </select>
              </label>
            </div>
          </section>
        )}

        {activeTab === 'notifications' && (
          <section
            aria-labelledby="settings-notifications-title"
            className="settings-card"
          >
            <div className="settings-card-heading">
              <div>
                <h2 id="settings-notifications-title">Notifications</h2>
                <p>Configure organization-wide notification preferences.</p>
              </div>
            </div>
            <div className="settings-toggles">
              <label className="settings-toggle">
                <span>
                  <strong>Email alerts</strong>
                  <small>Receive operational alerts by email.</small>
                </span>
                <input
                  checked={form.notifications?.emailAlerts ?? true}
                  onChange={(event) => {
                    const val = event.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        emailAlerts: val,
                      },
                    }));
                  }}
                  type="checkbox"
                />
              </label>
              <label className="settings-toggle">
                <span>
                  <strong>SMS alerts</strong>
                  <small>Receive operational alerts by text message.</small>
                </span>
                <input
                  checked={form.notifications?.smsAlerts ?? false}
                  onChange={(event) => {
                    const val = event.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      notifications: { ...prev.notifications, smsAlerts: val },
                    }));
                  }}
                  type="checkbox"
                />
              </label>
            </div>
          </section>
        )}

        {updateSettings.error && (
          <p className="settings-error" role="alert">
            {apiMessage(updateSettings.error)}
          </p>
        )}
        <div className="settings-save-row">
          <Button
            disabled={updateSettings.isPending}
            type="submit"
            variant="primary"
          >
            {updateSettings.isPending ? 'Saving settings…' : 'Save settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
