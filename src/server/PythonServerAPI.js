import axios from 'axios';
/**
 *
 */
class PythonServerAPI {
  static PYTHON_SERVER_URL = 'https://easyeyes-python-flask-server.herokuapp.com';

  static TEST_SERVER_URL = 'http://127.0.0.1:5000';

  /**
   * @param {array} data
   * g = inverted impulse response, when convolved with the impulse
   * reponse, they cancel out.
   * @returns {Float<array>}
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

  getVolumeCalibration = async data => {
    let serverRep;
    let res;
    try {
      serverRep = await this.asyncEmit('data', {
        task: 'volume-calibration',
        data,
      });
      const [soundGainDbSPL, P, L, vectorDb] = serverRep.data
        .trim()
        .split(',')
        .map(resp => parseFloat(resp.split(':')[1]));
      res = soundGainDbSPL;
    } catch (e) {
      throw new Error(e);
    }
    return res;
  };
}

export default PythonServerAPI;
