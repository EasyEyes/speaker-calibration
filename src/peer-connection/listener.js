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
    this.microphoneFromAPI = params.microphoneFromAPI ? params.microphoneFromAPI : '';
    this.microphoneDeviceId = params.microphoneDeviceId ? params.microphoneDeviceId : '';
    // this.deviceInfoFromUser = params.deviceInfoFromUser
    //   ? params.deviceInfoFromUser
    //   : {modelNumber: '', modelName: ''};
    this.startTime = Date.now();
    this.receiverPeerId = null;

    this.calibrateSoundHz = params.hz;
    this.calibrateSoundSamplingDesiredBits = params.bits;
    this.speakerPeerId = params.speakerPeerId;
    this.lastPeerId = this.speakerPeerId;
    this.connOpen = false;

    this.connectionManager = null;
  }

  startCalibration = async (deviceInfo = {}) => {
    await this.getDeviceInfo(deviceInfo);
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
    this.connectionManager.send({
      name: 'SoundCalibration',
      payload: {
        name: 'samplingRate',
        payload: sampleRate,
      },
    });
  };

  sendSampleSize = sampleSize => {
    this.connectionManager.send({
      name: 'SoundCalibration',
      payload: {
        name: 'sampleSize',
        payload: sampleSize,
      },
    });
  };

  sendFlags = flags => {
    this.connectionManager.send({
      name: 'SoundCalibration',
      payload: {
        name: 'flags',
        payload: flags,
      },
    });
  };

  sendPermissionStatus = status => {
    this.connectionManager.send({
      name: 'SoundCalibration',
      payload: {
        name: 'permissionStatus',
        payload: status,
      },
    });
  };

  getDeviceInfo = async (deviceInfo = {}) => {
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
    // deviceInfo['microphoneFromAPI'] = this.microphoneFromAPI;
    // deviceInfo['microphoneDeviceId'] = this.microphoneDeviceId;
    deviceInfo['screenWidth'] = window.screen.width;
    deviceInfo['screenHeight'] = window.screen.height;
    console.log('deviceInfo Inside getDeviceInfo: ', deviceInfo);
    this.connectionManager.send({
      name: 'SoundCalibration',
      payload: {
        name: 'deviceInfo',
        payload: deviceInfo,
      },
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
    this.displayUpdate('Listener - openAudioStream', false);
    const mobileOS = this.getMobileOS();
    if (process.env.NODE_ENV !== 'development' && mobileOS !== 'iOS') {
      const err = new UnsupportedDeviceError(`${mobileOS} is not supported`);
      this.connectionManager.send({
        name: 'SoundCalibration',
        payload: {
          name: err.name,
          payload: err,
        },
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
            this.connectionManager.peer.call(this.speakerPeerId, stream); // one-way call
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
