async function wasmBrowserInstantiate(wasmModuleUrl, importObj) {
  let response;
  let importObject = importObj;

  if (!importObject || importObject === undefined) {
    importObject = {
      wasi_snapshot_preview1: {
        proc_exit: () => console.log("exit!"),
      },
    };
  }

  if (WebAssembly.instantiateStreaming) {
    response = await WebAssembly.instantiateStreaming(
      fetch(wasmModuleUrl),
      importObject
    );
  } else {
    const fetchAndInstantiateTask = async () => {
      const wasmArrayBuffer = await fetch(wasmModuleUrl).then((res) =>
        res.arrayBuffer()
      );
      return WebAssembly.instantiate(wasmArrayBuffer, importObject);
    };
    response = await fetchAndInstantiateTask();
  }

  return response;
}

export default wasmBrowserInstantiate;
