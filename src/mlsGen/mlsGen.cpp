// setup emscripten for vscode intelli sense: 
// https://gist.github.com/wayou/59f3a8e4fbab050fbb32e94dd9582660'
#include <emscripten/emscripten.h>
#include <emscripten/bind.h>

using namespace emscripten;

class MLSGen
{
private:
    long N;
    long P;
    bool *mls;
    long *tagL;
    long *tagS;
    double *my_signal;
    double *perm;
    double *resp;

public:
    MLSGen(long N);
    ~MLSGen();
    void getMls(bool *resBuff);
    double *getResp();
    void setSig(double *signal);
    // void generateSignal(bool *mls, double *signal, long P);
    void generateMls();
    void fastHadamard();
    void permuteSignal();
    void permuteResponse();
    void generateTagL();
    void generateTagS();
};

MLSGen::MLSGen(long N)
{
    N = N;
    P = (1 << N) - 1;
    mls = new bool[P];
    tagL = new long[P];
    tagS = new long[P];
    my_signal = new double[P];
    perm = new double[P + 1];
    resp = new double[P + 1];
}

MLSGen::~MLSGen()
{
    delete[] mls;
    delete[] tagL;
    delete[] tagS;
    delete[] my_signal;
    delete[] perm;
    delete[] resp;
}

// we can't return a pointer to an array so we instead pass a buffer 
// to be filled with the MLS
void MLSGen::getMls(bool *resBuff)
{
    // if mls is not generated, generate it
    if (*(&mls + 1) - mls != P)
    {
        generateMls();
    }
    // copy mls to resBuff
    for (int i = 0; i < P; i++)
    {
        resBuff[i] = mls[i];
    }
}

double *MLSGen::getResp()
{
    return resp;
}

void MLSGen::setSig(double *signal)
{
    if (*(&signal + 1) - signal != P)
    {
        printf("Error: signal length does not match MLS length\n");
        return;
    }
    for (long i = 0; i < P; i++)
    {
        my_signal[i] = signal[i];
    }
}

// void MLSGen::generateSignal(bool *mls, double *signal, long P)
// {
//     long i;
//     double *input = new double[P];
//     for (i = 0; i < P; i++) // Change 0 to 1 and 1 to -1
//     {
//         input[i] = -2 * mls[i] + 1;
//     }
//     for (i = 0; i < P; i++) // Simulate a system with h = {2, 0.4, 0.2, -0.1, -0.8}, just an example
//     {
//         signal[i] =
//             2.0 * input[(P + i - 0) % P] + 0.4 * input[(P + i - 1) % P] + 0.2 * input[(P + i - 2) % P] - 0.1 * input[(P + i - 3) % P] - 0.8 * input[(P + i - 4) % P];
//     }
//     delete[] input;
// }

