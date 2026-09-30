import { useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider.js';
import { Button } from '../../components/ui/Button.js';
import { FormField } from '../../components/ui/FormField.js';
import { ApiError } from '../../api/client.js';

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const registrationSchema = z.object({
  displayName: z.string().min(2, 'Enter at least two characters.').max(120),
  email: z.email('Enter a valid email address.'),
  password: z.string().min(12, 'Use at least 12 characters.').max(128),
});

const emailSchema = z.object({
  email: z.email('Enter a valid email address.'),
});
const resetSchema = z
  .object({
    password: z.string().min(12, 'Use at least 12 characters.').max(128),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: 'Passwords must match.',
    path: ['confirmation'],
  });

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'We could not complete that request. Please try again.';
}

function AuthFrame({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="auth-page">
      <Link className="auth-brand" to="/login" aria-label="InstituteOS sign in">
        <span className="brand-mark" aria-hidden="true">
          I
        </span>
        <span>
          <strong>InstituteOS</strong>
          <small>Education operations</small>
        </span>
      </Link>
      <section className="auth-panel" aria-labelledby="auth-title">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </section>
      <p className="auth-legal">Secure access to your InstituteOS workspace</p>
    </main>
  );
}

function FormStatus({ error, success }: { error?: string; success?: string }) {
  if (error)
    return (
      <p className="form-status form-status-error" role="alert">
        {error}
      </p>
    );
  if (success)
    return (
      <p className="form-status form-status-success" role="status">
        {success}
      </p>
    );
  return null;
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });
  if (auth.status === 'authenticated')
    return <Navigate to="/platform" replace />;

  const submit = form.handleSubmit(async (values) => {
    setError('');
    try {
      await auth.login(values);
      const destination = (location.state as { from?: string } | null)?.from;
      navigate(destination?.startsWith('/') ? destination : '/platform', {
        replace: true,
      });
    } catch (cause) {
      setError(errorMessage(cause));
    }
  });

  return (
    <AuthFrame
      eyebrow="Welcome back"
      title="Sign in to InstituteOS"
      description="Use your account email and password to continue."
      footer={
        <>
          New to InstituteOS? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField
          label="Email address"
          type="email"
          autoComplete="email"
          {...form.register('email')}
          error={form.formState.errors.email?.message}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          {...form.register('password')}
          error={form.formState.errors.password?.message}
        />
        <div className="auth-inline-link">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <FormStatus error={error} />
        {searchParams.get('registration') === 'complete' && (
          <FormStatus success="If registration was completed, you can sign in. If you already have an account, sign in or use Forgot password." />
        )}
        {searchParams.get('passwordReset') === '1' && (
          <FormStatus success="Your password was updated. Sign in with your new password." />
        )}
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="auth-submit"
        >
          {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthFrame>
  );
}

export function RegistrationPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof registrationSchema>>({
    resolver: zodResolver(registrationSchema),
    mode: 'onBlur',
  });
  if (auth.status === 'authenticated')
    return <Navigate to="/platform" replace />;
  const submit = form.handleSubmit(async (values) => {
    setError('');
    try {
      const result = await auth.register(values);
      navigate(
        result.verificationRequired
          ? '/verification-pending'
          : '/login?registration=complete',
        { replace: true },
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  });
  return (
    <AuthFrame
      eyebrow="Get started"
      title="Create your account"
      description="Set up your personal InstituteOS identity. Organization access is managed separately."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link> or{' '}
          <Link to="/forgot-password">reset your password</Link>.
        </>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField
          label="Full name"
          autoComplete="name"
          {...form.register('displayName')}
          error={form.formState.errors.displayName?.message}
        />
        <FormField
          label="Email address"
          type="email"
          autoComplete="email"
          {...form.register('email')}
          error={form.formState.errors.email?.message}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters."
          {...form.register('password')}
          error={form.formState.errors.password?.message}
        />
        <FormStatus error={error} />
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="auth-submit"
        >
          {form.formState.isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const auth = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    mode: 'onBlur',
  });
  const submit = form.handleSubmit(async ({ email }) => {
    setError('');
    try {
      const result = await auth.forgotPassword(email);
      setSuccess(result.message);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  });
  return (
    <AuthFrame
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter the email address on your account. If it matches an active account, we’ll send reset instructions."
      footer={<Link to="/login">Return to sign in</Link>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField
          label="Email address"
          type="email"
          autoComplete="email"
          {...form.register('email')}
          error={form.formState.errors.email?.message}
        />
        <FormStatus error={error} success={success} />
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="auth-submit"
        >
          Send instructions
        </Button>
      </form>
    </AuthFrame>
  );
}

export function ResetPasswordPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const token =
    new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    mode: 'onBlur',
  });
  const submit = form.handleSubmit(async ({ password }) => {
    setError('');
    try {
      await auth.resetPassword({ token, newPassword: password });
      navigate('/login?passwordReset=1', { replace: true });
    } catch (cause) {
      setError(errorMessage(cause));
    }
  });
  if (!token)
    return (
      <AuthNotice
        title="Reset link unavailable"
        description="This password reset link is missing or invalid. Request a new one to continue."
        link={{ to: '/forgot-password', label: 'Request another link' }}
      />
    );
  return (
    <AuthFrame
      eyebrow="Account recovery"
      title="Choose a new password"
      description="Your reset link can only be used once and expires shortly."
      footer={<Link to="/login">Return to sign in</Link>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters."
          {...form.register('password')}
          error={form.formState.errors.password?.message}
        />
        <FormField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          {...form.register('confirmation')}
          error={form.formState.errors.confirmation?.message}
        />
        <FormStatus error={error} />
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="auth-submit"
        >
          Update password
        </Button>
      </form>
    </AuthFrame>
  );
}

export function VerifyEmailPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const token =
    new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const verify = async () => {
    setPending(true);
    setError('');
    try {
      await auth.verifyEmail(token);
      navigate('/platform', { replace: true });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  };
  return (
    <AuthFrame
      eyebrow="Email verification"
      title="Verify your email"
      description="Confirm the email address for your InstituteOS account."
      footer={<Link to="/login">Return to sign in</Link>}
    >
      {!token ? (
        <FormStatus error="This verification link is missing its token." />
      ) : null}
      {error && <FormStatus error={error} />}
      {token && (
        <Button
          type="button"
          onClick={() => void verify()}
          disabled={pending}
          className="auth-submit"
        >
          {pending ? 'Verifying…' : 'Verify email'}
        </Button>
      )}
    </AuthFrame>
  );
}

export function VerificationPendingPage() {
  const auth = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    mode: 'onBlur',
  });
  const submit = form.handleSubmit(async ({ email }) => {
    setError('');
    setSuccess('');
    try {
      const result = await auth.resendVerification(email);
      setSuccess(result.message);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  });
  return (
    <AuthFrame
      eyebrow="Email verification"
      title="Check your email"
      description="Follow the verification link to finish setting up your account."
      footer={<Link to="/login">Return to sign in</Link>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField
          label="Email address"
          type="email"
          autoComplete="email"
          {...form.register('email')}
          error={form.formState.errors.email?.message}
        />
        <FormStatus error={error} success={success} />
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="auth-submit"
        >
          Resend verification email
        </Button>
      </form>
    </AuthFrame>
  );
}

function AuthNotice({
  title,
  description,
  link,
}: {
  title: string;
  description: string;
  link: { to: string; label: string };
}) {
  return (
    <AuthFrame
      eyebrow="InstituteOS account"
      title={title}
      description={description}
      footer={<Link to={link.to}>{link.label}</Link>}
    >
      <p className="auth-notice" role="status">
        {description}
      </p>
    </AuthFrame>
  );
}
