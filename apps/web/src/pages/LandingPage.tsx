import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import '../styles/landing.css';

const features = [
  {
    title: 'Student & guardian records',
    description:
      'Keep student profiles and family links organized inside each institute.',
    icon: '01',
  },
  {
    title: 'Attendance & homework',
    description:
      'Record attendance, share assignments and keep families informed.',
    icon: '02',
  },
  {
    title: 'Fees & concessions',
    description:
      'Track fee plans, payments, concessions and receipts with clear records.',
    icon: '03',
  },
  {
    title: 'Academic operations',
    description:
      'Manage classes, admissions, assessments and published results.',
    icon: '04',
  },
  {
    title: 'Role-based workspaces',
    description:
      'Give admins, teachers, accountants, parents and students the right tools.',
    icon: '05',
  },
  {
    title: 'Private by organization',
    description:
      'Keep each institute’s records scoped to its own authorized workspace.',
    icon: '06',
  },
];

const plans = [
  {
    name: 'Starter',
    price: '$49',
    note: 'per month · up to 200 students',
    features: [
      'Student & guardian records',
      'Attendance & homework',
      '1 admin + 5 teachers',
      'Email support',
    ],
    cta: 'Request Starter',
    popular: false,
  },
  {
    name: 'Growth',
    price: '$149',
    note: 'per month · up to 800 students',
    features: [
      'Everything in Starter',
      'Finance & concessions',
      'Unlimited teachers',
      'Admissions & reports',
      'Custom subdomain',
    ],
    cta: 'Request Growth',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '$399',
    note: 'per month · unlimited students',
    features: [
      'Everything in Growth',
      'Advanced integrations',
      'API & webhooks',
      'Dedicated onboarding',
      'Custom deployment discussion',
    ],
    cta: 'Talk to our team',
    popular: false,
  },
];

