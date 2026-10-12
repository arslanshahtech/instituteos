import React, { useEffect, useState } from 'react';
import {
  fetchPickupPersons,
  generateGatePass,
  verifyAndRelease,
  type AuthorizedPickupPerson,
  type PickupPass,
} from './pickup-api.js';

interface ChildPickupPanelProps {
  organizationId: string;
  studentId: string;
  userRole?: string;
}

export const ChildPickupPanel: React.FC<ChildPickupPanelProps> = ({
  organizationId,
  studentId,
  userRole = 'parent_guardian',
}) => {
  const [persons, setPersons] = useState<AuthorizedPickupPerson[]>([]);
  const [activePass, setActivePass] = useState<PickupPass | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!organizationId || !studentId) return;

    fetchPickupPersons(organizationId, studentId)
      .then((data) => {
        if (isMounted) setPersons(data.items || []);
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Unable to load authorized pickup persons.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [organizationId, studentId]);

  const handleGeneratePass = async (personId: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await generateGatePass(
        organizationId,
        studentId,
        personId,
      );
      setActivePass(data.pass);
      setStatusMessage('Digital Pass generated successfully.');
    } catch {
      setErrorMessage('Could not generate pass.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await verifyAndRelease(organizationId, verifyCode);
      setStatusMessage(data.message || 'Student released successfully.');
      setVerifyCode('');
    } catch {
      setErrorMessage('Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const isStaff = userRole !== 'parent_guardian' && userRole !== 'student';

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        padding: '1.25rem',
        borderRadius: '0.5rem',
        marginTop: '1.5rem',
        backgroundColor: '#ffffff',
      }}
    >
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>
        Safe Child Pickup & Gate-Pass Protocol
      </h3>

      {errorMessage && (
        <div style={{ color: '#dc2626', marginBottom: '1rem' }}>
          {errorMessage}
        </div>
      )}

      {statusMessage && (
        <div style={{ color: '#16a34a', marginBottom: '1rem' }}>
          {statusMessage}
        </div>
      )}

      <section style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
          Authorized Pickup Persons
        </h4>
        {persons.length === 0 ? (
          <p style={{ color: '#64748b' }}>No authorized pickup persons registered.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {persons.map((person) => (
              <li
                key={person.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div>
                  <strong>{person.fullName}</strong> ({person.relationship}) -{' '}
                  <span style={{ color: '#64748b' }}>{person.phone}</span>
                </div>
                {person.status === 'active' && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleGeneratePass(person.id)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.25rem',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    Generate Pass
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {activePass && (
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '2px dashed #3b82f6',
            borderRadius: '0.375rem',
            padding: '1rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Single-Use Gate Pass Code
          </div>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              letterSpacing: '0.25rem',
              color: '#1e3a8a',
            }}
          >
            {activePass.passCode}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            Valid until: {new Date(activePass.validUntil).toLocaleTimeString()}
          </div>
        </div>
      )}

      {isStaff && (
        <section
          style={{
            borderTop: '1px solid #e2e8f0',
            paddingTop: '1rem',
          }}
        >
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
            Gatekeeper / Staff Release Verification
          </h4>
          <form
            onSubmit={handleVerifyPass}
            style={{ display: 'flex', gap: '0.5rem' }}
          >
            <input
              type="text"
              placeholder="Enter 6-digit PIN"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              maxLength={6}
              style={{
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '0.25rem',
                flexGrow: 1,
              }}
            />
            <button
              type="submit"
              disabled={loading || verifyCode.trim().length !== 6}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.25rem',
                border: 'none',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Verify & Release
            </button>
          </form>
        </section>
      )}
    </div>
  );
};