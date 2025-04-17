import generic from './lib/llhttp/llhttp-wasm.js';
import simd from './lib/llhttp/llhttp_simd-wasm.js';
import constants from './lib/llhttp/constants.js';

function request(tpl) {
  return tpl.raw[0].replace(/^\s+/gm, '').replace(/\n/gm, '').replace(/\\r/gm, '\r').replace(/\\n/gm, '\n')
}

const WARM_UP = 100000;
const COUNT = 4e6;

const FRAGMENT = Buffer.from(request`
  HTTP/1.1 200 OK\r\n
  Date: Thu, 17 Apr 2025 17:01:42 GMT\r\n
  Content-Type: text/html; charset=utf-8\r\n
  Transfer-Encoding: chunked\r\n
  Connection: keep-alive\r\n
  Age: 199\r\n
  Cache-Control: public, max-age=0, must-revalidate\r\n
  strict-transport-security: max-age=31536000; includeSubDomains; preload\r\n
  x-matched-path: /[locale]\r\n
  x-nextjs-prerender: 1\r\n
  x-nextjs-stale-time: 4294967294\r\n
  x-powered-by: Next.js\r\n
  x-vercel-cache: HIT\r\n
  x-vercel-id: sfo1::lhr1::mqksv-1744909302718-4862dd69bea3\r\n
  cf-cache-status: DYNAMIC\r\n
  vary: accept-encoding\r\n
  X-Content-Type-Options: nosniff\r\n
  Server: cloudflare\r\n
  CF-RAY: 931d7c65ecfde9e4-LAX\r\n\r\n
  0\r\n\r\n
`);

const results = {};

for (const [label, wasm] of [['generic', generic], ['simd', simd]]) {
  const mod = await WebAssembly.compile(wasm)
  const { exports: llhttp } = await WebAssembly.instantiate(mod, {
    env: {
      wasm_on_url: () => { },
      wasm_on_status: () => { },
      wasm_on_message_begin: () => { },
      wasm_on_header_field: () => { },
      wasm_on_header_value: () => { },
      wasm_on_headers_complete: () => { },
      wasm_on_body: () => { },
      wasm_on_message_complete: () => { }
    }
  })

  const fragmentPtr = llhttp.malloc(FRAGMENT.byteLength);
  new Uint8Array(llhttp.memory.buffer, fragmentPtr, FRAGMENT.byteLength).set(FRAGMENT)

  const instance = llhttp.llhttp_alloc(constants.TYPE.RESPONSE)

  for (let i = 0; i < WARM_UP; i++) {
    llhttp.llhttp_execute(instance, fragmentPtr, FRAGMENT.byteLength);
  }

  const start = process.hrtime.bigint();
  for (let i = 0; i < COUNT; i++) {
    llhttp.llhttp_execute(instance, fragmentPtr, FRAGMENT.byteLength);
  }
  const duration = process.hrtime.bigint() - start;
  const rps = COUNT / Number(duration) * 1e9;
  console.log(label, rps);

  llhttp.llhttp_free(instance);

  results[label] = rps;
}

console.log('Ratio', results.simd / results.generic);
