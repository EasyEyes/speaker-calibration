import "./listener.css";
import AudioPeer from "./audioPeer";

class Listener extends AudioPeer {
  constructor(listenerParameters = { targetElementId: null }) {
    super(listenerParameters.targetElementId);
    this.startTime = Date.now();
    this.receiverPeerId = null;

    const urlParameters = this.parseURLSearchParams();
    // TODO use `speakerPeerId` in query str produced by speaker.js
    this.speakerPeerId = urlParameters.speakerPeerId;

    this.peer.on("open", this.onPeerOpen);
    this.peer.on("connection", this.onPeerConnection);
    this.peer.on("disconnected", this.onPeerDisconnected);
    this.peer.on("close", this.onPeerClose);
    this.peer.on("error", this.onPeerError);
  }

  onPeerOpen = (id) => {
    console.log("Listener - onPeerOpen");
    // Workaround for peer.reconnect deleting previous id
    if (id === null) {
      console.log("Received null id from peer open");
      this.peer.id = this.lastPeerId;
    } else {
      this.lastPeerId = this.peer.id;
    }
    this.join();
  };

  onPeerConnection = (connection) => {
    console.log("Listener - onPeerConnection");
    // Disallow incoming connections
    connection.on("open", () => {
      connection.send("Sender does not accept incoming connections");
      setTimeout(() => {
        connection.close();
      }, 500);
    });
  };

  onConnData = (data) => {
    console.log("Listener - onConnData");
    // Keypad has received data, namely instructions to update the keypad
    // TODO generalize to a list of properies
    const hasSpeakerID = Object.prototype.hasOwnProperty.call(data, "speakerPeerId");
    if (!hasSpeakerID) {
      console.error(
        'Error in parsing data received! Must set "speakerPeerId" properties'
      );
    } else {
      // this.conn.close();
      console.log(this.speakerPeerId);
      this.speakerPeerId = data.speakerPeerId;
      const newParams = {
        speakerPeerId: this.speakerPeerId,
      };
      /*
      FUTURE does this limit usable environments?
      ie does this work if internet is lost after initial page load?
      */
      window.location.search = this.queryStringFromObject(newParams); // Redirect to correctly constructed keypad page
    }
  };

  join = () => {
    console.log("Listener - join");
    /**
     * Create the connection between the two Peers.
     *
     * Sets up callbacks that handle any events related to the
     * connection and data received on it.
     */
    // Close old connection
    if (this.conn) {
      this.conn.close();
    }
    // Create connection to destination peer specified by the query param
    this.conn = this.peer.connect(this.speakerPeerId, {
      reliable: true,
    });

    this.conn.on("open", () => {
      // console.log("TODO Implement real on connection fn");
      this.openAudioStream();
    });

    // Handle incoming data (messages only since this is the signal sender)
    this.conn.on("data", this.onConnData);
    this.conn.on("close", () => {
      console.log("Connection closed");
    });
  };

  openAudioStream = async () => {
    navigator.mediaDevices
      .getUserMedia({ video: false, audio: true })
      .then((stream) => {
        this.peer.call(this.speakerPeerId, stream); // one-way call
        console.log("Listener - openAudioStream");
      })
      .catch((err) => {
        console.log(`u got an error:${err}`);
      });
  };
}

export default Listener;
