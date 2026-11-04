import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = 'http://127.0.0.1:5173';
const debugUrl = 'http://127.0.0.1:9222';
const passwordFile = path.join(
  process.env.LOCALAPPDATA || process.env.TEMP || '.',
  'InstituteOS-Local-QA',
  'password.txt',
);
const password =
  process.env.DEV_TEST_PASSWORD || (await fs.readFile(passwordFile, 'utf8')).trim();
if (!password || password.length < 12) {
  throw new Error('The local QA password is missing or invalid.');
}

const accounts = [
  {
    role: 'admin',
    email: 'admin@instituteos.test',
    expectedPath: '/admin/organizations/',
    requiredNavigation: [
      'Students',
      'Academics & Classes',
      'Guardians',
      'Teachers / Staff',
      'Attendance',
      'Finance',
      'Settings',
    ],
  },
  {
    role: 'teacher',
    email: 'teacher@instituteos.test',
    expectedPath: '/teacher/organizations/',
    requiredNavigation: [
      'My classes & students',
      'Attendance',
      'Homework & Tests',
      'Examinations & Marks',
      'Messages',
    ],
  },
  {
    role: 'parent',
    email: 'parent@instituteos.test',
    expectedPath: '/parent/organizations/',
    requiredNavigation: [
      'Attendance',
      'Fees & receipts',
      'Results',
      'Messages',
    ],
  },
];

const targets = await fetch(`${debugUrl}/json`).then((response) => {
  if (!response.ok) throw new Error('Chrome DevTools endpoint is unavailable.');
  return response.json();
});
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('No Chrome page target found.');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const runtimeExceptions = [];
const apiResponses = [];
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    runtimeExceptions.push(
      message.params.exceptionDetails?.text ?? 'Uncaught browser exception',
    );
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

function cdp(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Chrome DevTools timed out: ${method}`));
      }
    }, 20000);
    const original = pending.get(id);
    pending.set(id, (message) => {
      clearTimeout(timer);
      original(message);
    });
  });
}

async function evaluate(expression) {
  const response = await cdp('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (response.result.exceptionDetails) {
    throw new Error(
      response.result.exceptionDetails.exception?.description ??
        response.result.exceptionDetails.text ??
        'Browser JavaScript evaluation failed.',
    );
  }
  return response.result.result.value;
}

async function waitFor(predicate, label, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const state = await evaluate(
    '({url:location.href,text:document.body?.innerText?.slice(0,1600)})',
  );
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(state)}`);
}

async function navigate(url) {
  await cdp('Page.navigate', { url });
  await waitFor(
    () => evaluate('document.readyState === "complete"'),
    'document load',
    20000,
  );
}

async function ensureAnonymous() {
  await navigate(`${baseUrl}/login`);
  // Keep the dedicated QA browser's sidebar expanded so its visible labels
  // can be asserted consistently at the desktop test viewport.
  await evaluate('localStorage.setItem("instituteos-sidebar-collapsed", "false")');
  const currentStatus = await evaluate(
    'fetch("/api/v1/auth/me",{credentials:"include",cache:"no-store"}).then(r=>r.status)',
  );
  if (currentStatus === 200) {
    const logoutStatus = await evaluate(`(() => {
      const csrf = document.cookie.split('; ')
        .find((cookie) => cookie.startsWith('instituteos_csrf='))
        ?.slice('instituteos_csrf='.length);
      if (!csrf) throw new Error('CSRF cookie missing during test cleanup.');
      return fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': decodeURIComponent(csrf) },
      }).then((response) => response.status);
    })()`);
    if (logoutStatus !== 204) {
      throw new Error(`Could not clear the previous test session: ${logoutStatus}`);
    }
  }
  const finalStatus = await evaluate(
    'fetch("/api/v1/auth/me",{credentials:"include",cache:"no-store"}).then(r=>r.status)',
  );
  if (finalStatus !== 401) {
    throw new Error(`Browser did not reach an anonymous state: ${finalStatus}`);
  }
}

