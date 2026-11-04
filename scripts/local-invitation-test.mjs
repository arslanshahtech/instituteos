import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = 'http://127.0.0.1:5173';
const passwordPath = path.join(
  process.env.LOCALAPPDATA || process.env.TEMP || '.',
  'InstituteOS-Local-QA',
  'password.txt',
);
const password = (await fs.readFile(passwordPath, 'utf8')).trim();
const inviteEmail = 'teacher.onboarding@instituteos.test';

const targets = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('Chrome test page is unavailable.');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});
function call(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('Chrome DevTools timeout: ' + method));
      }
    }, 30000);
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
async function waitFor(predicate, label, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for ' + label);
}
async function navigate(url) {
  await call('Page.navigate', { url });
  await waitFor(
    () => evaluate('document.readyState === "complete"'),
    'page load',
  );
}

try {
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Network.enable');

  await navigate(`${baseUrl}/login`);
  const status = await evaluate(
    'fetch("/api/v1/auth/me",{credentials:"include",cache:"no-store"}).then(r=>r.status)',
  );
  if (status === 200) {
    const logoutStatus = await evaluate(`(() => {
      const csrf = document.cookie.split('; ')
        .find((cookie) => cookie.startsWith('instituteos_csrf='))
        ?.slice('instituteos_csrf='.length);
      if (!csrf) throw new Error('Missing CSRF cookie for test cleanup.');
      return fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': decodeURIComponent(csrf) },
      }).then((r) => r.status);
    })()`);
    if (logoutStatus !== 204)
      throw new Error('Could not clear previous browser session.');
  }

  await navigate(`${baseUrl}/admin/login`);
  await waitFor(
    () =>
      evaluate(
        'Boolean(document.querySelector("input[type=email]") && document.querySelector("input[type=password]"))',
      ),
    'Admin login form',
  );
  await evaluate(`(() => {
    const set = (selector, value) => {
      const element = document.querySelector(selector);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('input[type=email]', 'admin@instituteos.test');
    set('input[type=password]', ${JSON.stringify(password)});
    [...document.querySelectorAll('button[type=submit]')]
      .find((button) => button.innerText.trim() === 'Sign in').click();
    return true;
  })()`);
  const workspace = await waitFor(
    () =>
      evaluate(
        'location.pathname.startsWith("/admin/organizations/") ? location.pathname : false',
      ),
    'Admin workspace',
    40000,
  );
  const organizationId = workspace.split('/')[3];
  if (!organizationId)
    throw new Error('Admin organization ID was not resolved.');

  await navigate(
    `${baseUrl}/admin/organizations/${organizationId}?tab=members`,
  );
  await waitFor(
    () =>
      evaluate(
        'Boolean(document.querySelector("form.member-invite-form input[type=email]"))',
      ),
    'member invitation form',
  );

  await evaluate(`(() => {
    const form = document.querySelector('form.member-invite-form');
    const email = form.querySelector('input[type=email]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(email, ${JSON.stringify(inviteEmail)});
    email.dispatchEvent(new Event('input', { bubbles: true }));
    email.dispatchEvent(new Event('change', { bubbles: true }));
    const role = form.querySelector('select');
    if (role) {
      const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      selectSetter.call(role, 'teacher');
      role.dispatchEvent(new Event('change', { bubbles: true }));
    }
    form.querySelector('button[type=submit]').click();
    return true;
  })()`);

  await waitFor(
    async () => {
      const state = await evaluate(`({
      body: document.body.innerText,
      emailValue: document.querySelector('form.member-invite-form input[type=email]')?.value || '',
      alert: document.querySelector('[role=alert]')?.innerText || '',
    })`);
      if (state.alert)
        throw new Error('Invitation API returned an error: ' + state.alert);
      if (
        state.body.includes('Invitation sent when delivery is available.') ||
        (state.body.includes(inviteEmail) && state.emailValue === '')
      )
        return state;
      return false;
    },
    'successful invitation submission',
    30000,
  );

  await navigate(
    `${baseUrl}/admin/organizations/${organizationId}?tab=invitations`,
  );
  await waitFor(
    () =>
      evaluate(
        `document.body.innerText.includes(${JSON.stringify(inviteEmail)})`,
      ),
    'pending invitation in Admin list',
    30000,
  );

  const screenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const screenshotDir = path.join(
    process.env.TEMP || process.env.TMP || '.',
    'InstituteOS-acceptance-screenshots',
  );
  await fs.mkdir(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, 'admin-invitation.png');
  await fs.writeFile(
    screenshotPath,
    Buffer.from(screenshot.result.data, 'base64'),
  );

  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button.sign-out-button')]
      .find((item) => item.getClientRects().length > 0);
    if (!button) throw new Error('Visible Admin sign-out button not found.');
    button.click();
    return true;
  })()`);
  await waitFor(
    () => evaluate('location.pathname === "/login"'),
    'Admin logout',
  );
  const sessionStatus = await evaluate(
    'fetch("/api/v1/auth/me",{credentials:"include",cache:"no-store"}).then(r=>r.status)',
  );
  if (sessionStatus !== 401)
    throw new Error('Admin logout did not invalidate the session.');

  console.log(
    JSON.stringify(
      {
        adminInvitationSubmitted: true,
        recipient: inviteEmail,
        role: 'teacher',
        pendingInvitationVisible: true,
        adminLogoutInvalidatedSession: true,
        screenshotPath,
        organizationId,
      },
      null,
      2,
    ),
  );
} finally {
  ws.close();
}
