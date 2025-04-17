'use strict'

const http = require('node:http')
const assert = require('node:assert')
const os = require('node:os')
const path = require('node:path')
const { Writable } = require('node:stream')
const { isMainThread } = require('node:worker_threads')

const { Pool, Client, fetch, Agent, setGlobalDispatcher } = require('..')

const genericWasm = require('../lib/llhttp/llhttp-wasm.js');
const simdWasm = require('../lib/llhttp/llhttp_simd-wasm.js');
const constants = require('../lib/llhttp/constants.js');

const iterations = (parseInt(process.env.SAMPLES, 10) || 100000) + 1
const errorThreshold = parseInt(process.env.ERROR_THRESHOLD, 10) || 1

const RESPONSE = Buffer.from([
  'HTTP/1.1 200 OK',
  'Date: Thu, 17 Apr 2025 17:01:42 GMT',
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

const imports = {
  env: {
    wasm_on_url: () => { },
    wasm_on_status: () => { },
    wasm_on_message_begin: () => { },
    wasm_on_header_field: () => { },
    wasm_on_header_value: () => { },
    wasm_on_headers_complete: () => { },
    wasm_on_body: () => { },
    wasm_on_message_complete: () => {
    }
  }
};

async function createExperiment(wasm) {
  const { exports: llhttp } = await WebAssembly.instantiate(
    await WebAssembly.compile(genericWasm),
    imports,
  );

  const responsePtr = llhttp.malloc(RESPONSE.byteLength);
  new Uint8Array(llhttp.memory.buffer, responsePtr, RESPONSE.byteLength)
    .set(RESPONSE);

  const instance = llhttp.llhttp_alloc(constants.TYPE.RESPONSE);

  return async () => {
    const ret = llhttp.llhttp_execute(
      instance,
      responsePtr,
      RESPONSE.byteLength,
    );
    assert(ret === 0);
  };
}

async function main () {
  const { cronometro } = await import('cronometro')

  const experiments = {
    'wasm - no simd': await createExperiment(genericWasm),
    'wasm - simd': await createExperiment(simdWasm),
  };

  cronometro(
    experiments,
    {
      iterations,
      errorThreshold,
      print: true
    }
  )
}

if (isMainThread) {
  main()
} else {
  module.exports = main
}
