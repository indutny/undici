import assert from 'node:assert';

import wasm from './main-wasm.js';
import constants from './lib/llhttp/constants.js';
import { FRAGMENT } from './common.mjs';

export const name = 'main';

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

export default function () {
  const r = llhttp.llhttp_execute(instance, fragmentPtr, FRAGMENT.byteLength);
  assert(r === 0);
  return r;
}