type DemoRequest = {
  organizationName: string;
  contactName: string;
  email: string;
  phone: string;
  studentCountEstimate: number;
  plan: string;
  message: string;
};

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('Growth');
  const [form, setForm] = useState<DemoRequest>({
    organizationName: '',
    contactName: '',
    email: '',
    phone: '',
    studentCountEstimate: 100,
    plan: 'Growth',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function requestPlan(plan: string) {
    setSelectedPlan(plan);
    setForm((current) => ({ ...current, plan }));
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitted(false);
    setError('');
    try {
      await apiRequest<{ message: string }>('/public/demo-requests', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSubmitted(true);
      setForm({
        organizationName: '',
        contactName: '',
        email: '',
        phone: '',
        studentCountEstimate: 100,
        plan: selectedPlan,
        message: '',
      });
    } catch {
      setError(
        'We could not submit your request right now. Please try again in a moment.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="marketing-site">
      <header className="marketing-header">
        <div className="marketing-header-inner">
          <Link
            to="/"
            className="marketing-brand"
            aria-label="InstituteOS home"
          >
            <span className="marketing-brand-mark">I</span>
            <span>
              <strong>InstituteOS</strong>
              <small>Education operations</small>
            </span>
          </Link>
          <nav
            className={
              mobileMenuOpen ? 'marketing-nav is-open' : 'marketing-nav'
            }
            aria-label="Main navigation"
          >
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>
              Features
            </a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>
              How it works
            </a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>
              Pricing
            </a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)}>
              Contact
            </a>
          </nav>
          <div className="marketing-header-actions">
            <Link className="marketing-login-link" to="/login">
              Sign in
            </Link>
            <a className="primary-button marketing-header-cta" href="#contact">
              Request a demo <ArrowRight size={15} />
            </a>
          </div>
          <button
            className="marketing-mobile-toggle"
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <section className="marketing-hero">
        <div className="marketing-container marketing-hero-grid">
          <div className="marketing-hero-copy">
            <div className="marketing-overline">
              <span className="marketing-overline-dot" /> ONE WORKSPACE.
              EVERYDAY CLARITY.
            </div>
            <h1>
              Run your institute.
              <br />
              <span>Not the paperwork.</span>
            </h1>
            <p>
              InstituteOS brings student records, attendance, academics, fees
              and family communication into one calm, connected workspace.
            </p>
            <div className="marketing-hero-actions">
              <a className="primary-button" href="#contact">
                Request a demo <ArrowRight size={16} />
              </a>
              <a className="secondary-button" href="#features">
                Explore features
              </a>
            </div>
            <div className="marketing-trust-line">
              <ShieldCheck size={16} /> Private workspaces for every
              organization
            </div>
          </div>
          <div
            className="marketing-product-preview"
            aria-label="Illustrative InstituteOS dashboard preview"
          >
            <div className="preview-window-bar">
              <div className="preview-dots">
                <i />
                <i />
                <i />
              </div>
              <span>InstituteOS / Overview</span>
              <span className="preview-window-status">
                <span /> Live workspace
              </span>
            </div>
            <div className="preview-window-body">
              <aside className="preview-sidebar">
                <div className="preview-mini-brand">
                  <span>I</span> InstituteOS
                </div>
                <div className="preview-side-label">WORKSPACE</div>
                {[
                  'Overview',
                  'Students',
                  'Attendance',
                  'Homework',
                  'Admissions',
                  'Finance',
                  'Reports',
                ].map((item, i) => (
                  <div
                    className={
                      i === 0
                        ? 'preview-side-item is-current'
                        : 'preview-side-item'
                    }
                    key={item}
                  >
                    <span className="preview-side-icon">
                      {['◫', '▦', '✓', '▤', '＋', '＄', '▥'][i]}
                    </span>
                    {item}
                  </div>
                ))}
              </aside>
              <div className="preview-dashboard">
                <div className="preview-greeting">
                  <div>
                    <small>MONDAY, OCTOBER 19</small>
                    <h3>Good morning, Admin.</h3>
                    <p>Here’s what’s happening at your institute.</p>
                  </div>
                  <span className="preview-avatar">A</span>
                </div>
                <div className="preview-metrics">
                  <div>
                    <span>Total students</span>
                    <strong>642</strong>
                    <small>Across active classes</small>
                  </div>
                  <div>
                    <span>Attendance today</span>
                    <strong>94.8%</strong>
                    <small>Updated this morning</small>
                  </div>
                  <div>
                    <span>Fees collected</span>
                    <strong>₨ 8.4L</strong>
                    <small>This month</small>
                  </div>
                </div>
                <div className="preview-lower-grid">
                  <div className="preview-card">
                    <div className="preview-card-heading">
                      <strong>Attendance pulse</strong>
                      <span>THIS WEEK</span>
                    </div>
                    <div className="preview-chart">
                      {[
                        40, 65, 52, 78, 60, 88, 72, 96, 67, 84, 57, 76, 91, 70,
                        85, 62, 80, 96, 72, 88, 64, 82, 56, 75, 91, 68, 84, 72,
                      ].map((height, i) => (
                        <i style={{ height: height + '%' }} key={i} />
                      ))}
                    </div>
                    <div className="preview-chart-footer">
                      <span>
                        <i /> Present
                      </span>
                      <span>Weekly overview</span>
                    </div>
                  </div>
                  <div className="preview-card preview-tasks">
                    <div className="preview-card-heading">
                      <strong>Today’s checklist</strong>
                      <span>3 ITEMS</span>
                    </div>
                    {[
                      'Review attendance',
                      'Follow up on fee dues',
                      'Approve new admissions',
                    ].map((task, i) => (
                      <div className="preview-task" key={task}>
                        <span
                          className={
                            i === 0
                              ? 'preview-task-check is-done'
                              : 'preview-task-check'
                          }
                        >
                          {i === 0 ? '✓' : ''}
                        </span>
                        <span>{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="preview-caption">
              <span className="preview-caption-check">
                <Check size={13} />
              </span>{' '}
              Clear views. Real records. Access based on role.
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-trusted">
        <div className="marketing-container marketing-trusted-inner">
          <span>MADE FOR EDUCATION TEAMS</span>
          <div>
            {[
              'Schools',
              'Colleges',
              'Academies',
              'Institutes',
              'Multi-campus groups',
            ].map((name) => (
              <strong key={name}>{name}</strong>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section" id="features">
        <div className="marketing-container">
          <div className="marketing-section-heading">
            <span className="marketing-kicker">FEATURES</span>
            <h2>
              Everything you need,
              <br />
              nothing you don’t.
            </h2>
            <p>
              Everyday school operations, connected in one dependable place.
            </p>
          </div>
          <div className="marketing-feature-grid">
            {features.map((feature) => (
              <article className="marketing-feature-card" key={feature.title}>
                <span className="marketing-feature-number">{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <span className="marketing-feature-arrow">
                  <ArrowRight size={16} />
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-how-section" id="how-it-works">
        <div className="marketing-container marketing-how-grid">
          <div>
            <span className="marketing-kicker">HOW IT WORKS</span>
            <h2>
              From setup to school day.
              <br />
              Keep it simple.
            </h2>
            <p className="marketing-how-intro">
              A clear start for your team, with access shaped around each
              person’s responsibilities.
            </p>
            <a className="primary-button" href="#contact">
              Get started <ArrowRight size={16} />
            </a>
          </div>
          <div className="marketing-steps">
            {[
              {
                n: '01',
                title: 'Request your workspace',
                desc: 'Tell us about your institute and the tools your team needs.',
              },
              {
                n: '02',
                title: 'Set up your organization',
                desc: 'Your workspace is provisioned and the organization owner is invited securely.',
              },
              {
                n: '03',
                title: 'Invite your team',
                desc: 'Assign the right roles so staff, families and students see the tools meant for them.',
              },
              {
                n: '04',
                title: 'Run daily operations',
                desc: 'Work with real institute records from one connected workspace.',
              },
            ].map((step) => (
              <div className="marketing-step" key={step.n}>
                <span>{step.n}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-pricing-section" id="pricing">
        <div className="marketing-container">
          <div className="marketing-section-heading">
            <span className="marketing-kicker">PRICING</span>
            <h2>
              Choose a plan that fits
              <br />
              your institute.
            </h2>
            <p>
              Plan details are indicative and can be confirmed during your demo.
            </p>
          </div>
          <div className="marketing-pricing-grid">
            {plans.map((plan) => (
              <article
                className={
                  plan.popular ? 'marketing-plan is-popular' : 'marketing-plan'
                }
                key={plan.name}
              >
                {plan.popular && (
                  <div className="marketing-plan-badge">MOST POPULAR</div>
                )}
                <h3>{plan.name}</h3>
                <p className="marketing-plan-note">{plan.note}</p>
                <div className="marketing-plan-price">
                  {plan.price}
                  <span>/mo</span>
                </div>
                <div className="marketing-plan-divider" />
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={15} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  className={
                    plan.popular
                      ? 'primary-button marketing-plan-button'
                      : 'secondary-button marketing-plan-button'
                  }
                  onClick={() => requestPlan(plan.name)}
                  type="button"
                >
                  {plan.cta}
                  <ArrowRight size={15} />
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-contact-section" id="contact">
        <div className="marketing-container marketing-contact-grid">
          <div className="marketing-contact-copy">
            <span className="marketing-kicker">LET’S TALK</span>
            <h2>
              Your institute deserves
              <br />a calmer way to work.
            </h2>
            <p>
              Tell us a little about your organization. The request will be sent
              for review; it will not automatically grant an account or create
              an organization login.
            </p>
            <div className="marketing-contact-assurance">
              <ShieldCheck size={19} />
              <span>
                <strong>Secure by design</strong>
                <small>
                  Access is granted by invitation and role, not by choosing a
                  role on the sign-in screen.
                </small>
              </span>
            </div>
          </div>
          <form className="marketing-contact-form" onSubmit={submitRequest}>
            <div className="marketing-form-heading">
              <h3>Request a demo</h3>
              <p>We’ll use these details to follow up about your workspace.</p>
            </div>
            <div className="marketing-form-row">
              <label>
                Institute name
                <input
                  required
                  maxLength={160}
                  value={form.organizationName}
                  onChange={(e) =>
                    setForm({ ...form, organizationName: e.target.value })
                  }
                  placeholder="e.g. City College"
                />
              </label>
              <label>
                Your name
                <input
                  required
                  maxLength={120}
                  value={form.contactName}
                  onChange={(e) =>
                    setForm({ ...form, contactName: e.target.value })
                  }
                  placeholder="Full name"
                />
              </label>
            </div>
            <div className="marketing-form-row">
              <label>
                Admin email
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@institute.edu"
                />
              </label>
              <label>
                Phone (optional)
                <input
                  type="tel"
                  maxLength={40}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+92 ..."
                />
              </label>
            </div>
            <label>
              Estimated student count
              <input
                required
                type="number"
                min={1}
                max={100000}
                value={form.studentCountEstimate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    studentCountEstimate: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Plan you’re interested in
              <select
                value={form.plan}
                onChange={(e) => {
                  setSelectedPlan(e.target.value);
                  setForm({ ...form, plan: e.target.value });
                }}
              >
                {plans.map((plan) => (
                  <option key={plan.name} value={plan.name}>
                    {plan.name} — {plan.price}/mo
                  </option>
                ))}
              </select>
            </label>
            <label>
              What would you like to manage?
              <textarea
                rows={3}
                maxLength={1200}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Attendance, fees, student records…"
              />
            </label>
            {error && (
              <p className="marketing-form-error" role="alert">
                {error}
              </p>
            )}
            {submitted && (
              <p className="marketing-form-success" role="status">
                Thanks — your demo request has been received for review.
              </p>
            )}
            <button
              className="primary-button marketing-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Sending request…' : 'Send demo request'}
              <ArrowRight size={16} />
            </button>
            <small className="marketing-form-privacy">
              Your request is for follow-up only. It does not create credentials
              or expose institute data.
            </small>
          </form>
        </div>
      </section>

      <footer className="marketing-footer">
        <div className="marketing-container marketing-footer-inner">
          <Link to="/" className="marketing-brand">
            <span className="marketing-brand-mark">I</span>
            <span>
              <strong>InstituteOS</strong>
              <small>Education operations</small>
            </span>
          </Link>
          <p>Built for clearer, more connected education operations.</p>
          <div>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <Link to="/login">Sign in</Link>
          </div>
          <span className="marketing-copyright">
            © {new Date().getFullYear()} InstituteOS
          </span>
        </div>
      </footer>
    </main>
  );
}
