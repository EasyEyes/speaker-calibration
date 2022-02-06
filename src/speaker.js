// import { QRCode  } from "qrcode";
var QRCode = require("qrcode");
import "./speaker.css";
import { AudioPeer } from "./audioPeer.js";

class Speaker extends AudioPeer {
  constructor(
    initParameters = {
      targetElementId: null,
      siteUrl: null,
    }
  ) {
    super(initParameters);
    //console.log(initParameters.siteUrl);
    this.siteUrl += "/listener?";
    this.mediaRecorder = null;
    this.audioCtx = null;
    this.canvas = null;
    this.canvasCtx = null;

    /* Set up callbacks that handle any events related to our peer object. */
    this.peer.on("open", this.onPeerOpen);
    this.peer.on("connection", this.onPeerConnection);
    this.peer.on("call", this.onPeerCall);
    this.peer.on("close", this.onPeerClose);
    this.peer.on("disconnected", this.onPeerDisconnected);
    this.peer.on("error", this.onPeerError);
  }

  onPeerOpen = (id) => {
    console.log("Speaker - onPeerOpen");
    // Workaround for peer.reconnect deleting previous id
    if (id === null) {
      console.log("Received null id from peer open");
      this.peer.id = this.lastPeerId;
    } else {
      this.lastPeerId = this.peer.id;
    }

    if (id !== this.peer.id) {
      alert("DEBUG Check you assumption that id === this.peer.id");
    }

    this.showQRCode();
  };

  showQRCode = () => {
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
      console.log("TEST: Peer reachable at: ", uri);
    }
  };

  onPeerConnection = (connection) => {
    console.log("Speaker - onPeerConnection");

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
    console.log("Connected to: ", this.conn.peer);
    this.ready();
  };

  onPeerCall = (call) => {
    call.answer(); // Answer the call (one way)
    this.createLocalAudio();
    call.on("stream", this.onReceiveStream);
  };

  onReceiveStream = (stream) => {
    console.log("Speaker - onPeerCall - stream");
    window.localStream = stream;
    window.localAudio.srcObject = stream; // B
    window.localAudio.autoplay = true; // C
    this.startRecording(stream);
  };

  createLocalAudio = () => {
    const localAudio = document.createElement("audio");
    localAudio.setAttribute("id", "localAudio");
    document.getElementById(this.targetElement).appendChild(localAudio);
  }

  startRecording = (stream) => {
    console.log("Speaker - startRecording");
    // this.mediaRecorder = new MediaRecorder(stream);
    console.log({stream})
    this.visualize(stream);
    //this.mediaRecorder.start();
    //this.mediaRecorder.ondataavailable = (e) => {
    //  console.log("recorder ondataavailable");
    //  this.dataStore.push(e.data);
    //};
  };

  stopRecording = () => {
    this.mediaRecorder.stop();
    this.mediaRecorder.onstop = (e) => {
      const clipName = prompt("Enter a name for your sound clip");

      const clipContainer = document.createElement("article");
      const clipLabel = document.createElement("p");
      const audio = document.createElement("audio");
      const deleteButton = document.createElement("button");

      clipContainer.classList.add("clip");
      audio.setAttribute("controls", "");
      deleteButton.innerHTML = "Delete";
      clipLabel.innerHTML = clipName;

      clipContainer.appendChild(audio);
      clipContainer.appendChild(clipLabel);
      clipContainer.appendChild(deleteButton);
      document.getElementById(this.targetElement).appendChild(clipContainer);

      const blob = new Blob(this.dataStore, { type: "audio/ogg; codecs=opus" });
      this.dataStore = [];
      const audioURL = window.URL.createObjectURL(blob);
      audio.src = audioURL;

      deleteButton.onclick = function (e) {
        let evtTgt = e.target;
        evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
      };
    };
  };

  onPeerClose = () => {
    this.conn = null;
    console.log("Connection destroyed");
  };

  onPeerDisconnected = () => {
    console.log("Connection lost. Please reconnect");

    // Workaround for peer.reconnect deleting previous id
    this.peer.id = this.lastPeerId;
    this.peer._lastServerId = this.lastPeerId;
    this.peer.reconnect();
  };

  onPeerError = (error) => {
    console.log(error);
  };

  ready = () => {
    console.log("Speaker - ready");
    // Perform callback with data
    this.conn.on("data", this.onIncomingData);
    this.conn.on("close", () => {
      console.log("Connection reset<br>Awaiting connection...");
      this.conn = null;
    });

    // Start playing calibration noises
    //this.calibrateAudio(this.conn);
  };

  onIncomingData = (data) => {
    console.log("Speaker - onIncomingData");
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

  calibrateAudio = async (connection) => {
    console.log("Speaker - calibrateAudio");
    // Called once the connection to the Listener peer is up and usable.
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    console.log("PLAYING SOUND");

    const duration = 2000;
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration / 1000);

    setTimeout(() => {
      this.stopRecording();
      console.log(this.dataStore);
    }, duration * 2);
  };

  visualize(stream) {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }

    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvasCtx = this.canvas.getContext("2d");
      document.getElementById(this.targetElement).appendChild(this.canvas);
    }

    const source = this.audioCtx.createMediaStreamSource(stream);
    const analyser = this.audioCtx.createAnalyser();

    analyser.fftSize = 2048;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    //analyser.connect(audioCtx.destination);

    const draw = () => {
      const WIDTH = this.canvas.width;
      const HEIGHT = this.canvas.height;

      requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      this.canvasCtx.fillStyle = "rgb(200, 200, 200)";
      this.canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      this.canvasCtx.lineWidth = 2;
      this.canvasCtx.strokeStyle = "rgb(0, 0, 0)";

      this.canvasCtx.beginPath();

      let sliceWidth = (WIDTH * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        let v = dataArray[i] / 128.0;
        let y = (v * HEIGHT) / 2;

        if (i === 0) {
          this.canvasCtx.moveTo(x, y);
        } else {
          this.canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      this.canvasCtx.lineTo(this.canvas.width, this.canvas.height / 2);
      this.canvasCtx.stroke();
    };

    draw();
  }
}
/* 
Referenced links:
https://stackoverflow.com/questions/28016664/when-you-pass-this-as-an-argument/28016676#28016676
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes
https://stackoverflow.com/questions/879152/how-do-i-make-javascript-beep [3]
*/

export { Speaker };
