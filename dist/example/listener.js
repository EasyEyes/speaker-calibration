// get element with id message
import {phrases} from './i18n.js';
// get url query parameters
const urlParams = new URLSearchParams(window.location.search);

// get isSmartPhone query parameter
const isSmartPhone = urlParams.get('sp'); // previous isSmartPhone

const listenerParameters = {
  targetElementId: 'display',
  microphoneFromAPI: '',
  microphoneDeviceId: '',
};

const container = document.getElementById('listenerContainer');
const recordingInProgress = phrases.RC_soundRecording['en-US'];
const backToExperimentWindow = phrases.RC_backToExperimentWindow['en-US'];
const allowMicrophone = phrases.RC_allowMicrophoneUse['en-US'].replace(/\n/g, '<br>');
const placeSmartphoneMicrophone = phrases.RC_placeSmartphoneMicrophone['en-US'].replace(
  /\n/g,
  '<br>'
);
const turnMeToReadBelow = phrases.RC_turnMeToReadBelow['en-US'].replace(/\n/g, '<br>');
const recordingInProgressElement = document.getElementById('recordingInProgress');
const allowMicrophoneElement = document.getElementById('allowMicrophone');
const turnMessageElement = document.getElementById('turnMeToReadBelow');

switch (isSmartPhone) {
  case 'true':
    allowMicrophoneElement.innerHTML = placeSmartphoneMicrophone;
    allowMicrophoneElement.style.lineHeight = '1.2rem';
    allowMicrophoneElement.style.fontSize = '14px';
    turnMessageElement.innerHTML = turnMeToReadBelow;
    turnMessageElement.style.lineHeight = '1.2rem';
    turnMessageElement.style.fontSize = '14px';
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
    console.log('Waiting for proceed button click');

    calibrationBeginButton.addEventListener('click', async () => {
      console.log('Proceed button clicked');

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

      console.log('Adjusting font size for recording in progress text');
      while (recordingInProgressElement.scrollWidth > window.innerWidth * 0.9 && fontSize > 10) {
        fontSize--;
        recordingInProgressElement.style.fontSize = fontSize + 'px';
      }
      console.log('Done adjusting font size for recording in progress text');
      const webAudioDeviceNames = {microphone: '', deviceID: ''};
      const externalMicList = ['UMIK', 'Airpods', 'Bluetooth'];
      try {
        console.log('Getting user media...Should ask for microphone permission');
        const stream = await navigator.mediaDevices.getUserMedia({audio: true});
        console.log('Got user media');
        if (stream) {
          console.log('Getting devices');
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
      listenerParameters.microphoneDeviceId = webAudioDeviceNames.microphone;
      let lock = null;
      try {
        if ('wakeLock' in navigator) {
          lock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.log(err);
      }
      console.log(lock);
      console.log('Starting Calibration');
      console.log('Device id in example listenr:',listenerParameters.microphoneDeviceId);
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
      listenerParameters.microphoneDeviceId = urlParams.get('deviceId');
      window.listener = new speakerCalibrator.Listener(listenerParameters);
      console.log(window.listener);
    });
    break;
}
