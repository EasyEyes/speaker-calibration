import QRCode from 'qrcode';
import AudioPeer from './audioPeer';
import {sleep} from '../utils';
import {
  UnsupportedDeviceError,
  MissingSpeakerIdError,
  CalibrationTimedOutError,
} from './peerErrors';

import {phrases} from '../../dist/example/i18n';

/**
 * @class Handles the speaker's side of the connection. Responsible for initiating the connection,
 * rendering the QRCode, and answering the call.
 * @augments AudioPeer
 */
class Speaker extends AudioPeer {
  /**
   * Takes the url of the current site and a target element where html elements will be appended.
   *
   * @param params - See type definition for initParameters.
   * @param Calibrator - An instance of the AudioCalibrator class, should not use AudioCalibrator directly, instead use an extended class available in /tasks/.
   * @param CalibratorInstance
   * @example
   */
  constructor(params, CalibratorInstance) {
    super(params);
    this.language = params?.language ?? 'en-US';
    this.siteUrl += '/listener?';
    this.ac = CalibratorInstance;
    this.result = null;
    this.debug = params?.debug ?? false;
    this.isSmartPhone = params?.isSmartPhone ?? false;
    this.calibrateSoundHz = params?.calibrateSoundHz ?? 48000;
    this.calibrateSoundSamplingDesiredBits = params?.calibrateSoundSamplingDesiredBits ?? 24;
    this.instructionDisplayId = params?.instructionDisplayId ?? '';
    this.soundSubtitleId = params?.soundSubtitleId ?? '';
    this.timeToCalibrateDisplay = params?.timeToCalibrateId ?? '';
    this.soundMessageId = params?.soundMessageId ?? '';
    this.titleDisplayId = params?.titleDisplayId ?? '';
    this.timeToCalibrate = params?.timeToCalibrate ?? 10;

    /* Set up callbacks that handle any events related to our peer object. */
    this.peer.on('open', this.#onPeerOpen);
    this.peer.on('connection', this.#onPeerConnection);
    this.peer.on('close', this.onPeerClose);
    this.peer.on('disconnected', this.#onPeerDisconnected);
    this.peer.on('error', this.#onPeerError);
  }
  /**
   * Async factory method that creates the Speaker object, and returns a promise that resolves to the result of the calibration.
   *
   * @param params - The parameters to be passed to the peer object.
   * @param Calibrator - The class that defines the calibration process.
   * @param CalibratorInstance
   * @param timeOut - The amount of time to wait before timing out the connection (in milliseconds).
   * @public
   * @example
   */
  static startCalibration = async (params, CalibratorInstance, timeOut = 180000) => {
    window.speaker = new Speaker(params, CalibratorInstance);
    const {speaker} = window;

    // wrap the calibration process in a promise so we can await it
    return new Promise((resolve, reject) => {
      // when a call is received
      speaker.peer.on('call', async call => {
        // Answer the call (one way)

        call.answer();
        speaker.#removeUIElems();
        speaker.#showSpinner();
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

          if (params.displayUpdate) {
            params.displayUpdate.style.display = '';
          }

          // resolve when we have a result
          speaker.result = await speaker.ac.startCalibration(
            stream,
            params.gainValues,
            params.ICalib,
            params.knownIR,
            params.microphoneName,
            params.calibrateSoundCheck,
            params.isSmartPhone,
            params.calibrateSoundBurstDb,
            params.calibrateSoundBurstFilteredExtraDb,
            params.calibrateSoundBurstLevelReTBool,
            params.calibrateSoundBurstUses1000HzGainBool,
            params.calibrateSoundBurstRepeats,
            params.calibrateSoundBurstSec,
            params.calibrateSoundBurstsWarmup,
            params.calibrateSoundHz,
            params.calibrateSoundIRSec,
            params.calibrateSoundIIRSec,
            params.calibrateSoundIIRPhase,
            params.calibrateSound1000HzPreSec,
            params.calibrateSound1000HzSec,
            params.calibrateSound1000HzPostSec,
            params.calibrateSoundBackgroundSecs,
            params.calibrateSoundSmoothOctaves,
            params.calibrateSoundPowerBinDesiredSec,
            params.calibrateSoundPowerDbSDToleratedDb,
            params.micManufacturer,
            params.micSerialNumber,
            params.micModelNumber,
            params.micModelName,
            params.calibrateMicrophonesBool,
            params.authorEmails,
            params.webAudioDeviceNames,
            params.IDsToSaveInSoundProfileLibrary,
            params.restartButton,
            params.reminder,
            params.calibrateSoundLimit
          );
          speaker.#removeUIElems();
          resolve(speaker.result);
        });
        // if we do not receive a result within the timeout, reject
        setTimeout(() => {
          reject(
            new CalibrationTimedOutError(
              `Calibration failed to produce a result after ${
                timeOut / 1000
              } seconds. Please try again.`
            )
          );
        }, timeOut);
      });
    });
  };

  static testIIR = async (params, CalibratorInstance, IIR, timeOut = 180000) => {
    window.speaker = new Speaker(params, CalibratorInstance);
    const {speaker} = window;

    // wrap the calibration process in a promise so we can await it
    return new Promise((resolve, reject) => {
      // when a call is received
      speaker.peer.on('call', async call => {
        // Answer the call (one way)
        call.answer();
        speaker.#removeUIElems();
        speaker.#showSpinner();
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
          speaker.result = await speaker.ac.playMLSwithIIR(stream, IIR);
          speaker.#removeUIElems();
          resolve(speaker.result);
        });
        // if we do not receive a result within the timeout, reject
        setTimeout(() => {
          reject(
            new CalibrationTimedOutError(
              `Calibration failed to produce a result after ${
                timeOut / 1000
              } seconds. Please try again.`
            )
          );
        }, timeOut);
      });
    });
  };

