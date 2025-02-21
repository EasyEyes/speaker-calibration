import AudioPeer from './audioPeer';
import {UnsupportedDeviceError, MissingSpeakerIdError} from './peerErrors';
import axios from 'axios';
import Peer from 'peerjs';

/**
 * @class Handles the listener's side of the connection. Responsible for getting access to user's microphone,
 * and initiating a call to the Speaker.
 * @augments AudioPeer
 */
class Listener extends AudioPeer {
  /**
   * Takes a target element where html elements will be appended.
   *
   * @param params - See type definition for initParameters.
   * @example
   */
  constructor(params) {
    super(params);
    console.log('Listener constructor', this.peer);
    this.microphoneFromAPI = params.microphoneFromAPI ? params.microphoneFromAPI : '';
    this.microphoneDeviceId = params.microphoneDeviceId ? params.microphoneDeviceId : '';
    // this.deviceInfoFromUser = params.deviceInfoFromUser
    //   ? params.deviceInfoFromUser
    //   : {modelNumber: '', modelName: ''};
    this.startTime = Date.now();
    this.receiverPeerId = null;

    const urlParameters = this.parseURLSearchParams();
    this.calibrateSoundHz =
      // previous calibrateSoundHz
      urlParameters.hz !== null && urlParameters.hz !== undefined ? urlParameters.hz : 48000;
    this.calibrateSoundSamplingDesiredBits =
      // previous calibrateSoundSamplingDesiredBits
      urlParameters.bits !== null && urlParameters.bits !== undefined ? urlParameters.bits : 24;
    this.speakerPeerId = urlParameters.speakerPeerId;
    this.lastPeerId = this.speakerPeerId;
    this.connOpen = false;
  }
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
    const hashArray = Array.from(new Uint8Array(hash));
    const hashString = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const shortHash = hashString.substring(0, 12);
    return this.encodeBase62(parseInt(shortHash, 16));
  };

  encodeBase62 = num => {
    const base = 26;
    const characters = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    while (num > 0) {
      result = characters[num % base] + result;
      num = Math.floor(num / base);
    }
    return result || 'a';
  };

  initializePeer = async () => {
    console.log('Initializing PeerJS connection...');
    const id = await this.generateTimeBasedPeerID();
    console.log('Generated Peer ID:', id);

    try {
      this.peer = new Peer(id, {
        debug: 2,
        host: 'easyeyes-peer-server.herokuapp.com',
        port: 443,
        secure: true,
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

      this.peer.on('open', this.onPeerOpen);
      this.peer.on('connection', this.onPeerConnection);
      this.peer.on('disconnected', this.onPeerDisconnected);
      this.peer.on('close', this.onPeerClose);
      this.peer.on('error', this.onPeerError);

      console.log('Peer object created:', this.peer);
    } catch (error) {
      console.error('Failed to initialize PeerJS:', error);
    }
  };

  onPeerOpen = id => {
    this.displayUpdate('Listener - onPeerOpen');
    console.log('onPeerOpen: ', id);
    // Workaround for peer.reconnect deleting previous id
    try {
      if (id === null) {
        this.displayUpdate('Received null id from peer open');
        this.peer.id = this.lastPeerId;
      } else {
        this.lastPeerId = this.peer.id;
      }
    } catch (error) {
      console.error('Error in onPeerOpen: ', error);
    }
    this.join();
  };

  onPeerConnection = connection => {
    this.displayUpdate('Listener - onPeerConnection');
    console.log('onPeerConnection: ', connection);
    // Disallow incoming connections
    connection.on('open', () => {
      connection.send('Sender does not accept incoming connections');
      setTimeout(() => {
        connection.close();
      }, 500);
    });
  };

  onConnData = data => {
    this.displayUpdate('Listener - onConnData');
    const hasSpeakerID = Object.prototype.hasOwnProperty.call(data, 'speakerPeerId');
    // if (!hasSpeakerID) {
    //   this.displayUpdate('Error in parsing data received! Must set "speakerPeerId" property');
    //   throw new MissingSpeakerIdError('Must set "speakerPeerId" property');
    // } else {
    //   // this.conn.close();
    //   this.displayUpdate(this.speakerPeerId);
    //   this.speakerPeerId = data.speakerPeerId;
    //   const newParams = {
    //     speakerPeerId: this.speakerPeerId,
    //   };
    //   /*
    //   FUTURE does this limit usable environments?
    //   ie does this work if internet is lost after initial page load?
    //   */
    //   window.location.search = this.queryStringFromObject(newParams); // Redirect to correctly constructed keypad page
    // }
  };

  join = async () => {
    this.displayUpdate('Listener - join');
    console.log(' Creating connection to: ', this.speakerPeerId);
    /**
     * Create the connection between the two Peers.
     *
     * Sets up callbacks that handle any events related to the
     * connection and data received on it.
     */
    // Close old connection
    if (this.conn) {
      this.displayUpdate('Closing old connection');
      this.conn.close();
    }

    // Create connection to destination peer specified by the query param
    this.displayUpdate(`Creating connection to: ${this.speakerPeerId}`);
    this.conn = this.peer.connect(this.speakerPeerId, {
      reliable: true,
    });

    this.displayUpdate('Created connection');
    this.conn.on('open', async () => {
      this.displayUpdate('Listener - conn open');
      this.connOpen = true;
      // this.sendSamplingRate();
    });

    // Handle incoming data (messages only since this is the signal sender)
    this.conn.on('data', this.onConnData);
    this.conn.on('close', () => {
      console.log('Connection closed');
      this.connOpen = false;
    });
  };

  startCalibration = async () => {
    await this.getDeviceInfo();
    await this.openAudioStream();
  };

  getMobileOS = () => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
      return 'Android';
    }
    if (
      /iPad|iPhone|iPod/.test(ua) ||
      ((navigator?.userAgentData?.platform || navigator?.platform) === 'MacIntel' &&
        navigator.maxTouchPoints > 1)
    ) {
      return 'iOS';
    }
    return 'Other';
  };

  sendSamplingRate = sampleRate => {
    this.displayUpdate('Listener - sendSamplingRate');
    this.conn.send({
      name: 'samplingRate',
      payload: sampleRate,
    });
  };

  sendSampleSize = sampleSize => {
    this.displayUpdate('Listener - sendSampleSize');
    this.conn.send({
      name: 'sampleSize',
      payload: sampleSize,
    });
  };

  sendFlags = flags => {
    this.displayUpdate('Listener - sendFlags');
    this.conn.send({
      name: 'flags',
      payload: flags,
    });
  };

  sendPermissionStatus = status => {
    // this.displayUpdate('Listener - sendPermissionStatus');
    this.conn.send({
      name: 'permissionStatus',
      payload: status,
    });
  };

  getDeviceInfo = async () => {
    const deviceInfo = {};
    try {
      fod.complete(function (data) {
        deviceInfo['IsMobile'] = data.device['ismobile'];
        deviceInfo['HardwareName'] = data.device['hardwarename'];
        deviceInfo['HardwareFamily'] = data.device['hardwarefamily'];
        deviceInfo['HardwareModel'] = data.device['hardwaremodel'];
        deviceInfo['OEM'] = data.device['oem'];
        deviceInfo['HardwareModelVariants'] = data.device['hardwaremodelvariants'];
        deviceInfo['DeviceId'] = data.device['deviceid'];
        deviceInfo['PlatformName'] = data.device['platformname'];
        deviceInfo['PlatformVersion'] = data.device['platformversion'];
        deviceInfo['DeviceType'] = data.device['devicetype'];
        // deviceInfo['deviceInfoFromUser'] = this.deviceInfoFromUser;
      });
    } catch (error) {
      console.error('Error fetching or executing script:', error.message);
    }
    // deviceInfo['deviceInfoFromUser'] = this.deviceInfoFromUser;
    deviceInfo['microphoneFromAPI'] = this.microphoneFromAPI;
    deviceInfo['microphoneDeviceId'] = this.microphoneDeviceId;
    deviceInfo['screenWidth'] = window.screen.width;
    deviceInfo['screenHeight'] = window.screen.height;
    console.log('deviceInfo Inside getDeviceInfo: ', deviceInfo);
    this.conn.send({
      name: 'deviceInfo',
      payload: deviceInfo,
    });
    return deviceInfo;
  };

  applyHQTrackConstraints = async stream => {
    // Contraint the incoming audio to the sampling rate we want
    stream.getAudioTracks().forEach(track => {
      console.log(track, track.enabled);
    });
    const track = stream.getAudioTracks()[0];
    console.log(track);
    const capabilities = track.getCapabilities();

    this.displayUpdate(
      `Listener Track Capabilities - ${JSON.stringify(capabilities, undefined, 2)}`
    );

    const constraints = track.getConstraints();

    if (capabilities.echoCancellation) {
      constraints.echoCancellation = false;
    }

    if (capabilities.sampleRate) {
      constraints.sampleRate = this.calibrateSoundHz;
    }

    if (capabilities.sampleSize) {
      constraints.sampleSize = this.calibrateSoundSamplingDesiredBits;
    }

    if (capabilities.channelCount) {
      constraints.channelCount = 1;
    }

    this.displayUpdate(`Listener Track Constraints - ${JSON.stringify(constraints, undefined, 2)}`);

    // await the promise
    try {
      await track.applyConstraints(constraints);
    } catch (err) {
      console.error(err);
      this.displayUpdate(`Error applying constraints to track: ${err}`);
    }

    const settings = track.getSettings();
    this.displayUpdate(`Listener Track Settings - ${JSON.stringify(settings, undefined, 2)}`);
    return settings;
  };

  getMediaDevicesAudioContraints = async () => {
    const availableConstraints = navigator.mediaDevices.getSupportedConstraints();

    const contraints = {
      // ...(availableConstraints.echoCancellation && availableConstraints.echoCancellation == true
      //   ? {echoCancellation: {exact: false}}
      //   : {}),
      // ...(availableConstraints.sampleRate && availableConstraints.sampleRate == true
      //   ? {sampleRate: {ideal: this.calibrateSoundHz}}
      //   : {}),
      // ...(availableConstraints.sampleSize && availableConstraints.sampleSize == true
      //   ? {sampleSize: {ideal: this.calibrateSoundSamplingDesiredBits}}
      //   : {}),
      // ...(availableConstraints.channelCount && availableConstraints.channelCount == true
      //   ? {channelCount: {exact: 1}}
      //   : {}),
      autoGainControl: false,
      noiseSuppression: false,
      echoCancellation: false,
      channelCount: 1,
    };

    if (this.microphoneDeviceId !== '') {
      contraints.deviceId = {exact: await this.getDeviceIdByLabel(this.microphoneDeviceId)};
    }

    console.log(contraints);

    return contraints;
  };
  setMicrophoneFromAPI = microphoneFromAPI => {
    this.microphoneFromAPI = microphoneFromAPI;
  };
  setMicrophoneDeviceId = microphoneDeviceId => {
    this.microphoneDeviceId = microphoneDeviceId;
  };
  getDeviceIdByLabel = async targetLabel => {
    try {
      //get permission to use audio first. (Returns empty labels on some computers if not done first)
      await navigator.mediaDevices.getUserMedia({audio: true});
      // Enumerate available media devices
      const devices = await navigator.mediaDevices.enumerateDevices();

      // Find the device with the matching label
      const matchingDevice = devices.find(
        device => device.kind === 'audioinput' && device.label === targetLabel
      );

      if (matchingDevice) {
        return matchingDevice.deviceId; // Return the deviceId if found
      } else {
        throw new Error(`No audio input device found with label: "${targetLabel}"`);
      }
    } catch (error) {
      console.error('Error finding device ID:', error);
      return null;
    }
  };

  openAudioStream = async () => {
    this.displayUpdate('Listener - openAudioStream');
    const mobileOS = this.getMobileOS();
    if (process.env.NODE_ENV !== 'development' && mobileOS !== 'iOS') {
      const err = new UnsupportedDeviceError(`${mobileOS} is not supported`);
      this.conn.send({
        name: err.name,
        payload: err,
      });
      return;
    }
    const constraints = await this.getMediaDevicesAudioContraints();
    console.log('Constraints right before getUserMedia:', constraints);
    navigator.mediaDevices
      .getUserMedia({
        audio: constraints,
        video: false,
        //audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false, deviceId: {exact: await this.getDeviceIdByLabel(this.microphoneDeviceId) }},
      })
      .then(stream => {
        this.displayUpdate(
          `Listener Track settings before applied constraints - ${JSON.stringify(
            stream.getAudioTracks()[0].getSettings(),
            undefined,
            2
          )}`
        );
        this.applyHQTrackConstraints(stream)
          .then(settings => {
            console.log(settings);
            this.sendSamplingRate(settings.sampleRate);
            //let sampleSize = settings.sampleSize;
            let sampleSize = this.calibrateSoundSamplingDesiredBits;
            /*
            if (!sampleSize) {
              sampleSize = this.calibrateSoundSamplingDesiredBits;
            }
            */
            this.sendSampleSize(sampleSize);
            this.sendFlags({
              autoGainControl: settings.autoGainControl,
              noiseSuppression: settings.noiseSuppression,
              echoCancellation: settings.echoCancellation,
            });
            this.peer.call(this.speakerPeerId, stream); // one-way call
            this.displayUpdate('Listener - openAudioStream');
          })
          .catch(err => {
            console.log(err);
            this.displayUpdate(
              `Listener - Error in applyHQTrackConstraints - ${JSON.stringify(err, undefined, 2)}`
            );
          });
      })
      .catch(err => {
        console.error(err);
        if (err.name === 'OverconstrainedError') {
          const constraint = err.constraint;
          const message = `The constraint "${constraint}" cannot be satisfied by the selected microphone. Please adjust your calibration settings or choose a different microphone.`;

          this.displayUpdate(`Listener - OverconstrainedError: ${message}`);
          console.error(message);

          alert(`Overconstrained Error: ${message}`);
        }
        this.displayUpdate(
          `Listener - Error in getUserMedia - ${JSON.stringify(err, undefined, 2)}`
        );
      });
  };
}

export default Listener;
