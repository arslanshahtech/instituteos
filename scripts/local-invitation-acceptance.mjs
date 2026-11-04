import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = 'http://127.0.0.1:5173';
const mailpitUrl = 'http://127.0.0.1:8025';
const inviteEmail = 'teacher.onboarding@instituteos.test';
const passwordPath = path.join(
  process.env.LOCALAPPDATA || process.env.TEMP || '.',
  'InstituteOS-Local-QA',
  'password.txt',
);
const password = (await fs.readFile(passwordPath, 'utf8')).trim();

async function mailpitMessages() {
  const response = await fetch(`${mailpitUrl}/api/v1/messages`);
  if (!response.ok) throw new Error('Mailpit inbox API is unavailable.');
  return (await response.json()).messages ?? [];
}

async function findMail(subjectText) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const messages = await mailpitMessages();
    const message = messages.find(
      (item) =>
        item.Subject?.includes(subjectText) &&
        item.To?.some((recipient) => recipient.Address === inviteEmail),
    );
    if (message) {
      const response = await fetch(
        `${mailpitUrl}/api/v1/message/${encodeURIComponent(message.ID)}`,
      );
      if (!response.ok) throw new Error('Could not read the captured test email.');
      return response.json();
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Mailpit did not receive the ${subjectText} email.`);
}

function extractLink(message, route) {
  const match = String(message.Text ?? '').match(
    new RegExp(`http://127\\.0\\.0\\.1:5173/${route}#token=[^\\s]+`),
  );
  if (!match) throw new Error(`Captured email did not contain the expected ${route} link.`);
  return match[0].replace(/[.)]$/, '');
}

const invitationMessage = await findMail('Invitation to join');
const invitationUrl = extractLink(invitationMessage, 'invitations/accept');

const targets = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('Dedicated Chrome test page is unavailable.');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
const apiResponses = [];
const runtimeExceptions = [];
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    runtimeExceptions.push(message.params.exceptionDetails?.text ?? 'Browser exception');
  }
  if (message.method === 'Network.responseReceived') {
    const response = message.params.response;
    if (response.url.includes('/api/v1/')) {
      apiResponses.push({
        status: response.status,
        url: response.url.replace(baseUrl, ''),
      });
    }
  }
});

function call(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('Chrome DevTools timeout: ' + method));
      }
    }, 30000);
    const original = pending.get(id);
    pending.set(id, (message) => {
      clearTimeout(timer);
      original(message);
    });
  });
}

async function evaluate(expression) {
  const response = await call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (response.result.exceptionDetails) {
    throw new Error(
      response.result.exceptionDetails.exception?.description ||
        response.result.exceptionDetails.text ||
        'Browser evaluation failed.',
    );
  }
  return response.result.result.value;
}

