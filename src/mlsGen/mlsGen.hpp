#ifndef SPEAKER_CALIBRATION_SRC_MLSGEN_MLSGEN_HPP_
#define SPEAKER_CALIBRATION_SRC_MLSGEN_MLSGEN_HPP_

// setup emscripten for vscode intelli sense:
// https://gist.github.com/wayou/59f3a8e4fbab050fbb32e94dd9582660'
#include <emscripten/bind.h>
#include <emscripten/val.h>

/**
 * @brief Exposes methods for generating an MLS signal, and calculating the
 * impulse response of a recording. This class is compiled to webassembly using
 * emscripten, embind, and val.
 *
 */
class MLSGen {
 private:
  // MLS parameters
  long N;
  long P;
  long srcSR;
  long sinkSR;

  // MLS data
  bool *mls;
  long *tagL;
  long *tagS;
  float *generatedSignal;  // MLS signal at +- 1

  // IR data
  float *recordedSignal;
  float *perm;
  float *resp;

  // Internals
  void generateMls();
  void fastHadamard();
  void permuteSignal();
  void permuteResponse();
  void generateTagL();
  void generateTagS();

 public:
  /**
   * @brief Construct a new MLSGen object with the given number of bits.
   * 
   * @param N 
   */
  MLSGen(long N, long srcSR, long sinkSR);
  
  /**
   * @brief Destroy the MLSGen object
   * 
   */
  void Destruct();

  /**
   * @brief Generates an MLS signal according to the parameters set in the
   * constructor. Returns a memory view of the MLS signal.
   *
   * @return emscripten::val
   */
  emscripten::val getMLS();

  /**
   * @brief Get the Recorded Signal Memory View object. This memory view can then be set in the javascript code. 
   * 
   * @return emscripten::val 
   */
  emscripten::val getRecordedSignalMemoryView();

  /**
   * @brief Get the Impulse Response. Returns a memory view of the impulse response.
   * 
   * @return emscripten::val 
   */
  emscripten::val getImpulseResponse();
};

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

#endif  // SPEAKER_CALIBRATION_SRC_MLSGEN_MLSGEN_HPP_

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