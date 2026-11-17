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
        if (isMounted) setErrorMessage('Pickup contacts could not be loaded.');
      });

    return () => {
      isMounted = false;
    };
  }, [organizationId, studentId]);

  const handleGeneratePass = async (personId: string) => {
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const data = await generateGatePass(organizationId, studentId, personId);
      setActivePass(data.pass);
      setStatusMessage('Pass generated.');
    } catch {
      setErrorMessage('Could not generate pass.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\\d{6}$/.test(verifyCode)) return;
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const data = await verifyAndRelease(organizationId, verifyCode);
      setStatusMessage(data.message || 'Student released.');
      setVerifyCode('');
    } catch {
      setErrorMessage('PIN verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const isStaff = userRole !== 'parent_guardian' && userRole !== 'student';

  return (
    <details className="student-pickup-panel">
      <summary>
        <span>
          <strong>Pickup verification</strong>
          <small>Optional · use only for authorized student pickups</small>
        </span>
        <span className="student-pickup-toggle" aria-hidden="true">
          +
        </span>
      </summary>

      <div className="student-pickup-content">
        {errorMessage && (
          <p className="student-pickup-message is-error" role="alert">
            {errorMessage}
          </p>
        )}
        {statusMessage && (
          <p className="student-pickup-message is-success" role="status">
            {statusMessage}
          </p>
        )}

        <section className="student-pickup-contacts">
          <h3>Authorized contacts</h3>
          {persons.length === 0 ? (
            <p className="student-pickup-empty">No pickup contacts added.</p>
          ) : (
            <ul>
              {persons.map((person) => (
                <li key={person.id}>
                  <span className="student-pickup-person">
                    <strong>{person.fullName}</strong>
                    <small>
                      {person.relationship} · {person.phone}
                    </small>
                  </span>
                  {person.status === 'active' && (
                    <button
                      className="student-pickup-action"
                      type="button"
                      disabled={loading}
                      onClick={() => void handleGeneratePass(person.id)}
                    >
                      Generate pass
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {activePass && (
          <div className="student-pickup-pass">
            <small>Single-use PIN</small>
            <strong>{activePass.passCode}</strong>
            <span>
              Valid until {new Date(activePass.validUntil).toLocaleTimeString()}
            </span>
          </div>
        )}

        {isStaff && (
          <form className="student-pickup-verify" onSubmit={handleVerifyPass}>
            <label htmlFor="student-pickup-pin">Gate PIN</label>
            <div>
              <input
                id="student-pickup-pin"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit PIN"
                value={verifyCode}
                onChange={(event) =>
                  setVerifyCode(
                    event.target.value.replace(/\\D/g, '').slice(0, 6),
                  )
                }
                maxLength={6}
              />
              <button
                type="submit"
                disabled={loading || verifyCode.length !== 6}
              >
                Verify
              </button>
            </div>
          </form>
        )}
      </div>
    </details>
  );
};