void MLSGen::generateMls()
{
    const long maxNoTaps = 18;
    const bool tapsTab[16][18] = {
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0,
        0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0,
        0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
    bool taps[maxNoTaps];
    long i, j;
    bool *delayLine = new bool[maxNoTaps];
    long sum;
    for (i = 0; i < N; i++) // copy the N’th taps table
    {
        taps[i] = tapsTab[maxNoTaps - N][i];
        delayLine[i] = 1;
    }
    for (i = 0; i < P; i++) // Generate an MLS by summing the taps mod 2
    {
        sum = 0;
        for (j = 0; j < N; j++)
        {
            sum += taps[j] * delayLine[j];
        }
        sum &= 1; // mod 2
        mls[i] = delayLine[N - 1];
        for (j = N - 2; j >= 0; j--)
        {
            delayLine[j + 1] = delayLine[j];
        }
        delayLine[0] = *(bool *)&sum;
    }
    delete[] delayLine;
}

void MLSGen::fastHadamard()
{
    long i, i1, j, k, k1, k2, P1;
    double temp;
    P1 = P + 1;
    k1 = P1;
    for (k = 0; k < N; k++)
    {
        k2 = k1 >> 1;
        for (j = 0; j < k2; j++)
        {
            for (i = j; i < P1; i = i + k1)
            {
                i1 = i + k2;
                temp = mls[i] + mls[i1];
                mls[i1] = mls[i] - mls[i1];
                mls[i] = temp;
            }
        }
        k1 = k1 >> 1;
    }
}

void MLSGen::permuteSignal()
{
    long i;
    double dc = 0;
    for (i = 0; i < P; i++)
        dc += my_signal[i];
    perm[0] = -dc;
    for (i = 0; i < P; i++) // Just a permutation of the measured signal
        perm[tagS[i]] = my_signal[i];
}

void MLSGen::permuteResponse()
{
    long i;
    const double fact = 1 / double(P + 1);
    for (i = 0; i < P; i++) // Just a permutation of the impulse response
    {
        resp[i] = perm[tagL[i]] * fact;
    }
    resp[P] = 0;
}

void MLSGen::generateTagL()
{
    long i, j;
    long *colSum = new long[P];
    long *index = new long[N];
    for (i = 0; i < P; i++) // Run through all the columns in the autocorr matrix
    {
        colSum[i] = 0;
        for (j = 0; j < N; j++) // Find colSum as the value of the first N elements regarded as a binary number
        {
            colSum[i] += mls[(P + i - j) % P] << (N - 1 - j);
        }
        for (j = 0; j < N; j++) // Figure out if colSum is a 2^j number and store the column as the j’th index
        {
            if (colSum[i] == (1 << j))
                index[j] = i;
        }
    }
    for (i = 0; i < P; i++) // For each row in the L matrix
    {
        tagL[i] = 0;
        for (j = 0; j < N; j++) // Find the tagL as the value of the rows in the L matrix regarded as a binary number
        {
            tagL[i] += mls[(P + index[j] - i) % P] * (1 << j);
        }
    }
    delete[] colSum;
    delete[] index;
}

void MLSGen::generateTagS()
{
    long i, j;
    for (i = 0; i < P; i++) // For each column in the S matrix
    {
        tagS[i] = 0;
        for (j = 0; j < N; j++) // Find the tagS as the value of the columns in the S matrix regarded as a binary number
        {
            tagS[i] += mls[(P + i - j) % P] * (1 << (N - 1 - j));
        }
    }
}

// Binding code
EMSCRIPTEN_BINDINGS(mls_gen_module)
{
    class_<MLSGen>("MLSGen")
        .constructor<long>()
        .function("generateMls", &MLSGen::generateMls)
        .function("fastHadamard", &MLSGen::fastHadamard)
        .function("permuteSignal", &MLSGen::permuteSignal)
        .function("permuteResponse", &MLSGen::permuteResponse)
        .function("generateTagL", &MLSGen::generateTagL)
        .function("generateTagS", &MLSGen::generateTagS)
        .function("getMls", &MLSGen::getMls, allow_raw_pointers())
        .function("getResp", &MLSGen::getResp, allow_raw_pointers())
        .function("setSig", &MLSGen::setSig, allow_raw_pointers());
    // .function("generateSignal", &MLSGen::generateSignal)
}

// EMSCRIPTEN_KEEPALIVE
// void test()
// {
//     const long N = 18;
//     const long P = (1 << N) - 1;
//     long i;
//     bool *mls = new bool[P];
//     long *tagL = new long[P];
//     long *tagS = new long[P];
//     double *my_signal = new double[P];
//     double *perm = new double[P + 1];
//     double *resp = new double[P + 1];
//     generateMls(mls, P, N);               // Generate the Maximum length sequence
//     generateTagL(mls, tagL, P, N);        // Generate tagL for the L matrix
//     generateTagS(mls, tagS, P, N);        // Generate tagS for the S matrix
//     generateSignal(mls, signal, P);       // Do a simulated measurement and get the signal
//     permuteSignal(my_signal, perm, tagS, P); // Permute the signal according to tagS
//     fastHadamard(perm, P + 1, N);         // Do a Hadamard transform in place
//     permuteResponse(perm, resp, tagL, P); // Permute the impulseresponse according to tagL
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