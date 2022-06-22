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
    let res = null;

    console.log({payload});

    const data = JSON.stringify({
      task: 'impulse-response',
      payload,
      'sample-rate': sampleRate,
      P,
    });

    await axios({
      method: 'post',
      baseURL: PythonServerAPI.PYTHON_SERVER_URL,
      url: '/task/impulse-response',
      headers: {
        'Content-Type': 'application/json',
      },
      data,
    })
      .then(function (response) {
        res = response;
      })
      .catch(function (error) {
        throw error;
      });

    return res.data['inverted-impulse-response'];
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

  asyncEmit = (eventName, data) =>
    new Promise((resolve, reject) => {
      this.socket.emit(eventName, data);
      this.socket.on(eventName, result => {
        resolve(result);
      });
      this.socket.on('error', error => {
        reject(error);
      });
      setTimeout(reject, 90000);
    });
}

export default PythonServerAPI;
