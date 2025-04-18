import assert from 'node:assert';

import plain from './lib/llhttp/llhttp-wasm.js';
import simd from './lib/llhttp/llhttp_simd-wasm.js';
import constants from './lib/llhttp/constants.js';

const WARM_UP = 1000;
const COUNT = 1e6;

const FRAGMENT = Buffer.from([
  'HTTP/1.1 200 OK',
  'Date: Thu, 17 Apr 2025 17:01:42 GMTaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'Content-Type: text/html; charset=utf-8',
  'Transfer-Encoding: chunked',
  'Connection: keep-alive',
  'Age: 199',
  'Cache-Control: public, max-age=0, must-revalidate',
  'strict-transport-security: max-age=31536000; includeSubDomains; preload',
  'x-matched-path: /[locale]',
  'x-nextjs-prerender: 1',
  'x-nextjs-stale-time: 4294967294',
  'x-powered-by: Next.js',
  'x-vercel-cache: HIT',
  'x-vercel-id: sfo1::lhr1::mqksv-1744909302718-4862dd69bea3',
  'cf-cache-status: DYNAMIC',
  'vary: accept-encoding',
  'X-Content-Type-Options: nosniff',
  'Server: cloudflare',
  'CF-RAY: 931d7c65ecfde9e4-LAX',
  '',
  '0',
  '',
  '',
].join('\r\n'));
console.error(FRAGMENT.length);

const results = {};

for (const [label, wasm] of [['plain', plain], ['simd', simd]]) {
  const mod = await WebAssembly.compile(wasm)
  const { exports: llhttp } = await WebAssembly.instantiate(mod, {
    env: {
      wasm_on_debug: (label, x) => {
 //       console.log(Buffer.from(llhttp.memory.buffer).slice(label, label + 10).toString(), x, x.toString(2));
      },
      wasm_on_url: () => { },
      wasm_on_status: () => { },
      wasm_on_message_begin: () => { },
      wasm_on_header_field: () => { },
      wasm_on_header_value: (p, at, len) => {
//        console.log('header value', at & 0xf, len, Buffer.from(llhttp.memory.buffer).slice(at, at + len).toString());
      },
      wasm_on_headers_complete: () => { },
      wasm_on_body: () => { },
      wasm_on_message_complete: () => { }
    }
  })

  const fragmentPtr = llhttp.malloc(FRAGMENT.byteLength);
  new Uint8Array(llhttp.memory.buffer, fragmentPtr, FRAGMENT.byteLength).set(FRAGMENT)

  const instance = llhttp.llhttp_alloc(constants.TYPE.RESPONSE)

  for (let i = 0; i < WARM_UP; i++) {
    const r = llhttp.llhttp_execute(instance, fragmentPtr, FRAGMENT.byteLength);
    assert(r === 0);
  }

  const start = process.hrtime.bigint();
  for (let i = 0; i < COUNT; i++) {
    const r = llhttp.llhttp_execute(instance, fragmentPtr, FRAGMENT.byteLength);
    assert(r === 0);
  }
  const duration = process.hrtime.bigint() - start;
  const bps = FRAGMENT.byteLength * COUNT / Number(duration) * 1e9;
  console.log(label, Math.round(bps / 1024 / 1024), 'mb/sec');

  llhttp.llhttp_free(instance);

  results[label] = bps;
}

console.log(
  'simd/plain ratio',
  (100 * results.simd / results.plain).toFixed(1),
  '%'
);
