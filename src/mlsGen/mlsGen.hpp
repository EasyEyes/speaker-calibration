#ifndef SPEAKER_CALIBRATION_SRC_MLSGEN_MLSGEN_HPP_
#define SPEAKER_CALIBRATION_SRC_MLSGEN_MLSGEN_HPP_

// setup emscripten for vscode intelli sense:
// https://gist.github.com/wayou/59f3a8e4fbab050fbb32e94dd9582660'
#include <emscripten/bind.h>
#include <emscripten/val.h>

class MLSGen {
 private:
  // MLS parameters
  long N;
  long P;

  // MLS data
  bool *mls;
  long *tagL;
  long *tagS;
  float *generatedSignal;  // MLS signal at +- 1

  // IR data
  float *recordedSignal;
  float *perm;
  float *resp;

 public:
  // Constructor
  MLSGen(long N = 18);
  // Destructor
  ~MLSGen();

  // Internals
  void generateMls();
  void fastHadamard();
  void permuteSignal();
  void permuteResponse();
  void generateTagL();
  void generateTagS();

  // Externals
  emscripten::val getGeneratedSignal();
  emscripten::val getImpulseResponse();
};

#endif // SPEAKER_CALIBRATION_SRC_MLSGEN_MLSGEN_HPP_

// EMSCRIPTEN_KEEPALIVE
// void test()
// {
//     const long N = 18;
//     const long P = (1 << N) - 1;
//     long i;
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
//     // Do a Hadamard transform in place permuteResponse(perm, resp, tagL, P);
//     // Permute the impulseresponse according to tagL
//     // printf("Impulse response:\n");
//     // for (i = 0; i < 10; i++)
//     //     printf("%10.5f\n", resp[i]);
//     delete[] mls;
//     delete[] tagL;
//     delete[] tagS;
//     delete[] signal;
//     delete[] perm;
//     delete[] resp;
// }