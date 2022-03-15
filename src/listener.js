import AudioPeer from './audioPeer';

/**
 * @class Handles the listener's side of the connection. Responsible for getting access to user's microphone,
 * and initiating a call to the Speaker.
 * @extends AudioPeer
 */
class Listener extends AudioPeer {
  /**
   * Takes a target element where html elements will be appended.
   * @param {initParameters} params - see type definition for initParameters
   */
  constructor(params) {
    super(params);

    this.startTime = Date.now();
    this.receiverPeerId = null;

    const urlParameters = this.parseURLSearchParams();
    this.speakerPeerId = urlParameters.speakerPeerId;

    this.peer.on('open', this.onPeerOpen);
    this.peer.on('connection', this.onPeerConnection);
    this.peer.on('disconnected', this.onPeerDisconnected);
    this.peer.on('close', this.onPeerClose);
    this.peer.on('error', this.onPeerError);
  }

  onPeerOpen = id => {
    this.displayUpdate('Listener - onPeerOpen');
    // Workaround for peer.reconnect deleting previous id
    if (id === null) {
      this.displayUpdate('Received null id from peer open');
      this.peer.id = this.lastPeerId;
    } else {
      this.lastPeerId = this.peer.id;
    }
    this.join();
  };

  onPeerConnection = connection => {
    this.displayUpdate('Listener - onPeerConnection');
    // Disallow incoming connections
    connection.on('open', () => {
      connection.send('Sender does not accept incoming connections');
      setTimeout(() => {
        connection.close();
      }, 500);
    });
  };

  onConnData = data => {
    this.displayUpdate('Listener - onConnData');
    // Keypad has received data, namely instructions to update the keypad
    // TODO generalize to a list of properies
    const hasSpeakerID = Object.prototype.hasOwnProperty.call(data, 'speakerPeerId');
    if (!hasSpeakerID) {
      this.displayUpdate('Error in parsing data received! Must set "speakerPeerId" properties');
    } else {
      // this.conn.close();
      this.displayUpdate(this.speakerPeerId);
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
    this.displayUpdate('Listener - join');
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

    this.conn.on('open', () => {
      // console.log("TODO Implement real on connection fn");
      this.sendSamplingRate();
      this.openAudioStream();
    });

    // Handle incoming data (messages only since this is the signal sender)
    this.conn.on('data', this.onConnData);
    this.conn.on('close', () => {
      console.log('Connection closed');
    });
  };

  sendSamplingRate = () => {
    this.displayUpdate('Listener - sendSamplingRate');
    // const audioCtx = new (window.AudioContext ||
    //   window.webkitAudioContext ||
    //   window.audioContext)();
    this.conn.send({
      name: 'samplingRate',
      payload: 3800, //audioCtx.sampleRate,
    });
  };

  openAudioStream = async () => {
    this.displayUpdate('Listener - openAudioStream');
    navigator.mediaDevices
      .getUserMedia({video: false, audio: true})
      .then(stream => {
        this.peer.call(this.speakerPeerId, stream); // one-way call
        this.displayUpdate('Listener - openAudioStream');
      })
      .catch(err => {
        this.displayUpdate(`You need to grant permission to use the microphone, error:${err}`);
      });
  };
}

export default Listener;
