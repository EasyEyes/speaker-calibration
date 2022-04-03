import AudioCalibrator from '../audioCalibrator';

import {sleep} from '../../utils';

/**
 *
 */
class Volume extends AudioCalibrator {
  /**
   *
   */
  constructor(numCalibrationRounds = 1, plot = false, numCalibrationNodes = 1) {
    super(numCalibrationRounds, plot, numCalibrationNodes);
  }

  /** @private */
  #CALIBRATION_TONE_FREQUENCY = 1000; // Hz

  /** @private */
  #CALIBRATION_TONE_TYPE = 'sine';

  /** @private */
  #CALIBRATION_TONE_DURATION = 5; // seconds

  /**
   * Construct a Calibration Node with the calibration parameters.
   * @private
   */
  #createCalibrationNode = () => {
    const audioContext = this.makeNewSourceAudioContext();
    const oscilator = audioContext.createOscillator();

    oscilator.frequency.value = this.#CALIBRATION_TONE_FREQUENCY;
    oscilator.type = this.#CALIBRATION_TONE_TYPE;
    oscilator.connect(audioContext.destination);

    this.addCalibrationNode(oscilator);
  };

  #playCalibrationAudio = async () => {
    const actualDuration = this.#CALIBRATION_TONE_DURATION * this.numCalibrationNodes;
    const totalDuration = actualDuration * 1.2;
    for (let i = 0; i < this.calibrationNodes.length; i += 1) {
      this.calibrationNodes[i].start(i * this.#CALIBRATION_TONE_DURATION);
      this.calibrationNodes[i].stop(
        i * this.#CALIBRATION_TONE_DURATION + this.#CALIBRATION_TONE_DURATION
      );
    }
    console.log(`Playing a buffer of ${actualDuration} seconds of audio`);
    console.log(`Waiting a total of ${totalDuration} seconds`);
    await sleep(totalDuration);
  };

  startCalibration = async stream => {
    await this.calibrationSteps(stream, this.#playCalibrationAudio, this.#createCalibrationNode);
  };
}

export default Volume;
