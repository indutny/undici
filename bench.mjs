import generic from './lib/llhttp/llhttp-wasm.js';
import simd from './lib/llhttp/llhttp_simd-wasm.js';
import constants from './lib/llhttp/constants.js';

function request(tpl) {
  return tpl.raw[0].replace(/^\s+/gm, '').replace(/\n/gm, '').replace(/\\r/gm, '\r').replace(/\\n/gm, '\n')
}

const WARM_UP = 100000;
const COUNT = 4e6;

const SIMD = Buffer.from(request`
  POST /joyent/http-parser HTTP/1.1\r\n
  Hostaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\r\n
  Content-Length: 2\r\n\r\n
  ab
`);

const FRAGMENT = Buffer.from(request`
  HTTP/1.1 307 Temporary Redirect\r\n
  Date: Thu, 17 Apr 2025 15:57:54 GMT\r\n
  Content-Type: text/plain\r\n
  Connection: keep-alive\r\n
  Cache-Control: public, max-age=0, must-revalidate\r\n
  location: /en\r\n
  Set-Cookie: NEXT_LOCALE=en; Path=/; SameSite=lax\r\n
  strict-transport-security: max-age=31536000; includeSubDomains; preload\r\n
  x-vercel-id: sfo1::t598k-1744905474015-0c52177ab740\r\n
  cf-cache-status: DYNAMIC\r\n
  X-Content-Type-Options: nosniff\r\n
  Server: cloudflare\r\n
  CF-RAY: 931d1eec6a20db5e-LAX\r\n\r\n
`);

const results = {};

for (const [label, wasm] of [['generic', generic], ['simd', simd]]) {
  const mod = await WebAssembly.compile(wasm)
  const { exports: llhttp } = await WebAssembly.instantiate(mod, {
    env: {
      wasm_on_debug: (at, len) => {
        console.log('align', at & 0xf);
        console.log('len', len);
        console.log('str', JSON.stringify(Buffer.from(llhttp.memory.buffer).subarray(at, at + len).toString()));
      },
      wasm_on_url: () => { },
      wasm_on_status: () => { },
      wasm_on_message_begin: () => { },
      wasm_on_header_field: (p, at, len) => {
      },
      wasm_on_header_value: () => { },
      wasm_on_headers_complete: () => { },
      wasm_on_body: () => { },
      wasm_on_message_complete: () => { }
    }
  })

  const simdPtr = llhttp.malloc(SIMD.byteLength);
  new Uint8Array(llhttp.memory.buffer, simdPtr, SIMD.byteLength).set(SIMD)

  const fragmentPtr = llhttp.malloc(FRAGMENT.byteLength);
  new Uint8Array(llhttp.memory.buffer, fragmentPtr, FRAGMENT.byteLength).set(FRAGMENT)

  for (let i = 0; i < WARM_UP; i++) {
    const instance = llhttp.llhttp_alloc(constants.TYPE.RESPONSE)
    llhttp.llhttp_execute(instance, fragmentPtr, FRAGMENT.byteLength);
    llhttp.llhttp_free(instance);
  }

  const start = process.hrtime.bigint();
  for (let i = 0; i < COUNT; i++) {
    const instance = llhttp.llhttp_alloc(constants.TYPE.RESPONSE)
    llhttp.llhttp_execute(instance, fragmentPtr, FRAGMENT.byteLength);
    llhttp.llhttp_free(instance);
  }
  const duration = process.hrtime.bigint() - start;
  const rps = COUNT / Number(duration) * 1e9;
  console.log(label, rps);

  results[label] = rps;
}

console.log('Ratio', results.simd / results.generic);