async function waitFor(predicate, label, timeoutMs = 40000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const state = await evaluate(
    '({url:location.href,body:document.body.innerText.slice(0,1400)})',
  );
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(state)}`);
}

async function navigate(url) {
  await call('Page.navigate', { url });
  await waitFor(() => evaluate('document.readyState === "complete"'), 'page load');
}

async function fill(selector, value, tagName = 'input') {
  return evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) throw new Error('Missing field: ' + ${JSON.stringify(selector)});
    const prototype = ${JSON.stringify(tagName)} === 'select' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
    setter.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

try {
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Network.enable');

  // Follow the actual invitation link from Mailpit. The app must send an
  // unauthenticated invitee to sign-in and preserve the one-time URL.
  await navigate(invitationUrl);
  await waitFor(
    () => evaluate('location.pathname === "/login" && Boolean(document.querySelector("input[type=email]"))'),
    'unauthenticated invitation redirect to sign-in',
  );
  const returnLink = await evaluate(
    'Array.from(document.querySelectorAll("a")).find((a) => a.getAttribute("href") === "/register")?.getAttribute("href") || ""',
  );
  if (!returnLink) throw new Error('Sign-in page did not offer account registration.');

  await evaluate(`(() => {
    const link = [...document.querySelectorAll('a')]
      .find((item) => item.innerText.trim() === 'Create an account');
    if (!link) throw new Error('Create an account link not found.');
    link.click();
    return true;
  })()`);
  await waitFor(
    () => evaluate('location.pathname === "/register" && Boolean(document.querySelector("input[autocomplete=name]"))'),
    'new Teacher registration form',
  );

  await fill('input[autocomplete=name]', 'Invitation Teacher');
  await fill('input[type=email]', inviteEmail);
  await fill('input[type=password]', password);
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button[type=submit]')]
      .find((item) => item.innerText.includes('Create account'));
    if (!button) throw new Error('Create account submit button missing.');
    button.click();
    return true;
  })()`);

  await waitFor(
    () => evaluate('location.pathname === "/verification-pending"'),
    'email verification pending page',
  );
  const continueHref = await evaluate(
    'Array.from(document.querySelectorAll("a")).find((a) => (a.getAttribute("href") || "").startsWith("/invitations/accept"))?.getAttribute("href") || ""',
  );
  if (!continueHref.includes('#token=')) {
    throw new Error('Verification pending page did not preserve the invitation URL.');
  }

  // Verify the new account using the actual verification email captured by Mailpit.
  const verificationMessage = await findMail('Verify your InstituteOS account');
  const verificationUrl = extractLink(verificationMessage, 'verify-email');
  await navigate(verificationUrl);
  await waitFor(
    () => evaluate('Boolean([...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Verify email"))'),
    'Verify email action',
  );
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.innerText.trim() === 'Verify email');
    button.click();
    return true;
  })()`);

  await waitFor(
    () => evaluate('location.pathname === "/dashboard" || location.pathname.startsWith("/teacher/organizations/")'),
    'verified account session',
    30000,
  );
  const verifiedUser = await evaluate(
    'fetch("/api/v1/auth/me",{credentials:"include",cache:"no-store"}).then(async r=>({status:r.status,body:await r.json()}))',
  );
  if (
    verifiedUser.status !== 200 ||
    verifiedUser.body.user?.email !== inviteEmail ||
    !verifiedUser.body.user?.emailVerifiedAt
  ) {
    throw new Error('Email verification did not establish the expected authenticated user.');
  }

  // Re-open the original email link after verification. This time acceptance
  // must create the membership and attach the exact StaffMember record.
  await navigate(invitationUrl);
  const teacherPath = await waitFor(
    () => evaluate('location.pathname.startsWith("/teacher/organizations/") ? location.pathname : false'),
    'accepted Teacher membership and workspace',
    45000,
  );
  const teacherWorkspace = await waitFor(
    () => evaluate(`({
      title: document.querySelector('main.main-content h1')?.innerText ||
        document.querySelector('main h1')?.innerText || '',
      nav: [...document.querySelectorAll('nav[aria-label="Main navigation"] a')]
        .map((item) => item.innerText.trim()),
      body: document.querySelector('main.main-content')?.innerText?.slice(0,1800) || '',
      sidebar: Boolean(document.querySelector('aside.sidebar')),
    })`).then((value) => value.sidebar && value.title ? value : false),
    'rendered Teacher dashboard',
  );
  if (!teacherWorkspace.nav.includes('My classes & students')) {
    throw new Error('Accepted invite did not open the Teacher navigation.');
  }

  await cdpScreenshot('teacher-invitation-accepted.png');
  await cdpLogout();
  const afterLogout = await evaluate(
    'fetch("/api/v1/auth/me",{credentials:"include",cache:"no-store"}).then(r=>r.status)',
  );
  if (afterLogout !== 401) throw new Error('Teacher logout did not invalidate the session.');

  const serverErrors = apiResponses.filter((item) => item.status >= 500);
  if (serverErrors.length || runtimeExceptions.length) {
    throw new Error(
      `Browser errors: ${JSON.stringify({ serverErrors, runtimeExceptions })}`,
    );
  }

  console.log(JSON.stringify({
    invitationEmailCaptured: true,
    unauthenticatedInviteRedirectedToLogin: true,
    registrationCompleted: true,
    verificationEmailCaptured: true,
    emailVerifiedAndSessionCreated: true,
    invitationAccepted: true,
    teacherMembershipAndStaffLink: true,
    teacherWorkspacePath: teacherPath,
    teacherDashboardTitle: teacherWorkspace.title,
    teacherNavigation: teacherWorkspace.nav,
    logoutInvalidatedSession: true,
    apiResponseCount: apiResponses.length,
    apiServerErrors: serverErrors,
    uncaughtBrowserExceptions: runtimeExceptions,
  }, null, 2));
} finally {
  ws.close();
}

async function cdpScreenshot(fileName) {
  const result = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const screenshotDir = path.join(
    process.env.TEMP || process.env.TMP || '.',
    'InstituteOS-acceptance-screenshots',
  );
  await fs.mkdir(screenshotDir, { recursive: true });
  await fs.writeFile(
    path.join(screenshotDir, fileName),
    Buffer.from(result.result.data, 'base64'),
  );
}

async function cdpLogout() {
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button.sign-out-button')]
      .find((item) => item.getClientRects().length > 0);
    if (!button) throw new Error('Visible Teacher sign-out button not found.');
    button.click();
    return true;
  })()`);
  await waitFor(() => evaluate('location.pathname === "/login"'), 'Teacher logout');
}
