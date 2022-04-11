import QRCode from 'qrcode';
import AudioPeer from './audioPeer';
import {sleep} from '../utils';

/**
 * @class Handles the speaker's side of the connection. Responsible for initiating the connection,
 * rendering the QRCode, and answering the call.
 * @extends AudioPeer
 */
class Speaker extends AudioPeer {
  /**
   * Takes the url of the current site and a target element where html elements will be appended.
   * @param {initParameters} params - see type definition for initParameters
   * @param {AudioCalibrator} Calibrator - An instance of the AudioCalibrator class, should not use AudioCalibrator directly, instead use an extended class available in /tasks/
   */
  constructor(params, Calibrator) {
    super(params);

    this.siteUrl += '/listener?';
    this.ac = new Calibrator();
    this.result = null;

    /* Set up callbacks that handle any events related to our peer object. */
    this.peer.on('open', this.#onPeerOpen);
    this.peer.on('connection', this.#onPeerConnection);
    this.peer.on('close', this.#onPeerClose);
    this.peer.on('disconnected', this.#onPeerDisconnected);
    this.peer.on('error', this.#onPeerError);
  }

  /**
   * Async factory method that creates the Speaker object, and returns a promise that resolves to the result of the calibration.
   * @param {*} params - The parameters to be passed to the peer object.
   * @param {*} Calibrator - The class that defines the calibration process
   * @param {Number} timeOut - The amount of time to wait before timing out the connection (in milliseconds)
   * @public
   */
  static startCalibration = async (params, Calibrator, timeOut = 60000) => {
    window.speaker = new Speaker(params, Calibrator);
    const {speaker} = window;
    // wrap the calibration process in a promise so we can await it
    return new Promise((resolve, reject) => {
      // when a call is received
      speaker.peer.on('call', async call => {
        // Answer the call (one way)
        call.answer();
        speaker.ac.createLocalAudio(document.getElementById(speaker.targetElement));
        // when we start receiving audio
        call.on('stream', async stream => {
          window.localStream = stream;
          window.localAudio.srcObject = stream;
          window.localAudio.autoplay = false;

          // if the sinkSamplingRate is not set sleep
          while (!speaker.ac.sampleRatesSet()) {
            console.log('SinkSamplingRate is undefined, sleeping');
            await sleep(1);
          }
          // resolve when we have a result
          resolve((speaker.result = await speaker.ac.startCalibration(stream)));
        });
        // if we do not receive a result within the timeout, reject
        setTimeout(() => {
          reject(new Error(`Request timed out after ${timeOut / 1000} seconds. Please try again.`));
        }, timeOut);
      });
    });
  };

  /**
   * Called after the peer conncection has been opened.
   * Generates a QR code for the connection and displays it.
   * @private
   */
  #showQRCode = () => {
    // Get query string, the URL parameters to specify a Listener
    const queryStringParameters = {
      speakerPeerId: this.peer.id,
    };
    const queryString = this.queryStringFromObject(queryStringParameters);
    const uri = this.siteUrl + queryString;

    // Display QR code for the participant to scan
    const qrCanvas = document.createElement('canvas');
    qrCanvas.setAttribute('id', 'qrCanvas');
    console.log(uri);
    QRCode.toCanvas(qrCanvas, uri, error => {
      if (error) console.error(error);
    });

    // If specified HTML Id is available, show QR code there
    if (document.getElementById(this.targetElement)) {
      document.getElementById(this.targetElement).appendChild(qrCanvas);
    } else {
      // or just print it to console
      console.log('TEST: Peer reachable at: ', uri);
    }
  };

  /**
   * Called when the peer connection is opened.
   * Saves the peer id and calls the QR code generator.
   * @param {object} peerId - The peer id of the peer connection
   * @private
   */
  #onPeerOpen = id => {
    // Workaround for peer.reconnect deleting previous id
    if (id === null) {
      console.error('Received null id from peer open');
      this.peer.id = this.lastPeerId;
    } else {
      this.lastPeerId = this.peer.id;
    }

    if (id !== this.peer.id) {
      console.warn('DEBUG Check you assumption that id === this.peer.id');
    }

    this.#showQRCode();
  };

  /**
   * Called when the peer connection is established.
   * Enforces a single connection.
   * @param {*} connection - The connection object
   * @private
   */
  #onPeerConnection = connection => {
    console.log('Speaker - #onPeerConnection');

    // Allow only a single connection
    if (this.conn && this.conn.open) {
      connection.on('open', () => {
        connection.send('Al#ready connected to another client');
        setTimeout(() => {
          connection.close();
        }, 500);
      });
      return;
    }

    this.conn = connection;
    console.log('Connected to: ', this.conn.peer);
    this.#ready();
  };

  /**
   * Called when the peer connection is closed.
   * @private
   */
  #onPeerClose = () => {
    this.conn = null;
    console.log('Connection destroyed');
  };

  /**
   * Called when the peer connection is disconnected.
   * Attempts to reconnect.
   * @private
   */
  #onPeerDisconnected = () => {
    console.log('Connection lost. Please reconnect');

    // Workaround for peer.reconnect deleting previous id
    this.peer.id = this.lastPeerId;
    // eslint-disable-next-line no-underscore-dangle
    this.peer._lastServerId = this.lastPeerId;
    this.peer.reconnect();
  };

  /**
   * Called when the peer connection encounters an error.
   * @param {*} error
   * @private
   */
  #onPeerError = error => {
    // TODO: check if this function is needed or not
    console.error(error);
  };

  /**
   * Called when data is received from the peer connection.
   * @param {*} data
   * @private
   */
  #onIncomingData = data => {
    // enforce object type
    if (
      !Object.prototype.hasOwnProperty.call(data, 'name') ||
      !Object.prototype.hasOwnProperty.call(data, 'payload')
    ) {
      console.error('Received malformed data: ', data);
      return;
    }
    // handle sampling rate sent from Listener
    if (data.name === 'samplingRate') {
      this.ac.setSamplingRates(data.payload);
    }
  };

  /**
   * Called when the peer connection is #ready.
   * @private
   */
  #ready = () => {
    // Perform callback with data
    this.conn.on('data', this.#onIncomingData);
    this.conn.on('close', () => {
      console.log('Connection reset<br>Awaiting connection...');
      this.conn = null;
    });
  };

  /**
   * Debug method for downloading the recorded audio
   * @public
   */
  downloadData = () => {
    this.ac.downloadData();
  };
}

/* 
Referenced links:
https://stackoverflow.com/questions/28016664/when-you-pass-this-as-an-argument/28016676#28016676
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes
https://stackoverflow.com/questions/879152/how-do-i-make-javascript-beep [3]
*/

export default Speaker;
