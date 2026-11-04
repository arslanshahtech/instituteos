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
  expression: '({url:location.href,title:document.title,viewport:{width:innerWidth,height:innerHeight},body:document.body.innerText,navs:[...document.querySelectorAll("nav")].map(n=>({aria:n.getAttribute("aria-label"),className:n.className,text:n.innerText,links:[...n.querySelectorAll("a")].map(a=>({text:a.innerText,href:a.getAttribute("href")}))})),asides:[...document.querySelectorAll("aside")].map(a=>({className:a.className,text:a.innerText,display:getComputedStyle(a).display,visibility:getComputedStyle(a).visibility})),inputs:[...document.querySelectorAll("input")].map(x=>({type:x.type,name:x.name,placeholder:x.placeholder,autocomplete:x.autocomplete})),buttons:[...document.querySelectorAll("button")].map(x=>x.innerText.trim())})',
  returnByValue: true,
});
console.log(JSON.stringify(result.result.result.value, null, 2));
ws.close();
