import "./listener.css";
import { AudioPeer } from "./audioPeer.js";

class Listener extends AudioPeer {
  constructor( listenerParameters = { targetElementId: null }) {
    super( listenerParameters.targetElementId );
    this.startTime = Date.now();
    this.receiverPeerId = null;

    const urlParameters =  this.parseURLSearchParams();
    // TODO use `speakerPeerId` in query str produced by speaker.js
    this.speakerPeerId = urlParameters.speakerPeerId;

    this.peer.on("open", this.#onPeerOpen);
    this.peer.on("connection", this.#onPeerConnection);
    this.peer.on("disconnected", this.onPeerDisconnected);
    this.peer.on("close", this.onPeerClose);
    this.peer.on("error", this.onPeerError);
  };
  #onPeerOpen = (id) => {
    // Workaround for peer.reconnect deleting previous id
    if (id === null) {
      console.log("Received null id from peer open");
      this.peer.id = this.lastPeerId;
    } else {
      this.lastPeerId = this.peer.id;
    }
    this.#join();
  };
  #onPeerConnection = (connection) => {
    // Disallow incoming connections
    connection.on("open", function () {
      connection.send("Sender does not accept incoming connections");
      setTimeout(function () {
        connection.close();
      }, 500);
    });
  };
  #onConnData = (data) => {
    // Keypad has received data, namely instructions to update the keypad
    // TODO generalize to a list of properies
    if ( !data.hasOwnProperty("speakerPeerId") ) {
      console.error(
        'Error in parsing data received! Must set "speakerPeerId" properties'
      );
    } else {
      this.conn.close();
      if (data.hasOwnProperty("speakerPeerId")) {
        this.speakerPeerId = data["speakerPeerId"];
      }
      let newParams = {
        speakerPeerId: this.speakerPeerId
      };
      /*
      FUTURE does this limit usable environments?
      ie does this work if internet is lost after initial page load?
      */
      window.location.search = this.queryStringFromObject(newParams); // Redirect to correctly constructed keypad page
    }
  };
  #join = () => {
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
    this.conn = this.peer.connect(this.receiverPeerId, {
      reliable: true,
    });

    this.conn.on("open", () => {console.log("TODO Implement real on connection fn")});
    // Handle incoming data (messages only since this is the signal sender)
    this.conn.on("data", this.#onConnData);
    this.conn.on("close", function () {
      console.log("Connection closed");
    });
  };
};

export { Listener };
