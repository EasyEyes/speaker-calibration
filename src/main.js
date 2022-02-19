import { Listener } from "./listener.js";
import { Speaker } from "./speaker.js";
import { wasmBrowserInstantiate } from './wasm/initiateWasm.js';

wasmBrowserInstantiate('./mlsGen.wasm').then(res => {
    console.log(res);
    console.log()
});

export { Listener, Speaker };
