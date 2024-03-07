import axios from 'axios';
import {
  sleep
} from '../utils';
/**
 *
 */
class PythonServerAPI {
  // static PYTHON_SERVER_URL = 'https://easyeyes-python-flask-server.herokuapp.com';

  static TEST_SERVER_URL = 'http://127.0.0.1:5000';
  static PYTHON_SERVER_URL ='http://127.0.0.1:5000';

  /** @private */
  MAX_RETRY_COUNT = 3;
  /** @private */
  RETRY_DELAY_MS = 1000;
  /**
   * @param data- -
   * g = inverted impulse response, when convolved with the impulse
   * reponse, they cancel out.
   * @param data.payload
   * @param data.sampleRate
   * @param data.P
   * @param data-.payload
   * @param data-.sampleRate
   * @param data-.P
   * @returns
   * @example
   */
  getImpulseResponse = async ({
    mls, 
    sampleRate, 
    numPeriods,
    sig,
    fs2,
    L_new_n,
    dL_n
  }) => {
    const task = 'impulse-response';
    let res = null;

    const data = JSON.stringify({
      task,
      'sample-rate': sampleRate,
      mls,
      numPeriods,
      sig,
      fs2,
      L_new_n,
      dL_n
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
      })
      .catch(error => {
        throw error;
      });
    return res.data[task];
  };

  getAutocorrelation = async ({
    mls, 
    payload, 
    sampleRate, 
    numPeriods
  }) => {
    const task = 'autocorrelation';
    let res = null;

    const data = JSON.stringify({
      task,
      payload,
      'sample-rate': sampleRate,
      mls,
      numPeriods,
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
      })
      .catch(error => {
        throw error;
      });
    return res.data[task];
  };

  getConvolution = async ({
    mls, 
    inverse_response, 
    inverse_response_no_bandpass,
    attenuatorGain_dB,
    mls_amplitude
  }) => {
    const task = 'convolution';
    let res = null;

    const data = JSON.stringify({
      task,
      mls, 
      inverse_response, 
      inverse_response_no_bandpass,
      attenuatorGain_dB,
      mls_amplitude
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
      })
      .catch(error => {
        throw error;
      });
    return res.data[task];
  };

  getMLS = async ({length,amplitude,calibrateSoundBurstMLSVersions}) => {
    const task = 'mls';
    let res = null;

    const data = JSON.stringify({
      task,
      length: length,
      amplitude: amplitude,
      calibrateSoundBurstMLSVersions: calibrateSoundBurstMLSVersions,
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
      })
      .catch(error => {
        throw error;
      });

    return res.data[task];
  };

