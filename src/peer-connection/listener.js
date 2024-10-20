import AudioPeer from './audioPeer';
import {UnsupportedDeviceError, MissingSpeakerIdError} from './peerErrors';
import axios from 'axios';

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
      urlParameters.hz !== null && urlParameters.hz !== undefined
        ? urlParameters.hz
        : 48000;
    this.calibrateSoundSamplingDesiredBits =
    // previous calibrateSoundSamplingDesiredBits
      urlParameters.bits !== null &&
      urlParameters.bits !== undefined
        ? urlParameters.bits
        : 24;
    this.speakerPeerId = urlParameters.speakerPeerId;

    this.peer.on('open', this.onPeerOpen);
    this.peer.on('connection', this.onPeerConnection);
    this.peer.on('disconnected', this.onPeerDisconnected);
    this.peer.on('close', this.onPeerClose);
    this.peer.on('error', this.onPeerError);
  }

  onPeerOpen = id => {
    this.displayUpdate('Listener - onPeerOpen');
    // Workaround for peer.reconnect deleting previous id

    if (id === null) {
      this.displayUpdate('Received null id from peer open');
      this.peer.id = this.lastPeerId;
    } else {
      this.lastPeerId = this.peer.id;
    }

    this.join();
  };

  onPeerConnection = connection => {
    this.displayUpdate('Listener - onPeerConnection');
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
    if (!hasSpeakerID) {
      this.displayUpdate('Error in parsing data received! Must set "speakerPeerId" property');
      throw new MissingSpeakerIdError('Must set "speakerPeerId" property');
    } else {
      // this.conn.close();
      this.displayUpdate(this.speakerPeerId);
      this.speakerPeerId = data.speakerPeerId;
      const newParams = {
        speakerPeerId: this.speakerPeerId,
      };
      /*
      FUTURE does this limit usable environments?
      ie does this work if internet is lost after initial page load?
      */
      window.location.search = this.queryStringFromObject(newParams); // Redirect to correctly constructed keypad page
    }
  };

  join = async () => {
    this.displayUpdate('Listener - join');
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
      await this.getDeviceInfo();
      // this.sendSamplingRate();
      await this.openAudioStream();
    });

    // Handle incoming data (messages only since this is the signal sender)
    this.conn.on('data', this.onConnData);
    this.conn.on('close', () => {
      console.log('Connection closed');
    });
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
      payload: flags
    });
  }

  getDeviceInfo = async () => {
    try {
      const deviceInfo = {};
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
    } catch (error) {
      console.error('Error fetching or executing script:', error.message);
      return null;
    }
  };

  applyHQTrackConstraints = async stream => {
    // Contraint the incoming audio to the sampling rate we want
    stream.getAudioTracks().forEach(track => {console.log(track, track.enabled)});
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

  getMediaDevicesAudioContraints = () => {
    const availableConstraints = navigator.mediaDevices.getSupportedConstraints();

    this.displayUpdate(
      `Listener MediaDevices Available Contraints  - ${JSON.stringify(
        availableConstraints,
        undefined,
        2
      )}`
    );

    const contraints = {
      // ...(availableConstraints.echoCancellation && availableConstraints.echoCancellation == true
      //   ? {echoCancellation: {exact: false}}
      //   : {}),
      ...(availableConstraints.sampleRate && availableConstraints.sampleRate == true
        ? {sampleRate: {ideal: this.calibrateSoundHz}}
        : {}),
      ...(availableConstraints.sampleSize && availableConstraints.sampleSize == true
        ? {sampleSize: {ideal: this.calibrateSoundSamplingDesiredBits}}
        : {}),
      ...(availableConstraints.channelCount && availableConstraints.channelCount == true
        ? {channelCount: {exact: 1}}
        : {}),
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };

    if (this.microphoneDeviceId !== '') {
      contraints.deviceId = {exact: this.microphoneDeviceId};
    }

    console.log(contraints);

    this.displayUpdate(
      `Listener MediaDevices Contraints - ${JSON.stringify(contraints, undefined, 2)}`
    );

    return contraints;
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

    navigator.mediaDevices
      .getUserMedia({
        // audio: this.getMediaDevicesAudioContraints(),
        audio: {echoCancellation: false, channelCount: 1},
        video: false,
      })
      .then(stream => {
        this.displayUpdate(`Listener Track settings before applied constraints - ${JSON.stringify(stream.getAudioTracks()[0].getSettings(), undefined, 2)}`);
        this.applyHQTrackConstraints(stream)
          .then(settings => {
            console.log(settings);
            this.sendSamplingRate(settings.sampleRate);
            let sampleSize = settings.sampleSize;
            if (!sampleSize){
              sampleSize = this.calibrateSoundSamplingDesiredBits;
            }
            this.sendSampleSize(sampleSize);
            this.sendFlags({
              'autoGainControl':settings.autoGainControl,
              'noiseSuppression':settings.noiseSuppression,
              'echoCancellation':settings.echoCancellation
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
        this.displayUpdate(
          `Listener - Error in getUserMedia - ${JSON.stringify(err, undefined, 2)}`
        );
      });
  };
}

export default Listener;
