#ifndef SPEAKER_CALIBRATION_SRC_TASKS_IMPULSE_RESPOMSE_MLSGEN_MLSGEN_HPP_
#define SPEAKER_CALIBRATION_SRC_TASKS_IMPULSE_RESPOMSE_MLSGEN_MLSGEN_HPP_

// setup emscripten for vscode intelli sense:
// https://gist.github.com/wayou/59f3a8e4fbab050fbb32e94dd9582660'
#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
#include <emscripten/val.h>
#endif

#include "kiss_fft.h"

/**
 * @brief Exposes methods for generating an MLS signal, and calculating the
 * impulse response of a recording. This class is compiled to webassembly using
 * emscripten, embind, and val.
 *
 */
class MLSGen {
 private:
  // MLS parameters
  long N; // mls factor
  long P; // len of mls
  long C; // len of recorded signals

  // Async Clock Adjustment Parameters
  long srcSR;
  long sinkSR;

  // MLS data
  bool *mls;
  long *tagL;
  long *tagS;
  float *generatedSignal;  // MLS signal at +- 1

  // IR data
  float *recordedSignal; // isolated mls signal
  float *recordedSignals; // full capture
  float *perm; // permutation of recorded signals
  float *resp; // impulse response of recorded signals
 

  // Internals
  void GenerateSignal();
  void generateMls();
  void fastHadamard();
  void permuteSignal();
  void permuteResponse();
  void generateTagL();
  void generateTagS();
  void estimateDiff();
  void computeCorrelation();
  void computeFilter();

 public:
  /**
   * @brief Construct a new MLSGen object with the given factor and
   * sampling frequencies.
   *
   * @param N - number of bits
   * @param srcSR - source sampling frequency
   * @param sinkSR - sink sampling frequency
   */
  MLSGen(long N, long srcSR, long sinkSR);

#ifndef __EMSCRIPTEN__
  /**
   * @brief Destruct the MLSGen object.
   * @return void
   */
  ~MLSGen();
#endif

#ifdef __EMSCRIPTEN__
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
   * @brief Get the Recorded Signals Memory View object. This memory view can
   * then be set in the javascript code.
   *
   * @return emscripten::val
   */
  emscripten::val setRecordedSignalsMemoryView(long sizeRecordedSignals);

  emscripten::val getRecordedSignalsMemoryView();

  /**
   * @brief Get the Impulse Response. Returns a memory view of the impulse
   * response.
   *
   * @return emscripten::val
   */
  emscripten::val getImpulseResponse();
#endif
};

void MLSGen::GenerateSignal() {
  long i;
  for (i = 0; i < P; i++)  // Simulate a system with h = {2, 0.4, 0.2, -0.1,
                           // -0.8}, just an example
  {
    recordedSignal[i] = 2.0 * generatedSignal[(P + i - 0) % P] +
                        0.4 * generatedSignal[(P + i - 1) % P] +
                        0.2 * generatedSignal[(P + i - 2) % P] -
                        0.1 * generatedSignal[(P + i - 3) % P] -
                        0.8 * generatedSignal[(P + i - 4) % P];
  }
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
        temp = perm[i] + perm[i1];
        perm[i1] = perm[i] - perm[i1];
        perm[i] = temp;
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

  // #compute_correlation = (recorded, generated, P) => {

  //   // cross correlate to find the best match
  //   size = len(v) * len(generated);
  //   const fftr2r_x = new fftw.r2r.fft1d(size);
  //   const xCorr = fftr2r_x.backward(
  //     fftr2r_x.forward(v - v_avg) * fftr2r_x.forward(g_reversed - g_avg)
  //   );
  //   fftr2r_x.dispose(); // manual garbage collection
  //   const lag = this.#argMax(xCorr) - Math.floor(v.length / 2);

  //   // auto correlate to find the sampling difference
  //   size = len(v) * len(v);
  //   const fftr2r_auto = new fftw.r2r.fft1d(size);
  //   const autoCorr_full = fftr2r_auto.backward(
  //     fftr2r_auto.forward(v) * fftr2r_auto.forward(v_reversed)
  //   );
  //   const autoCorr = autoCorr_full.slice(len(autoCorr_full) - len(v), len(autoCorr_full));
  //   const inflection = this.#npdiff(Math.sign(this.#npdiff(autoCorr)));
  //   const peaks = inflection.map((x, i) => (x < 0 ? 1 : 0));
  // };

void MLSGen::computeCorrelation() {
  // inverse FFT of size C
  kiss_fft_cfg xcor_cfg = kiss_fft_alloc(C,1,0,0 );
  kiss_fft_cpx *xcor_in = new kiss_fft_cpx[C];
  kiss_fft_cpx *xcor_out = new kiss_fft_cpx[C];

  // set up input and output arrays
  for(int i = 0; i < C; i++) {
    xcor_in[i].r = recordedSignals[i];
    xcor_in[i].i = 0;
  }

  // compute iFFT
  kiss_fft( xcor_cfg , xcor_in , xcor_out );
  // free memory
  kiss_fft_free(xcor_cfg);

  // find max index
  int max_index = 0;
  double max_value = 0;
  for(int i = 0; i < C; i++) {
    if(xcor_out[i].r > max_value) {
      max_index = i;
      max_value = xcor_out[i].r;
    }
  }

  // use max index to compute lag
  int lag = max_index - C/2;


}

void MLSGen::computeFilter() {

}


#endif  // SPEAKER_CALIBRATION_SRC_TASKS_IMPULSE_RESPOMSE_MLSGEN_MLSGEN_HPP_