  /**
   * Called after the peer conncection has been opened.
   * Generates a QR code for the connection and displays it.
   *
   * @private
   * @example
   */
  #showQRCode = () => {
    // Get query string, the URL parameters to specify a Listener
    const queryStringParameters = {
      speakerPeerId: this.peer.id,
      isSmartPhone: this.isSmartPhone,
      calibrateSoundHz: this.calibrateSoundHz,
      calibrateSoundSamplingDesiredBits: this.calibrateSoundSamplingDesiredBits,
      lang: this.language,
    };
    const queryString = this.queryStringFromObject(queryStringParameters);
    const uri = this.siteUrl + queryString;
    if (this.isSmartPhone) {
      // Display QR code for the participant to scan
      const qrCanvas = document.createElement('canvas');
      qrCanvas.setAttribute('id', 'qrCanvas');
      console.log(uri);
      QRCode.toCanvas(qrCanvas, uri, error => {
        if (error) console.error(error);
      });
      const qrImage = new Image(400, 400);
      qrImage.setAttribute('id', 'compatibilityCheckQRImage');
      qrImage.style.zIndex = Infinity;
      qrImage.style.width = 400;
      qrImage.style.height = 400;
      qrImage.style.aspectRatio = 1;
      qrImage.src = qrCanvas.toDataURL();
      qrImage.style.maxHeight = '150px';
      qrImage.style.maxWidth = '150px';
      document.getElementById(this.targetElement).appendChild(qrImage);
    } else {
      // show the link to the user
      // If specified HTML Id is available, show QR code there
      if (document.getElementById(this.targetElement)) {
        // const linkTag = document.createElement('a');
        // linkTag.setAttribute('href', uri);
        // linkTag.innerHTML = 'Click here to start the calibration';
        // linkTag.target = '_blank';
        // document.getElementById(this.targetElement).appendChild(linkTag);
        // document.getElementById(this.targetElement).appendChild(qrCanvas);

        const proceedButton = document.createElement('button');
        proceedButton.setAttribute('id', 'calibrationProceedButton');
        proceedButton.setAttribute('class', 'btn btn-success');
        proceedButton.innerHTML = 'Proceed';
        proceedButton.onclick = () => {
          // open the link in a new tab
          window.open(uri, '_blank');
          // remove the button
          document.getElementById('calibrationProceedButton').remove();
        };
        document.getElementById(this.targetElement).appendChild(proceedButton);
      }
    }
    // or just print it to console
    console.log('TEST: Peer reachable at: ', uri);
  };

  #showSpinner = () => {
    const spinner = document.createElement('div');
    spinner.className = 'spinner-border ml-auto';
    spinner.role = 'status';
    spinner.ariaHidden = 'true';
    document.getElementById(this.targetElement).appendChild(spinner);

    // clear instructionDisplay
    const soundMessage = document.getElementById(this.soundMessageId);
    soundMessage.innerHTML = '';
    soundMessage.style.display = 'none';
    const instructionDisplay = document.getElementById(this.instructionDisplayId);
    const background = document.getElementById('background'); // todo: get background id from params
    const subtitle = document.getElementById(this.soundSubtitleId);
    if (subtitle) {
      subtitle.innerHTML = '';
    }
    if (instructionDisplay) {
      instructionDisplay.innerHTML = '';
      instructionDisplay.style.whiteSpace = 'nowrap';
      instructionDisplay.style.fontWeight = 'bold';
      instructionDisplay.style.width = 'fit-content';
      instructionDisplay.innerHTML = phrases.RC_soundRecording[this.language];
      let fontSize = 100;
      instructionDisplay.style.fontSize = fontSize + 'px';
      while (instructionDisplay.scrollWidth > background.scrollWidth * 0.9 && fontSize > 10) {
        fontSize--;
        instructionDisplay.style.fontSize = fontSize + 'px';
      }
      // const p = document.createElement('p');
      // // font size
      // p.style.fontSize = '1.1rem';
      // p.style.fontWeight = 'normal';
      // p.style.paddingTop = '20px';
      // const timeToCalibrateText = phrases.RC_howLongToCalibrate['en-US'];
      // p.innerHTML = timeToCalibrateText.replace('111', this.timeToCalibrate);
      // instructionDisplay.appendChild(p);
    }

    const timeToCalibrateDisplay = document.getElementById(this.timeToCalibrateDisplay);
    if (timeToCalibrateDisplay) {
      const timeToCalibrateText = phrases.RC_howLongToCalibrate[this.language];
      timeToCalibrateDisplay.innerHTML = timeToCalibrateText.replace('111', this.timeToCalibrate);
      timeToCalibrateDisplay.style.fontWeight = 'normal';
      timeToCalibrateDisplay.style.fontSize = '1rem';
      // timeToCalibrateDisplay.style.paddingTop = '20px';
    }

    // Update title - titleDisplayId
    const titleDisplay = document.getElementById(this.titleDisplayId);
    if (titleDisplay) {
      // replace 5 with 6
      titleDisplay.innerHTML = this.isSmartPhone
        ? titleDisplay.innerHTML.replace('2', '3')
        : titleDisplay.innerHTML.replace('4', '5');
    }
  };

  #removeUIElems = () => {
    const parent = document.getElementById(this.targetElement);
    while (parent.firstChild) {
      parent.firstChild.remove();
    }
  };

  /**
   * Called when the peer connection is opened.
   * Saves the peer id and calls the QR code generator.
   *
   * @param peerId - The peer id of the peer connection.
   * @param id
   * @private
   * @example
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
   *
   * @param connection - The connection object.
   * @private
   * @example
   */
  #onPeerConnection = connection => {
    // Allow only a single connection
    if (this.conn && this.conn.open) {
      connection.on('open', () => {
        connection.send('Already connected to another client');
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
   *
   * @private
   * @example
   */
  onPeerClose = () => {
    this.conn = null;
    console.log('Connection destroyed');
  };

  static closeConnection = () => {
    this.conn = null;
    console.log('Connection destroyed');
  };

  /**
   * Called when the peer connection is disconnected.
   * Attempts to reconnect.
   *
   * @private
   * @example
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
   *
   * @param error
   * @private
   * @example
   */
  #onPeerError = error => {
    // TODO: check if this function is needed or not
    console.error(error);
  };

  /**
   * Called when data is received from the peer connection.
   *
   * @param data
   * @private
   * @example
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

    switch (data.name) {
      case 'samplingRate':
        this.ac.setSamplingRates(data.payload);
        break;
      case 'sampleSize':
        this.ac.setSampleSize(data.payload);
        break;
      case 'deviceType':
        this.ac.setDeviceType(data.payload);
        break;
      case 'deviceName':
        this.ac.setDeviceName(data.payload);
        break;
      case 'flags':
        //this.ac.setDeviceName(data.payload);
        console.log("FLAGS");
        console.log(data.payload);
        this.ac.setFlags(data.payload);
        break;
      case 'deviceInfo':
        this.ac.setDeviceInfo(data.payload);
        console.log('Received device info from listener: ', data.payload);
        break;
      case UnsupportedDeviceError.name:
      case MissingSpeakerIdError.name:
        throw data.payload;
        break;
      default:
        break;
    }
  };

  /**
   * Called when the peer connection is #ready.
   *
   * @private
   * @example
   */
  #ready = () => {
    // Perform callback with data
    this.conn.on('data', this.#onIncomingData);
    this.conn.on('close', () => {
      console.log('Connection reset<br>Awaiting connection...');
      this.conn = null;
    });
  };

  /** .
   * .
   * .
   * Debug method for downloading the recorded audio
   *
   * @public
   * @example
   */
  downloadData = () => {
    this.ac.downloadData();
  };

  repeatCalibration = async (params, stream, CalibratorInstance) => {
    this.ac = CalibratorInstance;
    this.#removeUIElems();
    this.#showSpinner();

    console.log("This is a repeat");
    // wrap the calibration process in a promise so we can await it
    return new Promise(async (resolve, reject) => {
      const result = await this.ac.startCalibration(
        stream,
        params.gainValues,
        params.ICalib,
        params.knownIR,
        params.microphoneName,
        params.calibrateSoundCheck,
        params.isSmartPhone,
        params.calibrateSoundBurstDb,
        params.calibrateSoundBurstFilteredExtraDb,
        params.calibrateSoundBurstLevelReTBool,
        params.calibrateSoundBurstUses1000HzGainBool,
        params.calibrateSoundBurstRepeats,
        params.calibrateSoundBurstSec,
        params.calibrateSoundBurstsWarmup,
        params.calibrateSoundHz,
        params.calibrateSoundIRSec,
        params.calibrateSoundIIRSec,
        params.params.calibrateSoundIIRPhase,
        params.calibrateSound1000HzPreSec,
        params.calibrateSound1000HzSec,
        params.calibrateSound1000HzPostSec,
        params.calibrateSoundBackgroundSecs,
        params.calibrateSoundSmoothOctaves,
        params.calibrateSoundPowerBinDesiredSec,
        params.calibrateSoundPowerDbSDToleratedDb,
        params.micManufacturer,
        params.micSerialNumber,
        params.micModelNumber,
        params.micModelName,
        params.calibrateMicrophonesBool,
        params.authorEmails,
        params.webAudioDeviceNames,
        params.IDsToSaveInSoundProfileLibrary,
        params.restartButton,
        params.reminder,
        params.calibrateSoundLimit
      );
      this.#removeUIElems();
      resolve(result);
    });
  };
}

/* 
Referenced links:
https://stackoverflow.com/questions/28016664/when-you-pass-this-as-an-argument/28016676#28016676
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes
https://stackoverflow.com/questions/879152/how-do-i-make-javascript-beep [3]
*/

export default Speaker;
