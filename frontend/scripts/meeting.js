const socket = io();
const roomId = "default-room"; // Static room for now
let localStream;
const peers = {};

async function startMeeting() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("local-video").srcObject = localStream;
    socket.emit("join-room", roomId);
}

function toggleAudio() {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;

    document.getElementById("toggle-audio").innerHTML = audioTrack.enabled
        ? '<i class="fas fa-microphone"></i><span>Mute</span>'
        : '<i class="fas fa-microphone-slash"></i><span>Unmute</span>';
}

// let localStream;

async function toggleVideo() {
    const videoButton = document.getElementById("toggle-video");
    const videoElement = document.getElementById("local-video");

    if (!localStream || !localStream.getVideoTracks().length) {
        try {
            // Get a new video stream if it doesn't exist
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            videoElement.srcObject = localStream;
            videoButton.innerHTML = '<i class="fas fa-video"></i><span>Stop Video</span>';
        } catch (error) {
            console.error("Error accessing camera:", error);
            alert("Unable to access camera. Please check your settings.");
        }
        return;
    }

    const videoTrack = localStream.getVideoTracks()[0];

    if (videoTrack.enabled) {
        videoTrack.stop(); // Completely stop the track
        localStream.removeTrack(videoTrack);
        videoElement.srcObject = null; // Clear the video element
        videoButton.innerHTML = '<i class="fas fa-video-slash"></i><span>Start Video</span>';
    } else {
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newVideoTrack = newStream.getVideoTracks()[0];

            localStream.addTrack(newVideoTrack);
            videoElement.srcObject = localStream;

            videoButton.innerHTML = '<i class="fas fa-video"></i><span>Stop Video</span>';
        } catch (error) {
            console.error("Error accessing camera:", error);
            alert("Unable to access camera. Please check your settings.");
        }
    }
}




document.getElementById("toggle-audio").addEventListener("click", toggleAudio);
document.getElementById("toggle-video").addEventListener("click", toggleVideo);

socket.on("user-joined", (peerId) => {
    const peerConnection = new RTCPeerConnection();
    peers[peerId] = peerConnection;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", { roomId, candidate: event.candidate, sender: socket.id });
        }
    };

    peerConnection.ontrack = (event) => {
        let remoteVideo = document.createElement("video");
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        remoteVideo.srcObject = event.streams[0];
        document.getElementById("participants-grid").appendChild(remoteVideo);
    };

    peerConnection.createOffer().then(offer => {
        peerConnection.setLocalDescription(offer);
        socket.emit("offer", { roomId, offer, sender: socket.id });
    });
});

socket.on("offer", async ({ offer, sender }) => {
    const peerConnection = new RTCPeerConnection();
    peers[sender] = peerConnection;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", { roomId, candidate: event.candidate, sender: socket.id });
        }
    };

    peerConnection.ontrack = (event) => {
        let remoteVideo = document.createElement("video");
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        remoteVideo.srcObject = event.streams[0];
        document.getElementById("participants-grid").appendChild(remoteVideo);
    };

    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", { roomId, answer, sender: socket.id });
});

socket.on("answer", ({ answer, sender }) => {
    peers[sender].setRemoteDescription(answer);
});

socket.on("ice-candidate", ({ candidate, sender }) => {
    peers[sender]?.addIceCandidate(candidate);
});

startMeeting();