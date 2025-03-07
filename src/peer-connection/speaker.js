import QRCode from 'qrcode';
import AudioPeer from './audioPeer';
import {sleep, formatLineBreak, createAndShowPopup} from '../utils';
import {
  UnsupportedDeviceError,
  MissingSpeakerIdError,
  CalibrationTimedOutError,
} from './peerErrors';
import Peer from 'peerjs';

//import {phrases} from '../../dist/example/i18n';

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
    this.isParticipant = params?.isParticipant ?? false;
    this.isLoudspeakerCalibration = params?.isLoudspeakerCalibration ?? false;
    this.deviceId = params?.micrpohoneIdFromWebAudioApi ?? '';
    this.buttonsContainer = params?.buttonsContainer ?? document.createElement('div');
    this.phrases = params?.phrases ?? {};
    this.permissionStatus = 'pending';
    this.calibrateSoundHz = params?.calibrateSoundHz ?? 48000;

    /* Set up callbacks that handle any events related to our peer object. */
  }

  uri = '';
  qrImage;
  shortURL;

  initPeer = async () => {
    const id = await this.generateTimeBasedPeerID();
    this.peer = new Peer(id, {
      secure: true,
      host: 'easyeyes-peer-server.herokuapp.com',
      port: 443,
      config: {
        iceServers: [
          {
            urls: 'stun:stun.relay.metered.ca:80',
          },
          {
            urls: 'turn:global.relay.metered.ca:80',
            username: 'de884cfc34189cdf1a5dd616',
            credential: 'IcOpouU9/TYBmpHU',
          },
          {
            urls: 'turn:global.relay.metered.ca:80?transport=tcp',
            username: 'de884cfc34189cdf1a5dd616',
            credential: 'IcOpouU9/TYBmpHU',
          },
          {
            urls: 'turn:global.relay.metered.ca:443',
            username: 'de884cfc34189cdf1a5dd616',
            credential: 'IcOpouU9/TYBmpHU',
          },
          {
            urls: 'turns:global.relay.metered.ca:443?transport=tcp',
            username: 'de884cfc34189cdf1a5dd616',
            credential: 'IcOpouU9/TYBmpHU',
          },
        ],
      },
    });
    this.peer.on('open', this.#onPeerOpen);
    this.peer.on('connection', this.#onPeerConnection);
    this.peer.on('close', this.onPeerClose);
    this.peer.on('disconnected', this.#onPeerDisconnected);
    this.peer.on('error', this.#onPeerError);
  };
  generateTimeBasedPeerID = async () => {
    const now = new Date().getTime();
    const randomBuffer = new Uint8Array(10);
    crypto.getRandomValues(randomBuffer);
    const randomPart = Array.from(randomBuffer)
      .map(b => b.toString(36))
      .join('');
    const toHash = `${now}-${randomPart}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(toHash);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hash)); // Convert buffer to byte array
    const hashString = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const shortHash = hashString.substring(0, 12); // Use more of the hash for a longer ID
    //   return shortHash; // Consider converting this to Base62
    return this.encodeBase62(parseInt(shortHash, 16));
  };

  encodeBase62 = num => {
    const base = 36;
    const characters = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    while (num > 0) {
      result = characters[num % base] + result;
      num = Math.floor(num / base);
    }
    return result;
  };

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
    await speaker.initPeer();
    // wrap the calibration process in a promise so we can await it
    return new Promise((resolve, reject) => {
      // Add a permission check handler
      const permissionCheckInterval = setInterval(() => {
        if (speaker.permissionStatus === 'error' || speaker.permissionStatus === 'denied') {
          clearInterval(permissionCheckInterval);
          speaker.#removeUIElems();
          resolve('permission denied');
        }
      }, 100);

      // when a call is received
      speaker.peer.on('call', async call => {
        clearInterval(permissionCheckInterval); // Clear interval when call is received
        // Rest of the existing call handling code...
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
            params._calibrateSoundBurstPreSec,
            params._calibrateSoundBurstPostSec,
            params.calibrateSoundHz,
            params.calibrateSoundIRSec,
            params.calibrateSoundIIRSec,
            params.calibrateSoundIIRPhase,
            params.calibrateSound1000HzPreSec,
            params.calibrateSound1000HzSec,
            params.calibrateSound1000HzPostSec,
            params.calibrateSoundBackgroundSecs,
            params.calibrateSoundSmoothOctaves,
            params.calibrateSoundSmoothMinBandwidthHz,
            params.calibrateSoundPowerBinDesiredSec,
            params.calibrateSoundPowerDbSDToleratedDb,
            params.calibrateSoundTaperSec,
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
            params.calibrateSoundLimit,
            params.calibrateSoundBurstNormalizeBy1000HzGainBool,
            params.calibrateSoundBurstScalarDB,
            params.calibrateSound1000HzMaxSD_dB,
            params.calibrateSound1000HzMaxTries,
            params._calibrateSoundBurstMaxSD_dB,
            params.calibrateSoundSamplingDesiredBits,
            params.language,
            params.loudspeakerModelName,
            params.phrases,
            params.soundSubtitleId
          );
          speaker.#removeUIElems();
          resolve(speaker.result);
        });
        // if we do not receive a result within the timeout, reject
        setTimeout(() => {
          clearInterval(permissionCheckInterval);
          reject(
            new CalibrationTimedOutError(
              `Calibration failed to produce a result after ${
                timeOut / 1000
              } seconds. Try increasing "_timeoutSec", which is currently ${
                timeOut / 1000
              } seconds.`
            )
          );
        }, timeOut);
      });
    });
  };

  static testIIR = async (params, CalibratorInstance, IIR, timeOut = 180000) => {
    window.speaker = new Speaker(params, CalibratorInstance);
    const {speaker} = window;
    speaker.initPeer();
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
              } seconds. Try increasing "_timeoutSec", which is currently ${
                timeOut / 1000
              } seconds.`
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

  #showQRCode = async () => {
    const queryStringParameters = {
      speakerPeerId: this.peer.id,
      sp: this.isSmartPhone,
      hz: this.calibrateSoundHz,
      bits: this.calibrateSoundSamplingDesiredBits,
      lang: this.language,
      deviceId: this.deviceId,
    };
    const queryString = this.queryStringFromObject(queryStringParameters);
    this.uri = this.siteUrl + queryString;

    if (this.isSmartPhone) {
      // Generate QR code
      const qrCanvas = document.createElement('canvas');
      qrCanvas.setAttribute('id', 'qrCanvas');
      QRCode.toCanvas(qrCanvas, this.uri, error => {
        if (error) console.error(error);
      });

      // Create QR image
      const qrImage = new Image();
      qrImage.setAttribute('id', 'compatibilityCheckQRImage');
      qrImage.style.zIndex = Infinity;
      qrImage.style.height = '150px';
      qrImage.style.width = '150px';
      qrImage.style.margin = '-10px';
      qrImage.style.aspectRatio = 1;
      qrImage.src = qrCanvas.toDataURL();
      this.qrImage = qrImage;

      // Get shortened URL
      let shortURL = this.uri;
      try {
        const response = await fetch('https://api.short.io/links/public', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: 'pk_fysLKGj3legZz4XZ',
          },
          body: JSON.stringify({
            domain: 'listeners.link',
            originalURL: this.uri,
          }),
        });
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        shortURL = data.shortURL;
      } catch (error) {
        console.error('Error:', error.message);
      }

      // Main container with 3 columns
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.alignItems = 'flex-start';
      container.style.paddingTop = '0';
      container.id = 'skipQRContainer';

      // Column 1: QR Code
      const qrColumn = document.createElement('div');
      qrColumn.style.flex = '0 0 auto';
      qrColumn.appendChild(qrImage);

      // Column 2: Explanation Text
      const textColumn = document.createElement('div');
      textColumn.style.flex = '1';
      textColumn.style.padding = '0 20px';
      textColumn.style.maxWidth = '560px';

      const explanation = document.createElement('h2');
      explanation.style.fontSize = '1.1rem';
      explanation.id = 'skipQRExplanation';
      explanation.style.margin = '0';
      explanation.style.textAlign = 'left';
      explanation.innerHTML = formatLineBreak(
        this.phrases.RC_skipQR_ExplanationWithoutPreferNot[this.language]
          .replace('xxx', `<b style="user-select: text">${shortURL}</b>`)
          .replace('XXX', `<b style="user-select: text">${shortURL}</b>`),
        this.phrases.RC_checkInternetConnection[this.language]
      );

      const language = this.language;
      const phrases = this.phrases;
      const checkConnection = document.createElement('a');
      checkConnection.id = 'check-connection';
      checkConnection.href = '#';
      checkConnection.innerHTML = "check the phone's internet connection";
      checkConnection.addEventListener('click', function (event) {
        event.preventDefault();
        createAndShowPopup(language, phrases);
      });
      explanation.querySelector('a#check-connection').replaceWith(checkConnection);
      textColumn.appendChild(explanation);

      // Column 3: Buttons
      const buttonColumn = document.createElement('div');
      buttonColumn.style.display = 'flex';
      buttonColumn.style.flexDirection = 'column';
      buttonColumn.style.gap = '10px';
      buttonColumn.style.flex = '0 0 auto';
      buttonColumn.style.alignItems = 'flex-end';
      buttonColumn.appendChild(this.buttonsContainer);

      // Assemble the columns
      container.appendChild(qrColumn);
      container.appendChild(textColumn);
      container.appendChild(buttonColumn);

      document.getElementById(this.targetElement).appendChild(container);
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
        proceedButton.innerHTML = this.phrases.T_proceed[this.language];
        proceedButton.onclick = () => {
          // open the link in a new tab
          window.open(this.uri, '_blank');
          // remove the button
          document.getElementById('calibrationProceedButton').remove();
        };
        document.getElementById(this.targetElement).appendChild(proceedButton);
      }
    }
    // or just print it to console
    console.log('TEST: Peer reachable at: ', this.uri);
  };

  #showSpinner = () => {
    const spinner = document.createElement('div');
    spinner.className = 'spinner-border ml-auto';
    spinner.role = 'status';
    spinner.ariaHidden = 'true';
    spinner.style.marginTop = '0.8rem';
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
      instructionDisplay.innerHTML = this.phrases.RC_soundRecording[this.language];
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
      const timeToCalibrateText = this.phrases.RC_howLongToCalibrate[this.language];
      timeToCalibrateDisplay.innerHTML = timeToCalibrateText.replace('111', this.timeToCalibrate);
      timeToCalibrateDisplay.style.fontWeight = 'normal';
      timeToCalibrateDisplay.style.fontSize = '1rem';
      // timeToCalibrateDisplay.style.paddingTop = '20px';
    }

    // Update title - titleDisplayId
    const titleDisplay = document.getElementById(this.titleDisplayId);
    if (titleDisplay) {
      // if (this.isParticipant) {
      //     titleDisplay.innerHTML = titleDisplay.innerHTML.replace('3', '4');
      // } else if (this.isSmartPhone) {
      //     if (this.isLoudspeakerCalibration) {
      //         titleDisplay.innerHTML = titleDisplay.innerHTML.replace('6', '7');
      //     } else {
      //         titleDisplay.innerHTML = titleDisplay.innerHTML.replace('5', '6');
      //     }
      // } else {
      //     titleDisplay.innerHTML = titleDisplay.innerHTML.replace('5', '6');
      // }
      if (this.isLoudspeakerCalibration) {
        if (this.isParticipant) {
          titleDisplay.innerHTML = titleDisplay.innerHTML.replace('3', '4');
        } else if (this.isSmartPhone) {
          titleDisplay.innerHTML = titleDisplay.innerHTML.replace('6', '7');
        } else {
          titleDisplay.innerHTML = titleDisplay.innerHTML.replace('4', '5');
        }
      } else {
        if (this.isSmartPhone) {
          titleDisplay.innerHTML = titleDisplay.innerHTML.replace('5', '6');
        } else {
          titleDisplay.innerHTML = titleDisplay.innerHTML.replace('3', '4');
        }
      }
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
    try {
      if (id === null) {
        console.error('Received null id from peer open');
        this.peer.id = this.lastPeerId;
      } else {
        this.lastPeerId = this.peer.id;
      }

      if (id !== this.peer.id) {
        console.warn('DEBUG Check you assumption that id === this.peer.id');
      }
    } catch (error) {
      console.error('Error in #onPeerOpen: ', error);
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

    try {
      // Workaround for peer.reconnect deleting previous id
      this.peer.id = this.lastPeerId;
      // eslint-disable-next-line no-underscore-dangle
      this.peer._lastServerId = this.lastPeerId;
      this.peer.reconnect();
    } catch (error) {
      console.error('Error in #onPeerDisconnected: ', error);
    }
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
        console.log('Received sampling rate from listener: ', data.payload);
        if (!data.payload) {
          this.ac.setSamplingRates(this.calibrateSoundHz);
        } else {
          this.ac.setSamplingRates(data.payload);
        }
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
        console.log('FLAGS');
        console.log(data.payload);
        this.ac.setFlags(data.payload);
        break;
      case 'deviceInfo':
        this.ac.setDeviceInfo(data.payload);
        console.log('Received device info from listener: ', data.payload);
        break;
      case 'permissionStatus':
        console.log('Received permission status from listener: ', data.payload);
        if (data.payload.type === 'error') {
          this.permissionStatus = 'error';
          this.ac.setPermissionStatus('error');
        } else if (data.payload.type === 'denied') {
          this.permissionStatus = 'denied';
          this.ac.setPermissionStatus('denied');
        } else if (data.payload.type === 'granted') {
          this.permissionStatus = 'granted';
          this.ac.setPermissionStatus('granted');
          console.log('Permission granted');
        }
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

    console.log('This is a repeat');
    // wrap the calibration process in a promise so we can await it
    return new Promise((resolve, reject) => {
      // Add a permission check handler
      const permissionCheckInterval = setInterval(() => {
        if (this.permissionStatus === 'error' || this.permissionStatus === 'denied') {
          clearInterval(permissionCheckInterval);
          this.#removeUIElems();
          resolve('permission denied');
        }
      }, 100);

      // Start calibration process
      (async () => {
        try {
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
            params._calibrateSoundBurstPreSec,
            params._calibrateSoundBurstPostSec,
            params.calibrateSoundHz,
            params.calibrateSoundIRSec,
            params.calibrateSoundIIRSec,
            params.calibrateSoundIIRPhase,
            params.calibrateSound1000HzPreSec,
            params.calibrateSound1000HzSec,
            params.calibrateSound1000HzPostSec,
            params.calibrateSoundBackgroundSecs,
            params.calibrateSoundSmoothOctaves,
            params.calibrateSoundSmoothMinBandwidthHz,
            params.calibrateSoundPowerBinDesiredSec,
            params.calibrateSoundPowerDbSDToleratedDb,
            params.calibrateSoundTaperSec,
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
            params.calibrateSoundLimit,
            params.calibrateSoundBurstNormalizeBy1000HzGainBool,
            params.calibrateSoundBurstScalarDB,
            params.calibrateSound1000HzMaxSD_dB,
            params.calibrateSound1000HzMaxTries,
            params._calibrateSoundBurstMaxSD_dB,
            params.calibrateSoundSamplingDesiredBits,
            params.language,
            params.loudspeakerModelName,
            params.phrases,
            params.soundSubtitleId
          );
          clearInterval(permissionCheckInterval);
          this.#removeUIElems();
          resolve(result);
        } catch (error) {
          clearInterval(permissionCheckInterval);
          reject(error);
        }
      })();
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
