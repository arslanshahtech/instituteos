const targets = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('No Chrome page target found.');
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
function cdp(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('CDP timeout: ' + method));
      }
    }, 10000);
  });
}
const result = await cdp('Runtime.evaluate', {
  expression: '(async()=>{const orgId=location.pathname.split("/")[3];const urls=["/api/v1/ready","/api/v1/auth/me",`/api/v1/organizations/${orgId}/attendance/teacher-profile`,`/api/v1/organizations/${orgId}/attendance/teacher-assignments`,`/api/v1/organizations/${orgId}/context`];const results=[];for(const url of urls){try{const r=await fetch(url,{credentials:"include",cache:"no-store"});results.push({url,status:r.status,body:(await r.text()).slice(0,2000)});}catch(e){results.push({url,error:String(e)});}}return {page:location.href,cookies:document.cookie.split(";").map(x=>x.trim().split("=")[0]),results};})()',
  awaitPromise: true,
  returnByValue: true,
});
console.log(JSON.stringify(result.result.result.value, null, 2));
ws.close();
