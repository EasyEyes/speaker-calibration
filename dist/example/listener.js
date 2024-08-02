// get element with id message
import {phrases} from './i18n.js';
// get url query parameters
const urlParams = new URLSearchParams(window.location.search);

// get isSmartPhone query parameter
const isSmartPhone = urlParams.get('isSmartPhone');

const listenerParameters = {
  targetElementId: 'display',
  microphoneFromAPI: '',
  microphoneDeviceId: '',
};

const container = document.getElementById('listenerContainer');
const recordingInProgress = phrases.RC_soundRecording['en-US'];
const backToExperimentWindow = phrases.RC_backToExperimentWindow['en-US'];
const allowMicrophone = phrases.RC_allowMicrophoneUse['en-US'];
const placeSmartphoneMicrophone = phrases.RC_placeSmartphoneMicrophone['en-US'];
const turnMeToReadBelow = phrases.RC_turnMeToReadBelow['en-US'];
const recordingInProgressElement = document.getElementById('recordingInProgress');
const allowMicrophoneElement = document.getElementById('allowMicrophone');
const turnMessageElement = document.getElementById('turnMeToReadBelow');

switch (isSmartPhone) {
  case 'true':
    allowMicrophoneElement.innerHTML = placeSmartphoneMicrophone;
    turnMessageElement.innerHTML = turnMeToReadBelow;
    // show the html upsidedown
    const phrasesContainer = document.getElementById('phrases');
    // add class
    phrasesContainer.classList.add('phrases');
    const html = document.querySelector('html');
    html.style.overflow = 'hidden';
    const display = document.getElementById('updateDisplay');
    display.classList.add('updateDisplay');
    container.style.display = 'block';
    // event listener for id calibrationBeginButton
    const calibrationBeginButton = document.getElementById('calibrationBeginButton');
    const intervalId = setInterval(() => {
      console.log(calibrationBeginButton);
    }, 10000);
    calibrationBeginButton.addEventListener('click', async () => {
      clearInterval(intervalId);
      // remove the button
      calibrationBeginButton.remove();
      // remove turn message
      turnMessageElement.remove();
      // set the text of the html elements
      recordingInProgressElement.innerHTML = recordingInProgress;
      allowMicrophoneElement.innerHTML = allowMicrophone;

      recordingInProgressElement.style.whiteSpace = 'nowrap';
      recordingInProgressElement.style.fontWeight = 'bold';
      // fit content
      recordingInProgressElement.style.width = 'fit-content';
      let fontSize = 100;
      recordingInProgressElement.style.fontSize = fontSize + 'px';

      while (recordingInProgressElement.scrollWidth > window.innerWidth * 0.9 && fontSize > 10) {
        fontSize--;
        recordingInProgressElement.style.fontSize = fontSize + 'px';
      }
      const webAudioDeviceNames = {microphone: '', deviceID: ''};
      const externalMicList = ['UMIK', 'Airpods', 'Bluetooth'];
      try {
        const stream = await navigator.mediaDevices.getUserMedia({audio: true});
        if (stream) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          console.log(devices);
          const mics = devices.filter(device => device.kind === 'audioinput');
          mics.forEach(mic => {
            if (externalMicList.some(externalMic => mic.label.includes(externalMic))) {
              webAudioDeviceNames.microphone = mic.label;
              webAudioDeviceNames.deviceID = mic.deviceId;
            }
          });
          if (webAudioDeviceNames.microphone === '') {
            webAudioDeviceNames.microphone = mics[0].label;
            webAudioDeviceNames.deviceID = mics[0].deviceId;
          }
        }
      } catch (err) {
        console.log(err);
      }
      listenerParameters.microphoneFromAPI = webAudioDeviceNames.microphone;
      listenerParameters.microphoneDeviceId = webAudioDeviceNames.deviceID;
      let lock = null;
      try {
        if ('wakeLock' in navigator) {
          lock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.log(err);
      }
      console.log(lock);
      window.listener = new speakerCalibrator.Listener(listenerParameters);
      console.log(window.listener);
      if (lock) {
        lock.release();
      }
    });
    break;
  case 'false':
    // remove the button
    const calibrationBeginButton2 = document.getElementById('calibrationBeginButton');
    calibrationBeginButton2.remove();
    container.style.display = 'block';
    // event listener for when the page is loaded
    window.addEventListener('load', () => {
      // set the text of the html elements
      recordingInProgressElement.innerHTML = recordingInProgress;
      allowMicrophoneElement.innerHTML = allowMicrophone;

      recordingInProgressElement.style.whiteSpace = 'nowrap';
      recordingInProgressElement.style.fontWeight = 'bold';

      // fit content
      recordingInProgressElement.style.width = 'fit-content';
      let fontSize = 100;
      recordingInProgressElement.style.fontSize = fontSize + 'px';

      while (recordingInProgressElement.scrollWidth > window.innerWidth * 0.9 && fontSize > 10) {
        fontSize--;
        recordingInProgressElement.style.fontSize = fontSize + 'px';
      }
      const message = document.getElementById('message');
      message.style.lineHeight = '2.5rem';
      const p = document.createElement('p');
      p.innerHTML = backToExperimentWindow;
      message.appendChild(p);
      window.listener = new speakerCalibrator.Listener(listenerParameters);
      console.log(window.listener);
    });
    break;
}
