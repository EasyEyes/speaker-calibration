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
    message.innerHTML =
      `${phrases.RC_removeHeadphones['en-US']} ${phrases.RC_getPhoneMicrophoneReady['en-US']}`.replace(
        /\n/g,
        '<br>'
      );
    break;
  case 'false':
    message.innerHTML =
      `${phrases.RC_removeHeadphones['en-US']} ${phrases.RC_getUSBMicrophoneReady['en-US']}`.replace(
        /\n/g,
        '<br>'
      );
}
