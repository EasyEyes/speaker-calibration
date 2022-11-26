import axios from 'axios';
/**
 *
 */
class PythonServerAPI {
  static PYTHON_SERVER_URL = 'https://easyeyes-python-flask-server.herokuapp.com';

  static TEST_SERVER_URL = 'http://127.0.0.1:5000';

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
  getImpulseResponse = async ({payload, sampleRate, P}) => {
    const task = 'impulse-response';
    let res = null;

    console.log({payload});

    const data = JSON.stringify({
      task,
      payload,
      'sample-rate': sampleRate,
      P,
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

  getInverseImpulseResponse = async ({payload}) => {
    const task = 'inverse-impulse-response';
    let res = null;

    console.log({payload});

    const data = JSON.stringify({
      task,
      payload,
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

  getVolumeCalibrationParameters = async ({inDBValues, outDBSPLValues, lCalib}) => {
    const task = 'volume-parameters';
    let res = null;

    const data = JSON.stringify({
      task,
      inDBValues,
      outDBSPLValues,
      lCalib,
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
