#ifndef SPEAKER_CALIBRATION_SRC_TASKS_VOLUMME_VOLUME_HPP_
#define SPEAKER_CALIBRATION_SRC_TASKS_VOLUMME_VOLUME_HPP_

// setup emscripten for vscode intelli sense:
// https://gist.github.com/wayou/59f3a8e4fbab050fbb32e94dd9582660'
#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
#include <emscripten/val.h>
#endif

#include <math.h>

class Volume {
    private:
    const long REF_POWER = 2 * pow(10, -10);
    const long REF_PRESSURE = 2 * pow(10, -5);
    const long TARGET_RANGE[2] = { 3.5, 4.5 };
    long sampleRate;
    long *sineSignal;
    long *recordedSineSignal;
}

#endif // SPEAKER_CALIBRATION_SRC_TASKS_VOLUMME_VOLUME_HPP_