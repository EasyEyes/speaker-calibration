#include "mlsGen.hpp"

#include <sanitizer/lsan_interface.h>

using namespace emscripten;

#ifdef __cplusplus
extern "C" {
#endif

MLSGen::MLSGen(long N, long srcSR, long sinkSR) {
  MLSGen::N = N;
  MLSGen::srcSR = srcSR;
  MLSGen::sinkSR = sinkSR;
  P = (1 << N) - 1;
  mls = new bool[P];
  tagL = new long[P];
  tagS = new long[P];
  generatedSignal = new float[P];
  recordedSignal = new float[P];
  perm = new float[P + 1];
  resp = new float[P + 1];
}

void MLSGen::Destruct() {
  delete[] mls;
  delete[] tagL;
  delete[] tagS;
  delete[] generatedSignal;
  delete[] recordedSignal;
  delete[] perm;
  delete[] resp;
}

emscripten::val MLSGen::getMLS() {
  // if mls is not generated, generate it
  if (*(&mls + 1) - mls != P) {
    generateMls();
  }
  for (int i = 0; i < P; i++) {
    generatedSignal[i] = -2 * mls[i] + 1;
  }
  return emscripten::val(typed_memory_view(P, generatedSignal));
}

emscripten::val MLSGen::getRecordedSignalMemoryView() {
  return emscripten::val(typed_memory_view(P, recordedSignal));
}

emscripten::val MLSGen::getImpulseResponse() {
  generateTagL();     // Generate tagL for the L matrix
  generateTagS();     // Generate tagS for the S matrix
  permuteSignal();    // Permute the signal according to tagS
  fastHadamard();     // Do a Hadamard transform in place
  permuteResponse();  // Permute the impulseresponse according to tagL
  return emscripten::val(typed_memory_view(P + 1, resp));

  // test return value
  // return emscripten::val(typed_memory_view(
  //     *(&recordedSignal + 1) - recordedSignal, recordedSignal));
}

// Binding code
EMSCRIPTEN_BINDINGS(mls_gen_module) {
  class_<MLSGen>("MLSGen")
      .constructor<long, long, long>()
      .function("Destruct", &MLSGen::Destruct)
      .function("getMLS", &MLSGen::getMLS)
      .function("getRecordedSignalMemoryView",
                &MLSGen::getRecordedSignalMemoryView)
      .function("getImpulseResponse", &MLSGen::getImpulseResponse);
  function("doLeakCheck", &__lsan_do_recoverable_leak_check);
};

#ifdef __cplusplus
}
#endif

// https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html
// https://web.dev/webassembly-memory-debugging/