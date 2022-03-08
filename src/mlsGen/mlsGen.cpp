#include "mlsGen.hpp"

using namespace emscripten;

#ifdef __cplusplus
extern "C" {
#endif

MLSGen::MLSGen(long N) {
  MLSGen::N = N;
  P = (1 << N) - 1;
  mls = new bool[P];
  tagL = new long[P];
  tagS = new long[P];
  generatedSignal = new float[P];
  recordedSignal = new float[P];
  perm = new float[P + 1];
  resp = new float[P + 1];
}

MLSGen::~MLSGen() {
  delete[] mls;
  delete[] tagL;
  delete[] tagS;
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
  return emscripten::val(typed_memory_view(
      *(&generatedSignal + 1) - generatedSignal, generatedSignal));
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

  // return emscripten::val(typed_memory_view(*(&resp + 1) - resp, resp));

  // test return value
  return emscripten::val(typed_memory_view(*(&recordedSignal + 1) - recordedSignal, recordedSignal));
}

// Binding code
EMSCRIPTEN_BINDINGS(mls_gen_module) {
  class_<MLSGen>("MLSGen")
      .constructor<long>()
      .function("getMLS", &MLSGen::getMLS)
      .function("getRecordedSignalMemoryView",
                &MLSGen::getRecordedSignalMemoryView)
      .function("getImpulseResponse", &MLSGen::getImpulseResponse);
};

#ifdef __cplusplus
}
#endif

//     bool *mls = new bool[P];
//     long *tagL = new long[P];
//     long *tagS = new long[P];
//     double *recordedSignal = new double[P];
//     double *perm = new double[P + 1];
//     double *resp = new double[P + 1];
//     generateMls(mls, P, N);               // Generate the Maximum length
//     sequence generateTagL(mls, tagL, P, N);        // Generate tagL for the L
//     matrix generateTagS(mls, tagS, P, N);        // Generate tagS for the S
//     matrix generateSignal(mls, signal, P);       // Do a simulated
//     measurement and get the signal permuteSignal(recordedSignal, perm, tagS,
//     P); // Permute the signal according to tagS fastHadamard(perm, P + 1, N);
//     Do a Hadamard transform in place permuteResponse(perm, resp, tagL, P);
//     Permute the impulseresponse according to tagL
//     // printf("Impulse response:\n");
//     // for (i = 0; i < 10; i++)
//     //     printf("%10.5f\n", resp[i]);