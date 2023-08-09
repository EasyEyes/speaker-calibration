import axios from 'axios';
/**
 *
 */
class PythonServerAPI {
  //static PYTHON_SERVER_URL = 'https://easyeyes-python-flask-server.herokuapp.com';

  static TEST_SERVER_URL = 'http://127.0.0.1:5000';
  static PYTHON_SERVER_URL = 'http://127.0.0.1:5000';

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
  getImpulseResponse = async ({mls, payload, sampleRate, P, numPeriods}) => {
    const task = 'impulse-response';
    let res = null;

    console.log({payload});

    const data = JSON.stringify({
      task,
      payload,
      'sample-rate': sampleRate,
      mls,
      P,
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

  getMLS = async(length) => {
    const task = 'mls';
    let res = null

    const data = JSON.stringify({
      task,
      'length':length,
    })

    await axios({
      method:'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: `/task/${task}`,
      headers: {
        'Content-Type':'application/json',
      },
      data,
    })
      .then(response => {
        res = response;
      })
      .catch(error => {
        throw error;
      })

      return res.data[task];
  }
  getMLSWithRetry = async (length) => {
    let retryCount = 0;
    let response = null;

    while (retryCount < this.MAX_RETRY_COUNT) {
      try {
        response = await this.getMLS(length);
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

  getSubtractedPSD = async (rec, knownGains, knownFrequencies,sampleRate) => {
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

  getSubtractedPSDWithRetry = async ( rec, knownGains, knownFrequencies,sampleRate) => {
    let retryCount = 0;
    let response = null;

    while (retryCount < this.MAX_RETRY_COUNT) {
      try {
        response = await this.getSubtractedPSD( rec, knownGains, knownFrequencies,sampleRate );
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
  
  getPSDWithRetry = async ({ unconv_rec, conv_rec,sampleRate }) => {
    let retryCount = 0;
    let response = null;
  
    while (retryCount < this.MAX_RETRY_COUNT) {
      try {
        response = await this.getPSD({ unconv_rec, conv_rec,sampleRate });
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
  

  getComponentInverseImpulseResponse = async ({payload,mls,lowHz,highHz,componentIRGains,componentIRFreqs,sampleRate}) => {
    const task = 'component-inverse-impulse-response';
    let res = null;

    console.log({payload});

    const data = JSON.stringify({
      task,
      payload,
      mls,
      lowHz,
      highHz,
      componentIRGains,
      componentIRFreqs,
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
  getSystemInverseImpulseResponse = async ({payload,mls,lowHz,highHz,sampleRate}) => {
    const task = 'system-inverse-impulse-response';
    let res = null;

    console.log({payload});

    const data = JSON.stringify({
      task,
      payload,
      mls,
      lowHz,
      highHz,
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

getComponentInverseImpulseResponseWithRetry = async ({ payload, mls, lowHz, highHz,componentIRGains,componentIRFreqs, sampleRate}) => {
  let retryCount = 0;
  let response = null;

  while (retryCount < this.MAX_RETRY_COUNT) {
    try {
      response = await this.getComponentInverseImpulseResponse({ payload, mls, lowHz, highHz,componentIRGains,componentIRFreqs,sampleRate});
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
    throw new Error(`Failed to get inverse impulse response after ${this.MAX_RETRY_COUNT} attempts.`);
  }
};

getSystemInverseImpulseResponseWithRetry = async ({ payload, mls, lowHz, highHz, sampleRate}) => {
  let retryCount = 0;
  let response = null;

  while (retryCount < this.MAX_RETRY_COUNT) {
    try {
      response = await this.getSystemInverseImpulseResponse({ payload, mls, lowHz, highHz,sampleRate});
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
    throw new Error(`Failed to get inverse impulse response after ${this.MAX_RETRY_COUNT} attempts.`);
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

  getVolumeCalibrationParameters = async ({inDBValues, outDBSPLValues, lCalib, componentGainDBSPL}) => {
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
}

export default PythonServerAPI;
