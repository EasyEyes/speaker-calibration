// import { QRCode  } from "qrcode";
var QRCode = require("qrcode");
import "./speaker.css";
import { AudioPeer } from "./audioPeer.js";

class Speaker extends AudioPeer {
  constructor(
    initParameters = {
      targetElementId: null,
      // siteURL: null,
    }
  ) {
    super(initParameters.targetElementId);
    this.siteUrl = window.location.href + '/listener?';

    /* Set up callbacks that handle any events related to our peer object. */
    this.peer.on("open", this.#onPeerOpen);
    this.peer.on("connection", this.#onPeerConnection);
    this.peer.on("disconnected", this.onPeerDisconnected);
    this.peer.on("close", this.onPeerClose);
    this.peer.on("error", this.onPeerError);
  }

  /**
   * Callback method for when a peer connection is opened
   * Creates a QR code with the peer id and displays it
   * @param {*} id 
   */
  #onPeerOpen = (id) => {
    // Workaround for peer.reconnect deleting previous id
    if (id === null) {
      this.displayUpdate("Received null id from peer open");
      this.peer.id = this.lastPeerId;
    } else {
      this.lastPeerId = this.peer.id;
    }

    if (id !== this.peer.id) {
      alert("DEBUG Check you assumption that id === this.peer.id");
    }

    // Get query string, the URL parameters to specify a Listener
    const queryStringParameters = {
      speakerPeerId: this.peer.id,
    };
    let queryString = this.queryStringFromObject(queryStringParameters);
    const uri = this.siteUrl + queryString;

    // Display QR code for the participant to scan
    const qrCanvas = document.createElement("canvas");
    qrCanvas.setAttribute("id", "qrCanvas");
    console.log(uri);
    QRCode.toCanvas(qrCanvas, uri, function (error) {
      if (error) console.error(error);
    });

    // If specified HTML Id is available, show QR code there
    if (!!document.getElementById(this.targetElement)) {
      document.getElementById(this.targetElement).appendChild(qrCanvas);
    } else {
      // or just print it to console
      console.log("Peer reachable at: ", uri);
    }
  };

  /**
   * Callback method for when a peer connection is established
   * Enforces that only one connection is established
   * @param {*} connection 
   * @returns 
   */
  #onPeerConnection = (connection) => {
    // Allow only a single connection
    if (this.conn && this.conn.open) {
      connection.on("open", function () {
        connection.send("Already connected to another client");
        setTimeout(function () {
          connection.close();
        }, 500);
      });
      return;
    }
    this.conn = connection;
    this.displayUpdate("Connected to: ", this.conn.peer);
    this.#ready();
  };

  /**
   * Helper method that defines callbacks to handle incoming data and connection events
   */
  #ready = () => {
    // Perform callback with data
    this.conn.on("data", this.#onIncomingData);
    this.conn.on("close", () => {
      this.displayUpdate("Connection reset<br>Awaiting connection...");
      this.conn = null;
    });

    // Start playing calibration noises
    calibrateAudio(this.conn);
  };

  /**
   * Callback method for when data is received from the peer
   * 
   * @param {*} data 
   */
  #onIncomingData = (data) => {
    // Get data, eg audio analysis results, from the user's mobile device
    data.timeStoredBySpeaker = Date.now();
    this.dataStore.push(data);
    // TODO in listener.js, use data.msg to specify message type
    switch (data.msg) {
      case "handshakeOK":
        console.log("Handshake OK");
        break;
      default:
        console.log("Data received from Listener peer!", data);
        break;
    }
  };
  
  #calibrateAudio = (connection) => {
    // Called once the connection to the Listener peer is up and usable.
    // TODO actually make the correct sounds
    // Actually play the sounds [3]
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    const duration = 2000;
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration / 1000);

    this.displayUpdate("PLAYING SOUND");
  };
}
/* 
Referenced links:
https://stackoverflow.com/questions/28016664/when-you-pass-this-as-an-argument/28016676#28016676
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes
https://stackoverflow.com/questions/879152/how-do-i-make-javascript-beep [3]
*/

export { Speaker };
