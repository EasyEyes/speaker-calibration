#include "stdio.h"

void GenerateSignal(bool *mls, double *signal, long P) {
  long i;
  double *input = new double[P];
  for (i = 0; i < P; i++)  // Change 0 to 1 and 1 to -1
  {
    input[i] = -2 * mls[i] + 1;
  }
  for (i = 0; i < P; i++)  // Simulate a system with h = {2, 0.4, 0.2, -0.1,
                           // -0.8}, just an example
  {
    signal[i] = 2.0 * input[(P + i - 0) % P] + 0.4 * input[(P + i - 1) % P] +
                0.2 * input[(P + i - 2) % P] - 0.1 * input[(P + i - 3) % P] -
                0.8 * input[(P + i - 4) % P];
  }
  delete[] input;
}

void GenerateMls(bool *mls, long P, long N) {
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
  for (i = 0; i < N; i++)  // copy the N'th taps table
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

void FastHadamard(double *x, long P1, long N) {
  long i, i1, j, k, k1, k2;
  double temp;
  k1 = P1;
  for (k = 0; k < N; k++) {
    k2 = k1 >> 1;
    for (j = 0; j < k2; j++) {
      for (i = j; i < P1; i = i + k1) {
        i1 = i + k2;
        temp = x[i] + x[i1];
        x[i1] = x[i] - x[i1];
        x[i] = temp;
      }
    }
    k1 = k1 >> 1;
  }
}

void PermuteSignal(double *sig, double *perm, long *tagS, long P) {
  long i;
  double dc = 0;
  for (i = 0; i < P; i++) dc += sig[i];
  perm[0] = -dc;
  for (i = 0; i < P; i++) {  // Just a permutation of the measured signal
    perm[tagS[i]] = sig[i];
  }
}
void PermuteResponse(double *perm, double *resp, long *tagL, long P) {
  long i;
  const double fact = 1 / double(P + 1);
  for (i = 0; i < P; i++)  // Just a permutation of the impulse response
  {
    resp[i] = perm[tagL[i]] * fact;
  }
  resp[P] = 0;
}

void GeneratetagL(bool *mls, long *tagL, long P, long N) {
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
                             // the column as the j'th index
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

void GeneratetagS(bool *mls, long *tagS, long P, long N) {
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

int main() {
  const long N = 18;
  const long P = (1 << N) - 1;
  long i;
  bool *mls = new bool[P];
  long *tagL = new long[P];
  long *tagS = new long[P];
  double *signal = new double[P];
  double *perm = new double[P + 1];
  double *resp = new double[P + 1];
  GenerateMls(mls, P, N);         // Generate the Maximum length sequence
  GeneratetagL(mls, tagL, P, N);  // Generate tagL for the L matrix
  GeneratetagS(mls, tagS, P, N);  // Generate tagS for the S matrix
  GenerateSignal(mls, signal,
                 P);  // Do a simulated measurement and get the signal
  PermuteSignal(signal, perm, tagS, P);  // Permute the signal according to tagS
  FastHadamard(perm, P + 1, N);          // Do a Hadamard transform in place
  PermuteResponse(perm, resp, tagL,
                  P);  // Permute the impulseresponse according to tagL

  printf("The mls is:\n");
  for (i = 0; i < 10; i++) printf("%d\n", mls[i]);
  printf("The tagL is:\n");
  for (i = 0; i < 10; i++) printf("%ld\n", tagL[i]);
  printf("The tagS is:\n");
  for (i = 0; i < 10; i++) printf("%ld\n", tagS[i]);
  printf("The signal is:\n");
  for (i = 0; i < 10; i++) printf("%f\n", signal[i]);
  printf("The permuted signal is:\n");
  for (i = 0; i < 10; i++) printf("%f\n", perm[i]);
  printf("Impulse response:\n");
  for (i = 0; i < 10; i++) printf("%10.5f\n", resp[i]);
  delete[] mls;
  delete[] tagL;
  delete[] tagS;
  delete[] signal;
  delete[] perm;
  delete[] resp;

  return 0;
}