async function login(account) {
  await ensureAnonymous();
  await navigate(`${baseUrl}/${account.role}/login`);
  await waitFor(
    () => evaluate(
      'Boolean(document.querySelector("input[type=email]") && document.querySelector("input[type=password]"))',
    ),
    `${account.role} login form`,
  );

  await evaluate(`(() => {
    const set = (selector, value) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error('Missing form field: ' + selector);
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      ).set;
      setter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('input[type=email]', ${JSON.stringify(account.email)});
    set('input[type=password]', ${JSON.stringify(password)});
    const submit = [...document.querySelectorAll('button[type=submit]')]
      .find((button) => button.innerText.trim() === 'Sign in');
    if (!submit) throw new Error('Sign in button not found.');
    submit.click();
    return true;
  })()`);

  const state = await waitFor(async () => {
    const current = await evaluate(
      '({path:location.pathname,body:document.body.innerText,alert:document.querySelector("[role=alert]")?.innerText||""})',
    );
    if (current.path.startsWith(account.expectedPath)) return current;
    if (current.alert) {
      throw new Error(`${account.role} login failed: ${current.alert}`);
    }
    return false;
  }, `${account.role} authenticated workspace`, 40000);

  const workspace = await waitFor(async () => {
    const current = await evaluate(`({
      path: location.pathname,
      title: document.querySelector('main.main-content h1')?.innerText ||
        document.querySelector('main h1')?.innerText || '',
      navigation: [...document.querySelectorAll('nav[aria-label="Main navigation"] a')]
        .map((item) => item.innerText.trim()),
      user: document.querySelector('.topbar-user-name')?.innerText ||
        document.querySelector('.current-user-name')?.innerText || '',
      body: document.querySelector('main.main-content')?.innerText?.slice(0, 2200) || '',
      sidebar: Boolean(document.querySelector('aside.sidebar')),
      loading: document.body.innerText.includes('Verifying your institute workspace access'),
    })`);
    return current.sidebar && !current.loading ? current : false;
  }, `${account.role} workspace layout`, 30000);

  if (account.role === 'teacher') {
    const teacherProfile = await waitFor(
      () => evaluate(`fetch('/api/v1/organizations/' + encodeURIComponent(location.pathname.split('/')[3]) + '/attendance/teacher-profile', { credentials: 'include', cache: 'no-store' }).then(r => r.ok ? r.json() : null)`),
      'Teacher profile API response',
      30000,
    );
    const expectedTeacherName = teacherProfile?.profile?.displayName;
    if (!expectedTeacherName) throw new Error('Teacher account has no linked active staff profile.');
    await waitFor(
      () => evaluate(`document.querySelector('main.main-content')?.innerText.includes(${JSON.stringify(expectedTeacherName)}) || document.querySelector('main')?.innerText.includes(${JSON.stringify(expectedTeacherName)})`),
      'updated Staff profile name in Teacher dashboard',
      30000,
    );
    workspace.user = await evaluate(
      'document.querySelector(".topbar-user-name")?.innerText || document.querySelector(".current-user-name")?.innerText || ""',
    );
    if (workspace.user !== expectedTeacherName) {
      throw new Error(`Teacher topbar name mismatch: expected ${expectedTeacherName}, received ${workspace.user}.`);
    }
    const teacherAssignments = await waitFor(
      () => evaluate(`fetch('/api/v1/organizations/' + encodeURIComponent(location.pathname.split('/')[3]) + '/attendance/teacher-assignments', { credentials: 'include', cache: 'no-store' }).then(async r => { const data = r.ok ? await r.json() : null; return data?.items?.length ? data : false; })`),
      'Teacher class/subject assignments API response',
      30000,
    );
    const assignedSections = teacherAssignments?.items ?? [];
    if (!assignedSections.length) throw new Error('Teacher has no active class/subject assignments.');
    await waitFor(
      () => evaluate(`(() => {
        const body = document.querySelector('main.main-content')?.innerText || document.querySelector('main')?.innerText || '';
        return ${JSON.stringify(assignedSections)}.every((item) => body.includes(item.className) && body.includes(item.sectionName) && (!item.subjectName || body.includes(item.subjectName)));
      })()`),
      'assigned Teacher classes, sections and subjects in dashboard',
      30000,
    );
    workspace.body = await evaluate(
      'document.querySelector("main.main-content")?.innerText?.slice(0,2200) || ""',
    );
  }

  if (account.role === 'parent') {
    const portalData = await waitFor(
      () => evaluate(`fetch('/api/v1/organizations/' + encodeURIComponent(location.pathname.split('/')[3]) + '/portal/me', { credentials: 'include', cache: 'no-store' }).then(r => r.ok ? r.json() : null)`),
      'Parent linked-family API response',
      30000,
    );
    const expectedParentName = portalData?.guardian?.displayName;
    const linkedChildren = portalData?.students ?? [];
    if (!expectedParentName || linkedChildren.length === 0) {
      throw new Error('Parent guardian profile or linked children are missing in the database response.');
    }
    await waitFor(
      () => evaluate(`(() => {
        const body = document.querySelector('main.main-content')?.innerText || document.querySelector('main')?.innerText || '';
        const linkedList = document.querySelector('section[aria-label="All linked children"]');
        return body.includes(${JSON.stringify(expectedParentName)}) &&
          Boolean(document.querySelector('.parent-student-card')) &&
          Boolean(linkedList) &&
          ${linkedChildren.length} <= linkedList.querySelectorAll('button').length &&
          ${JSON.stringify(linkedChildren.map((student) => student.displayName))}.every((name) => body.includes(name));
      })()`),
      'updated Guardian name and every linked child in Parent dashboard',
      30000,
    );
    workspace.user = await evaluate(
      'document.querySelector(".topbar-user-name")?.innerText || document.querySelector(".current-user-name")?.innerText || ""',
    );
    if (workspace.user !== expectedParentName) {
      throw new Error(`Parent topbar name mismatch: expected ${expectedParentName}, received ${workspace.user}.`);
    }
    workspace.title = await evaluate(
      'document.querySelector("main.main-content h1")?.innerText || document.querySelector("main h1")?.innerText || ""',
    );
    workspace.body = await evaluate(
      'document.querySelector("main.main-content")?.innerText?.slice(0,2200) || ""',
    );
    if (!workspace.title) throw new Error('Parent portal did not render its page heading.');
  }
  const missing = account.requiredNavigation.filter(
    (label) => !workspace.navigation.includes(label),
  );
  if (missing.length) {
    throw new Error(
      `${account.role} workspace missing navigation: ${missing.join(', ')}`,
    );
  }

  const orgId = state.path.split('/')[3];
  if (!orgId) throw new Error(`${account.role} organization ID missing in route.`);

  const screenshot = await cdp('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const screenshotDir = path.join(
    process.env.TEMP || process.env.TMP || '.',
    'InstituteOS-acceptance-screenshots',
  );
  await fs.mkdir(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, `${account.role}.png`);
  await fs.writeFile(
    screenshotPath,
    Buffer.from(screenshot.result.data, 'base64'),
  );

  // A hard refresh must restore the same cookie-backed account and workspace.
  await cdp('Page.reload', { ignoreCache: true });
  await waitFor(
    () => evaluate(`location.pathname.startsWith(${JSON.stringify(account.expectedPath)})`),
    `${account.role} session after refresh`,
    30000,
  );

  const afterRefresh = await evaluate(`({
    path: location.pathname,
    user: document.querySelector('.topbar-user-name')?.innerText ||
      document.querySelector('.current-user-name')?.innerText || '',
    sidebar: Boolean(document.querySelector('aside.sidebar')),
  })`);
  if (!afterRefresh.sidebar) {
    await waitFor(
      () => evaluate('Boolean(document.querySelector("aside.sidebar"))'),
      `${account.role} sidebar after refresh`,
    );
  }

  // Role guard: directly requesting the Admin workspace must resolve back to
  // this account's own role workspace, never expose the Admin interface.
  const protectedAttempt =
    account.role === 'admin'
      ? `${baseUrl}/teacher/organizations/${orgId}`
      : `${baseUrl}/admin/organizations/${orgId}`;
  const expectedGuardPath =
    account.role === 'admin'
      ? '/admin/organizations/'
      : account.expectedPath;
  await navigate(protectedAttempt);
  await waitFor(
    () => evaluate(`location.pathname.startsWith(${JSON.stringify(expectedGuardPath)})`),
    `${account.role} role guard`,
    30000,
  );
  const guarded = await evaluate('({path:location.pathname})');
  if (account.role !== 'admin' && guarded.path.startsWith('/admin/organizations/')) {
    throw new Error(`${account.role} was not blocked from the Admin workspace.`);
  }
  if (account.role === 'admin' && guarded.path.startsWith('/teacher/organizations/')) {
    throw new Error('Admin was incorrectly redirected into the Teacher workspace.');
  }

  // Return to this account's own route and sign out using the actual UI button.
  await navigate(`${baseUrl}${account.expectedPath}${orgId}`);
  await waitFor(
    () => evaluate('Boolean(document.querySelector("button.sign-out-button"))'),
    `${account.role} sign-out control`,
  );
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button.sign-out-button')]
      .find((item) => item.getClientRects().length > 0);
    if (!button) throw new Error('Visible sign-out button not found.');
    button.click();
    return true;
  })()`);
  await waitFor(
    () => evaluate('location.pathname === "/login"'),
    `${account.role} logout redirect`,
    20000,
  );
  const logoutStatus = await evaluate(
    'fetch("/api/v1/auth/me",{credentials:"include",cache:"no-store"}).then(r=>r.status)',
  );
  if (logoutStatus !== 401) {
    throw new Error(
      `${account.role} logout did not invalidate session; /auth/me returned ${logoutStatus}.`,
    );
  }

  return {
    role: account.role,
    email: account.email,
    workspacePath: workspace.path,
    pageTitle: workspace.title,
    sidebar: workspace.navigation,
    signedInAs: workspace.user,
    refreshRestoredSession: true,
    roleGuardPassed: true,
    logoutInvalidatedSession: true,
    screenshotPath,
    organizationId: orgId,
  };
}

try {
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Network.enable');
  const selectedAccounts = process.env.ONLY_ROLE
    ? accounts.filter((account) => account.role === process.env.ONLY_ROLE)
    : accounts;
  if (!selectedAccounts.length) throw new Error('ONLY_ROLE did not match a known role.');
  const results = [];
  for (const account of selectedAccounts) {
    results.push(await login(account));
  }

  const failedApiResponses = apiResponses.filter(
    (item) => item.status >= 500,
  );
  const report = {
    browser: 'Chrome via local DevTools Protocol',
    origin: baseUrl,
    results,
    apiResponseCount: apiResponses.length,
    apiServerErrors: failedApiResponses,
    uncaughtBrowserExceptions: runtimeExceptions,
  };
  console.log(JSON.stringify(report, null, 2));

  if (failedApiResponses.length || runtimeExceptions.length) {
    process.exitCode = 1;
  }
} finally {
  ws.close();
}
