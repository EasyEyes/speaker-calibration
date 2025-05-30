import Peer from 'peerjs';

// TODO: this was already here before, but appears to be unused
const pressFeedbackURI =
  'data:audio/mpeg;base64,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VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//uSZIIP9BFGHYksMlIAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';

/**
 * @typedef initParameters - Parameters for initializing the AudioPeer
 * @type {object}
 * @property {string} targetElementId - Target element where new elements will be appended.
 * @property {string} siteUrl: The url of the current site.
 */
const initParameters = {
  targetElementId: null,
  siteUrl: null,
};

/**
 * @class The first layer of abstraction on the PeerJS library.
 * It meant to be extended by the two seperate client classes, Speaker and Listener.
 * It implements the shared methods and properties of both classes.
 */
class AudioPeer {
  /**
   * Creates an instance of AudioPeer
   * Takes the url of the current site and a target element where html elements will be appended.
   *
   * @param params - See type definition for initParameters.
   * @param param
   * @example
   */
  constructor(param = initParameters) {
    // Display information to HTML elem with given id
    this.targetElement = param.targetElementId;

    this.siteUrl = param.siteUrl;
    this.debug = false;
    // Store for all incoming data
    this.dataStore = [];

    // Create and play sounds using this audio context
    this.sourceAudioContext = new (window.AudioContext ||
      window.webkitAudioContext ||
      window.audioContext)();
  }

  /** .
   * .
   * .
   * Helper method to display information to DOM element
   *
   * @param {string} message
   * @param {boolean} append
   * @example
   */
  displayUpdate = (message, append = true) => {
    // If the specified elem exists, update that elem
    if (document.getElementById(this.targetElement)) {
      const displayElement = document.getElementById(this.targetElement);
      if (append) {
        displayElement.innerText += `\n${message}`;
      } else {
        displayElement.innerText = message;
      }
    } else {
      console.log('MESSAGE: ', message);
    }
  };

  /** .
   * .
   * .
   * Helper method that converts url paramters to an object
   *
   * @returns {object}
   * @example
   */
  parseURLSearchParams = () =>
    // SOURCE: chickens, https://stackoverflow.com/questions/8648892/how-to-convert-url-parameters-to-a-javascript-object
    // eslint-disable-next-line no-restricted-globals
    Object.fromEntries(new URLSearchParams(location.search));

  /** .
   * .
   * .
   * Helper method that converts an object to a query string
   *
   * @param {object} params
   * @returns {string}
   * @example
   */
  queryStringFromObject = params =>
    Object.keys(params)
      .map(key => `${key}=${params[key]}`)
      .join('&');

  static keypressFeedbackSound = pressFeedbackURI;
}

export default AudioPeer;
