import assert from 'node:assert';

import generic from './lib/llhttp/llhttp-wasm.js';
import simd from './lib/llhttp/llhttp_simd-wasm.js';
import constants from './lib/llhttp/constants.js';

const WARM_UP = 1e3;
const COUNT = 1e6;

const FRAGMENT = Buffer.from([
  'HTTP/1.1 200 OK',
  `Date: Thu, 17 Apr 2025 17:01:42${'a'.repeat(1 * 1024)}`,
  'Content-Length: 0',
  '',
  '',
].join('\r\n'));

const results = {};

for (const [label, wasm] of [['generic', generic], ['simd', simd]]) {
  const mod = await WebAssembly.compile(wasm)
  const { exports: llhttp } = await WebAssembly.instantiate(mod, {
    env: {
      wasm_on_url: () => { },
      wasm_on_status: () => { },
      wasm_on_message_begin: () => { },
      wasm_on_header_field: () => { },
      wasm_on_header_value: (p, at, len) => {
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
  'simd/generic ratio',
  (100 * results.simd / results.generic).toFixed(1),
  '%'
);
