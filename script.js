/**
 * VARIABLES
 */

/**
 * Instantiate a new Peer, passing to it an alphanumeric string as an ID and options obj
 * @type {Peer}
 */
 const peer = new Peer(''+Math.floor(Math.random()*2**18).toString(36).padStart(4,0), {
    host: location.hostname,
    debug: 1,
    path: '/'
});

window.peer = peer;

const callBtn = document.querySelector('.call-btn');
const audioContainer = document.querySelector('.call-container');
const hangUpBtn = document.querySelector('.hangup-btn');

let conn;
let code;

/**
 * FUNCTIONS
 */

/**
 * Gets connection code/peer id from caller
 * @returns {string} - the code retrieved
 */
function getStreamCode() {
    code = window.prompt('Please enter the sharing code');
    return code;
}

/**
 * Gets the local audio stream of the current caller
 * @param callbacks - an object to set the success/error behaviour
 * @returns {void}
 */

function getLocalStream() {
    const constraints = {video: false, audio: true}

    navigator.mediaDevices.getUserMedia(constraints).then( stream => {
        setLocalStream(stream);
    }).catch( err => {
        console.log("u got an error:" + err)
    });
}

/**
 * Sets the src of the HTML element on the page to the local stream
 * @param stream
 * @returns {void}
 */

function setLocalStream(stream) {
    window.localAudio.srcObject = stream;
    window.localAudio.autoplay = true;
    window.localStream = stream;
}

/**
 * Sets the src of the HTML element on the page to the remote stream
 * @param stream
 * @returns {void}
 */
function setRemoteStream(stream) {
    window.remoteAudio.srcObject = stream;
    window.remoteAudio.autoplay = true;
    window.peerStream = stream;
}

/**
 * Displays the audio controls and correct copy
 * @returns{void}
 */
function showConnectedContent() {
    window.caststatus.textContent = `You're connected`;
    callBtn.hidden = true;
    audioContainer.hidden = false;
}

/**
 * Displays the call button and peer ID
 * @returns{void}
 */
function showCallContent() {
    window.caststatus.textContent = `Your device ID is: ${peer.id}`;
    callBtn.hidden = false;
    audioContainer.hidden = true;
}

/**
 * Connect the peers
 * @returns {void}
 */

function connectPeers() {
    conn = peer.connect(code)
}

/**
 * EVENTS
 */

/**
 * Get the connection code, connect peers and create a call
 */
callBtn.addEventListener('click', function(){
    console.log('call button clicked');
    getStreamCode();
    connectPeers();
    const call = peer.call(code, window.localStream);
    /**
     * when the call is streaming, set the remote stream for the caller
     */
    call.on('stream', function(stream) {
        console.log('got remote stream');
        setRemoteStream(stream);
        showConnectedContent();
    });
})

/**
 * Close the connection between peers
 */
hangUpBtn.addEventListener('click', function (){
    console.log('hang up button clicked');
    conn.close();
    showCallContent();
})

/**
 * When the peer has connected to the server, diplay the peer ID
 */
peer.on('open', function () {
    console.log('peer open');
    window.caststatus.textContent = `Your device ID is: ${peer.id}`;
});

/**
 * When a data connection between peers is open, get the connecting peer's details
 */
peer.on('connection', function(connection){
    console.log('data connection between peers is open')
    conn = connection;
    peer_id = connection.peer;
});

/**
 * When a call has been created, answer it and set the remote stream for the person being called
 */
peer.on('call', function(call) {
    console.log('call')

    const answerCall = confirm("Do you want to answer?")

    if(answerCall){
        call.answer(window.localStream)
        showConnectedContent();
        call.on('stream', function(stream) {
            setRemoteStream(stream);
        });
        conn.on('close', function (){
            showCallContent();
        })
    } else {
        console.log("call denied");
    }
});

/**
 * Log errors to the console when they occur
 */
peer.on('error', err => console.error(err));

getLocalStream();