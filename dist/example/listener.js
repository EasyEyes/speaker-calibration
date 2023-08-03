// get element with id message
import {phrases} from './i18n.js';

// get url query parameters
const urlParams = new URLSearchParams(window.location.search);

// get isSmartPhone query parameter
const isSmartPhone = urlParams.get('isSmartPhone');

const listenerParameters = {
  targetElementId: 'display',
};

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
    try {
      window.screen.orientation.onchange = () => {
        console.log('orientation changed');
        console.log(window.screen.orientation.type);
      };
      await window.screen.orientation.lock('portrait');
    } catch (err) {
      console.log(err);
    }
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
    // event listener for id calibrationBeginButton
    const calibrationBeginButton = document.getElementById('calibrationBeginButton');
    calibrationBeginButton.addEventListener('click', () => {
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
      window.listener = new speakerCalibrator.Listener(listenerParameters);
      console.log(window.listener);
    });
    break;
  case 'false':
    // remove the button
    const calibrationBeginButton2 = document.getElementById('calibrationBeginButton');
    calibrationBeginButton2.remove();
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
