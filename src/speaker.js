import './speaker.css';
import AudioPeer from './audioPeer';
import AudioCalibrator from './audioCalibrator';

const QRCode = require('qrcode');

class Speaker extends AudioPeer {
  constructor(
    initParameters = {
      targetElementId: null,
      siteUrl: null,
    }
  ) {
    super(initParameters);

    this.siteUrl += '/listener?';
    this.ac = new AudioCalibrator();

    /* Set up callbacks that handle any events related to our peer object. */
    this.peer.on('open', this.onPeerOpen);
    this.peer.on('connection', this.onPeerConnection);
    this.peer.on('call', this.onPeerCall);
    this.peer.on('close', this.onPeerClose);
    this.peer.on('disconnected', this.onPeerDisconnected);
    this.peer.on('error', this.onPeerError);
  }

  /**
   * Called after the peer conncection has been opened.
   * Generates a QR code for the connection and displays it.
   */
  showQRCode = () => {
    // this.ac.test();
    // Get query string, the URL parameters to specify a Listener
    const queryStringParameters = {
      speakerPeerId: this.peer.id,
    };
    const queryString = this.queryStringFromObject(queryStringParameters);
    const uri = this.siteUrl + queryString;

    // Display QR code for the participant to scan
    const qrCanvas = document.createElement('canvas');
    qrCanvas.setAttribute('id', 'qrCanvas');
    console.log(uri);
    QRCode.toCanvas(qrCanvas, uri, error => {
      if (error) console.error(error);
    });

    // If specified HTML Id is available, show QR code there
    if (document.getElementById(this.targetElement)) {
      document.getElementById(this.targetElement).appendChild(qrCanvas);
    } else {
      // or just print it to console
      console.log('TEST: Peer reachable at: ', uri);
    }
  };

  /**
   * Called when the peer connection is opened.
   * Saves the peer id and calls the QR code generator.
   * @param {Object} peerConnection - The peer connection object.
   */
  onPeerOpen = id => {
    // Workaround for peer.reconnect deleting previous id
    if (id === null) {
      console.error('Received null id from peer open');
      this.peer.id = this.lastPeerId;
    } else {
      this.lastPeerId = this.peer.id;
    }

    if (id !== this.peer.id) {
      console.warn('DEBUG Check you assumption that id === this.peer.id');
    }

    this.showQRCode();
  };

  onPeerConnection = connection => {
    console.log('Speaker - onPeerConnection');

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
    this.ready();
  };

  /**
   * Called after a call is established and data is flowing.
   * Sets up the local audio stream and starts the calibration process.
   * @param {MediaStream} stream - The stream of audio from the Listener.
   */
  onReceiveStream = stream => {
    window.localStream = stream;
    window.localAudio.srcObject = stream;
    window.localAudio.autoplay = true;

    // Start calibration
    if (!this.ac.getCalibrationStatus()) {
      this.ac.startCalibration(stream);
    }
  };

  /**
   * Called when a call is made by the Listener.
   * Answers the call in a one-way manner, and sets up a stream listener.
   * @param {*} call
   */
  onPeerCall = call => {
    call.answer(); // Answer the call (one way)
    this.ac.createLocalAudio(document.getElementById(this.targetElement));
    call.on('stream', this.onReceiveStream);
  };

  onPeerClose = () => {
    this.conn = null;
    console.log('Connection destroyed');
  };

  onPeerDisconnected = () => {
    console.log('Connection lost. Please reconnect');

    // Workaround for peer.reconnect deleting previous id
    this.peer.id = this.lastPeerId;
    // eslint-disable-next-line no-underscore-dangle
    this.peer._lastServerId = this.lastPeerId;
    this.peer.reconnect();
  };

  onPeerError = error => {
    console.log(error);
  };

  onIncomingData = data => {
    console.log({data});
  };

  ready = () => {
    // Perform callback with data
    this.conn.on('data', this.onIncomingData);
    this.conn.on('close', () => {
      console.log('Connection reset<br>Awaiting connection...');
      this.conn = null;
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
