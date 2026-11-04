const targets = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
const target = targets.find((item) => item.type === 'page');
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
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  return result.result.result.value;
}
await call('Runtime.enable');
const status = await evaluate('fetch("/api/v1/auth/me",{credentials:"include",cache:"no-store"}).then(async r=>({status:r.status,body:await r.text()}))');
const page = await evaluate('({url:location.href,body:document.body.innerText,buttons:[...document.querySelectorAll("button")].map(b=>b.innerText.trim())})');
console.log(JSON.stringify({status,page}, null, 2));
ws.close();
