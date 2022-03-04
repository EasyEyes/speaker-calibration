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

void MLSGen::generateMls() {
  const long maxNoTaps = 18;
  const bool tapsTab[16][18] = {
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0,
      1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0,
      0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0,
      0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
  bool taps[maxNoTaps];
  long i, j;
  bool *delayLine = new bool[maxNoTaps];
  long sum;
  for (i = 0; i < N; i++)  // copy the N’th taps table
  {
    taps[i] = tapsTab[maxNoTaps - N][i];
    delayLine[i] = 1;
  }
  for (i = 0; i < P; i++)  // Generate an MLS by summing the taps mod 2
  {
    sum = 0;
    for (j = 0; j < N; j++) {
      sum += taps[j] * delayLine[j];
    }
    sum &= 1;  // mod 2
    mls[i] = delayLine[N - 1];
    for (j = N - 2; j >= 0; j--) {
      delayLine[j + 1] = delayLine[j];
    }
    delayLine[0] = *(bool *)&sum;
  }
  delete[] delayLine;
}

void MLSGen::fastHadamard() {
  long i, i1, j, k, k1, k2, P1;
  double temp;
  P1 = P + 1;
  k1 = P1;
  for (k = 0; k < N; k++) {
    k2 = k1 >> 1;
    for (j = 0; j < k2; j++) {
      for (i = j; i < P1; i = i + k1) {
        i1 = i + k2;
        temp = mls[i] + mls[i1];
        mls[i1] = mls[i] - mls[i1];
        mls[i] = temp;
      }
    }
    k1 = k1 >> 1;
  }
}

void MLSGen::permuteSignal() {
  long i;
  double dc = 0;
  for (i = 0; i < P; i++) dc += recordedSignal[i];
  perm[0] = -dc;
  for (i = 0; i < P; i++)  // Just a permutation of the measured signal
    perm[tagS[i]] = recordedSignal[i];
}

void MLSGen::permuteResponse() {
  long i;
  const double fact = 1 / double(P + 1);
  for (i = 0; i < P; i++)  // Just a permutation of the impulse response
  {
    resp[i] = perm[tagL[i]] * fact;
  }
  resp[P] = 0;
}

void MLSGen::generateTagL() {
  long i, j;
  long *colSum = new long[P];
  long *index = new long[N];
  for (i = 0; i < P; i++)  // Run through all the columns in the autocorr matrix
  {
    colSum[i] = 0;
    for (j = 0; j < N; j++)  // Find colSum as the value of the first N elements
                             // regarded as a binary number
    {
      colSum[i] += mls[(P + i - j) % P] << (N - 1 - j);
    }
    for (j = 0; j < N; j++)  // Figure out if colSum is a 2^j number and store
                             // the column as the j’th index
    {
      if (colSum[i] == (1 << j)) index[j] = i;
    }
  }
  for (i = 0; i < P; i++)  // For each row in the L matrix
  {
    tagL[i] = 0;
    for (j = 0; j < N; j++)  // Find the tagL as the value of the rows in the L
                             // matrix regarded as a binary number
    {
      tagL[i] += mls[(P + index[j] - i) % P] * (1 << j);
    }
  }
  delete[] colSum;
  delete[] index;
}

void MLSGen::generateTagS() {
  long i, j;
  for (i = 0; i < P; i++)  // For each column in the S matrix
  {
    tagS[i] = 0;
    for (j = 0; j < N; j++)  // Find the tagS as the value of the columns in the
                             // S matrix regarded as a binary number
    {
      tagS[i] += mls[(P + i - j) % P] * (1 << (N - 1 - j));
    }
  }
}

emscripten::val MLSGen::getGeneratedSignal() {
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

emscripten::val MLSGen::getImpulseResponse() {
  return emscripten::val(typed_memory_view(*(&resp + 1) - resp, resp));
}

// Binding code
EMSCRIPTEN_BINDINGS(mls_gen_module) {
  class_<MLSGen>("MLSGen")
      .constructor<long>()
      .function("generateMls", &MLSGen::generateMls)
      .function("fastHadamard", &MLSGen::fastHadamard)
      .function("permuteSignal", &MLSGen::permuteSignal)
      .function("permuteResponse", &MLSGen::permuteResponse)
      .function("generateTagL", &MLSGen::generateTagL)
      .function("generateTagS", &MLSGen::generateTagS)
      .function("getGeneratedSignal", &MLSGen::getGeneratedSignal);
  // .function("getMls", &MLSGen::getMls, allow_raw_pointers())
  // .function("getResp", &MLSGen::getResp, allow_raw_pointers())
  // .function("setSig", &MLSGen::setSig, allow_raw_pointers());
  // .function("generateSignal", &MLSGen::generateSignal)
};

#ifdef __cplusplus
}
#endif