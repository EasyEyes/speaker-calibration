// get element with id message
import {phrases} from './i18n.js';
const message = document.getElementById('message');
message.style.lineHeight = '2.5rem';
// get url query parameters
const urlParams = new URLSearchParams(window.location.search);

// get isSmartPhone query parameter
const isSmartPhone = urlParams.get('isSmartPhone');

switch (isSmartPhone) {
  case 'true':
    message.innerHTML = phrases.RC_phoneMicrophoneInstructions['en-US'].replace(/\n/g, '<br>');
    break;
  case 'false':
    message.innerHTML = phrases.RC_usbMicrophoneInstructions['en-US'].replace(/\n/g, '<br>');
}

const listenerParameters = {
  targetElementId: 'display',
};
document.getElementById('calibrationBeginButton').onclick = () => {
  window.listener = new speakerCalibrator.Listener(listenerParameters);
  console.log(window.listener);
  document.querySelector('#calibrationBeginButton').style.display = 'none';

  const recordingInProgress = phrases.RC_soundRecording['en-US'];
  const backToExperimentWindow = phrases.RC_backToExperimentWindow['en-US'];
  document.querySelector('#message').innerHTML = recordingInProgress;
  document.querySelector('#message').style.fontSize = '2em';

  console.log('isSmartPhone', isSmartPhone);
  console.log('isNotSmartPhone', !isSmartPhone);
  switch (isSmartPhone) {
    case 'false':
      const p = document.createElement('p');
      p.innerHTML = backToExperimentWindow;
      p.style.fontSize = '0.7em';
      document.querySelector('#message').appendChild(p);
      break;
    case 'true':
      break;
  }
};
// double the size of #message

// enter key press
document.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    window.listener = new speakerCalibrator.Listener(listenerParameters);
    console.log(window.listener);
    document.querySelector('#calibrationBeginButton').style.display = 'none';
    document.querySelector('#message').innerHTML =
      phrases.RC_soundRecording['en-US'] + '\n' + isSmartPhone
        ? ''
        : phrases.RC_backToExperimentWindow['en-US'];
    document.querySelector('#message').style.fontSize = '2em';
  }
});