  getMemory = async () => {
    let res;
    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/memory`,
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => {
        console.log("memory used:", Math.round(response.data['memory']), "mb");
        res = response.data['memory'];
      })
      .catch(error => {
        throw error;
      });
      return res;
  };


  checkMemory = async () => {
    console.log("wait for memory under 500 mb to continue calibration");
    await this.getMemory();
    // let memory = await this.getMemory();
    // while (memory >= 500) {
    //   console.log("sleep 30s");
    //   await sleep(30);
    //   memory = await this.getMemory();
    // }
    
  };


  getMLSWithRetry = async ({length,amplitude,calibrateSoundBurstMLSVersions}) => {
    let retryCount = 0;
    let response = null;

    while (retryCount < this.MAX_RETRY_COUNT) {
      try {
        response = await this.getMLS({length,amplitude, calibrateSoundBurstMLSVersions});
        // If the request is successful, break out of the loop
        break;
      } catch (error) {
        console.error(`Error occurred. Retrying... (${retryCount + 1}/${this.MAX_RETRY_COUNT})`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
      }
    }

    if (response) {
      return response;
    } else {
      throw new Error(`Failed to get MLS after ${this.MAX_RETRY_COUNT} attempts.`);
    }
  };

  getPSD = async ({unconv_rec, conv_rec, sampleRate}) => {
    const task = 'psd';
    let res = null;

    const data = JSON.stringify({
      task,
      unconv_rec,
      conv_rec,
      sampleRate,
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
      })
      .catch(error => {
        throw error;
      });
    return res.data[task];
  };

  getBackgroundNoisePSD = async ({background_rec, sampleRate}) => {
    const task = 'background-psd';
    let res = null;

    const data = JSON.stringify({
      task,
      background_rec,
      sampleRate,
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
      })
      .catch(error => {
        throw error;
      });
    return res.data[task];
  };

  getBackgroundNoisePSDWithRetry = async ({background_rec, sampleRate}) => {
    let retryCount = 0;
    let response = null;

    while (retryCount < this.MAX_RETRY_COUNT) {
      try {
        response = await this.getBackgroundNoisePSD({background_rec, sampleRate});
        // If the request is successful, break out of the loop
        break;
      } catch (error) {
        console.error(`Error occurred. Retrying... (${retryCount + 1}/${this.MAX_RETRY_COUNT})`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
      }
    }

    if (response) {
      return response;
    } else {
      throw new Error(`Failed to get PSD after ${this.MAX_RETRY_COUNT} attempts.`);
    }
  };

  getSubtractedPSD = async (rec, knownGains, knownFrequencies, sampleRate) => {
    const task = 'subtracted-psd';
    let res = null;

    const data = JSON.stringify({
      task,
      rec,
      knownGains,
      knownFrequencies,
      sampleRate,
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
      })
      .catch(error => {
        throw error;
      });
    return res.data[task];
  };

  getSubtractedPSDWithRetry = async (rec, knownGains, knownFrequencies, sampleRate) => {
    let retryCount = 0;
    let response = null;

    while (retryCount < this.MAX_RETRY_COUNT) {
      try {
        response = await this.getSubtractedPSD(rec, knownGains, knownFrequencies, sampleRate);
        // If the request is successful, break out of the loop
        break;
      } catch (error) {
        console.error(`Error occurred. Retrying... (${retryCount + 1}/${this.MAX_RETRY_COUNT})`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
      }
    }

    if (response) {
      return response;
    } else {
      throw new Error(`Failed to get PSD after ${this.MAX_RETRY_COUNT} attempts.`);
    }
  };

  getPSDWithRetry = async ({unconv_rec, conv_rec, sampleRate}) => {
    let retryCount = 0;
    let response = null;

    while (retryCount < this.MAX_RETRY_COUNT) {
      try {
        response = await this.getPSD({unconv_rec, conv_rec, sampleRate});
        // If the request is successful, break out of the loop
        break;
      } catch (error) {
        console.error(`Error occurred. Retrying... (${retryCount + 1}/${this.MAX_RETRY_COUNT})`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
      }
    }

    if (response) {
      return response;
    } else {
      throw new Error(`Failed to get PSD after ${this.MAX_RETRY_COUNT} attempts.`);
    }
  };

  getComponentInverseImpulseResponse = async ({
    payload,
    mls,
    lowHz,
    highHz,
    componentIRGains,
    iirLength,
    componentIRFreqs,
    sampleRate,
    mlsAmplitude,
    irLength,
    calibrateSoundSmoothOctaves,
    calibrateSoundBurstFilteredExtraDb
  }) => {
    const task = 'component-inverse-impulse-response';
    let res = null;

    console.log({payload});

    const data = JSON.stringify({
      task,
      payload,
      mls,
      lowHz,
      highHz,
      iirLength,
      componentIRGains,
      componentIRFreqs,
      sampleRate,
      mlsAmplitude,
      irLength,
      calibrateSoundSmoothOctaves,
      calibrateSoundBurstFilteredExtraDb
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
      })
      .catch(error => {
        throw error;
      });

    return res.data[task];
  };
  getSystemInverseImpulseResponse = async ({
    payload,
    mls,
    lowHz,
    highHz,
    iirLength,
    sampleRate,
    mlsAmplitude,
    calibrateSoundBurstFilteredExtraDb
  }) => {
    const task = 'system-inverse-impulse-response';
    let res = null;

    console.log({payload});

    const data = JSON.stringify({
      task,
      payload,
      mls,
      lowHz,
      iirLength,
      highHz,
      sampleRate,
      mlsAmplitude,
      calibrateSoundBurstFilteredExtraDb
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
      })
      .catch(error => {
        throw error;
      });

    return res.data[task];
  };

  getMLSPSD = async ({mls, sampleRate}) => {
    const task = 'mls-psd';
    let res = null;

    const data = JSON.stringify({
      task,
      mls,
      sampleRate,
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
      })
      .catch(error => {
        throw error;
      });

    return res.data[task];
  };

  getMLSPSDWithRetry = async ({mls, sampleRate}) => {
    let retryCount = 0;
    let response = null;

    while (retryCount < this.MAX_RETRY_COUNT) {
      try {
        response = await this.getMLSPSD({mls, sampleRate});
        // If the request is successful, break out of the loop
        break;
      } catch (error) {
        console.error(`Error occurred. Retrying... (${retryCount + 1}/${this.MAX_RETRY_COUNT})`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
      }
    }

    if (response) {
      return response;
    } else {
      throw new Error(
        `Failed to get inverse impulse response after ${this.MAX_RETRY_COUNT} attempts.`
      );
    }
  };

  getComponentInverseImpulseResponseWithRetry = async ({
    payload,
    mls,
    lowHz,
    highHz,
    componentIRGains,
    iirLength,
    componentIRFreqs,
    sampleRate,
    mlsAmplitude,
    irLength,
    calibrateSoundSmoothOctaves,
    calibrateSoundBurstFilteredExtraDb
  }) => {
    let retryCount = 0;
    let response = null;

    while (retryCount < this.MAX_RETRY_COUNT) {
      try {
        response = await this.getComponentInverseImpulseResponse({
          payload,
          mls,
          lowHz,
          highHz,
          componentIRGains,
          iirLength,
          componentIRFreqs,
          sampleRate,
          mlsAmplitude,
          irLength,
          calibrateSoundSmoothOctaves,
          calibrateSoundBurstFilteredExtraDb
        });
        // If the request is successful, break out of the loop
        break;
      } catch (error) {
        console.error(`Error occurred. Retrying... (${retryCount + 1}/${this.MAX_RETRY_COUNT})`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
      }
    }

    if (response) {
      return response;
    } else {
      throw new Error(
        `Failed to get inverse impulse response after ${this.MAX_RETRY_COUNT} attempts.`
      );
    }
  };

  getSystemInverseImpulseResponseWithRetry = async ({
    payload,
    mls,
    lowHz,
    highHz,
    iirLength,
    sampleRate,
    mlsAmplitude,
    calibrateSoundBurstFilteredExtraDb
  }) => {
    let retryCount = 0;
    let response = null;

    while (retryCount < this.MAX_RETRY_COUNT) {
      try {
        response = await this.getSystemInverseImpulseResponse({
          payload,
          mls,
          lowHz,
          highHz,
          iirLength,
          sampleRate,
          mlsAmplitude,
          calibrateSoundBurstFilteredExtraDb
        });
        // If the request is successful, break out of the loop
        break;
      } catch (error) {
        console.error(`Error occurred. Retrying... (${retryCount + 1}/${this.MAX_RETRY_COUNT})`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
      }
    }

    if (response) {
      return response;
    } else {
      throw new Error(
        `Failed to get inverse impulse response after ${this.MAX_RETRY_COUNT} attempts.`
      );
    }
  };

  getVolumeCalibration = async ({payload, sampleRate, lCalib}) => {
    const task = 'volume';
    let res = null;

    console.log({payload});

    const data = JSON.stringify({
      task,
      payload,
      'sample-rate': sampleRate,
      lCalib,
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
      })
      .catch(error => {
        throw error;
      });

    return res.data[task];
  };

  getVolumeCalibrationParameters = async ({
    inDBValues,
    outDBSPLValues,
    lCalib,
    componentGainDBSPL,
  }) => {
    const task = 'volume-parameters';
    let res = null;

    const data = JSON.stringify({
      task,
      inDBValues,
      outDBSPLValues,
      lCalib,
      componentGainDBSPL,
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL, //server
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
        console.log(res.data[task]);
      })
      .catch(error => {
        throw error;
      });

    // console.log(res.data[task]);
    //below is an example of res.data[task]
    //{
    //  R: 16.56981076554259,
    //  RMSError: 1.9289162528535229
    //  T: -47.79799120884434,
    //  W: 61.0485247483732,
    //  backgroundDBSPL: 43.88233142069752,
    //  gainDBSPL: -128.24742161208985
    //}
    return res.data[task];
  };

  allHzPowerCheck = async ({
    payload, 
    sampleRate, 
    binDesiredSec,
    burstSec,
    repeats
  }) => {
    const task = 'all-hz-check';
    let res = null;

    const data = JSON.stringify({
      payload, 
      sampleRate, 
      binDesiredSec,
      burstSec,
      repeats
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL, //server
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
        console.log(res.data[task]);
      })
      .catch(error => {
        throw error;
      });
    return res.data[task];
  };

  volumePowerCheck = async ({
    payload, 
    sampleRate, 
    preSec,
    Sec,
    binDesiredSec
  }) => {
    const task = 'volume-check';
    let res = null;

    const data = JSON.stringify({
      payload, 
      sampleRate, 
      preSec,
      Sec,
      binDesiredSec
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL, //server
      url: `/task/${task}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
        console.log(res.data[task]);
      })
      .catch(error => {
        throw error;
      });
    return res.data[task];
  };
}

export default PythonServerAPI;
