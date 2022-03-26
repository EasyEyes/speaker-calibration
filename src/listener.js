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
      this.displayUpdate('Closing old connection');
      this.conn.close();
    }

    // Create connection to destination peer specified by the query param
    this.displayUpdate(`Creating connection to: ${this.speakerPeerId}`);
    this.conn = this.peer.connect(this.speakerPeerId, {
      reliable: true,
    });

    this.displayUpdate('Created connection');

    this.conn.on('open', () => {
      this.displayUpdate('Listener - conn open');
      // this.sendSamplingRate();
      this.openAudioStream();
    });

    // Handle incoming data (messages only since this is the signal sender)
    this.conn.on('data', this.onConnData);
    this.conn.on('close', () => {
      console.log('Connection closed');
    });
  };

  sendSamplingRate = stream => {
    this.displayUpdate('Listener - sendSamplingRate');
    const track = stream.getAudioTracks()[0];
    const capabilities = track.getCapabilities();
    this.conn.send({
      name: 'samplingRate',
      payload: capabilities.sampleRate,
    });
  };

  openAudioStream = async () => {
    this.displayUpdate('Listener - openAudioStream');
    const mediaStreamConstraints = {
      audio: {
        sampleRate: { ideal: 48000 },
      },
      video: false,
    };
    navigator.mediaDevices
      .getUserMedia(mediaStreamConstraints)
      .then(stream => {
        this.sendSamplingRate(stream);
        this.peer.call(this.speakerPeerId, stream); // one-way call
        this.displayUpdate('Listener - openAudioStream');
      })
      .catch(err => {
        console.log(err);
        this.displayUpdate(`You need to grant permission to use the microphone, error:${err}`);
      });
  };
}

export default Listener;
