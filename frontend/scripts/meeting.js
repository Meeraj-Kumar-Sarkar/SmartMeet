const socket = io();
const roomId = "default-room"; // Static room for now
let localStream;
const peers = {};
let meetingStartTime;
let timerInterval;
let recognition;
let recognizing = false;
let fullText = ""; // Stores the complete transcript
let captionTimeout;

async function startMeeting() {
    meetingStartTime = new Date();
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("local-video").srcObject = localStream;
    socket.emit("join-room", roomId);

    // Start the timer
    timerInterval = setInterval(updateMeetingTimer, 1000);

    // Initialize speech recognition
    if ("webkitSpeechRecognition" in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => {
            recognizing = true;
            document.getElementById("toggle-speech").innerHTML = '<i class="fas fa-microphone-alt-slash"></i><span>Stop Speech Recognition</span>';
        };

        recognition.onend = () => {
            recognizing = false;
            document.getElementById("toggle-speech").innerHTML = '<i class="fas fa-microphone-alt"></i><span>Start Speech Recognition</span>';
        };

        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    const transcript = event.results[i][0].transcript;
                    fullText += transcript + " ";
                    document.getElementById("transcript").innerText = fullText;
                    showCaption(transcript);
                }
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event);
        };
    } else {
        alert("Speech recognition not supported in this browser.");
    }
}

function showCaption(text) {
    const captionElement = document.getElementById("caption");
    if (!captionElement) {
        console.error("Caption element not found!");
        return;
    }

    captionElement.innerText = text;
    captionElement.style.display = "block";
    captionElement.style.opacity = "1";  
    captionElement.style.visibility = "visible"; 

    clearTimeout(captionTimeout);
    captionTimeout = setTimeout(() => {
        captionElement.style.opacity = "0";  
        captionElement.style.visibility = "hidden";  
        setTimeout(() => {
            captionElement.style.display = "none";
            captionElement.style.opacity = "1";  
            captionElement.style.visibility = "visible";  
        }, 500);  
    }, 5000);
}

function updateMeetingTimer() {
    const now = new Date();
    const elapsedTime = Math.floor((now - meetingStartTime) / 1000); // Duration in seconds
    const hours = Math.floor(elapsedTime / 3600);
    const minutes = Math.floor((elapsedTime % 3600) / 60);
    const seconds = elapsedTime % 60;

    document.getElementById("meeting-timer").textContent = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function toggleAudio() {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;

    document.getElementById("toggle-audio").innerHTML = audioTrack.enabled
        ? '<i class="fas fa-microphone"></i><span>Mute</span>'
        : '<i class="fas fa-microphone-slash"></i><span>Unmute</span>';
}

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

async function shareScreen() {
    try {
        // Get the screen-sharing stream
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        // Update local video preview
        document.getElementById("local-video").srcObject = screenStream;

        // Find and replace the video track in all peer connections
        Object.values(peers).forEach(peer => {
            const videoSender = peer.getSenders().find(sender => sender.track?.kind === 'video');
            if (videoSender) {
                videoSender.replaceTrack(screenTrack);
            }
        });

        // Handle screen-sharing stop event
        screenTrack.onended = async () => {
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newVideoTrack = newStream.getVideoTracks()[0];

                // Restore local video preview
                document.getElementById("local-video").srcObject = newStream;

                // Replace the screen track with the camera video track in peer connections
                Object.values(peers).forEach(peer => {
                    const videoSender = peer.getSenders().find(sender => sender.track?.kind === 'video');
                    if (videoSender) {
                        videoSender.replaceTrack(newVideoTrack);
                    }
                });
            } catch (error) {
                console.error("Error restoring camera:", error);
                alert("Unable to restore camera. Please check your settings.");
            }
        };
    } catch (error) {
        console.error("Error sharing screen:", error);
        alert("Unable to share screen. Please check your settings.");
    }
}

function toggleSpeechRecognition() {
    if (recognizing) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

function endMeeting() {
    const meetingEndTime = new Date();
    const meetingDuration = Math.floor((meetingEndTime - meetingStartTime) / 1000); // Duration in seconds
    const minutes = Math.floor(meetingDuration / 60);
    const seconds = meetingDuration % 60;

    alert(`Meeting ended. Duration: ${minutes} minutes and ${seconds} seconds.`);
    clearInterval(timerInterval); // Stop the timer
    window.location.href = 'index.html';
}

document.getElementById("toggle-audio").addEventListener("click", toggleAudio);
document.getElementById("toggle-video").addEventListener("click", toggleVideo);
document.getElementById("share-screen").addEventListener("click", shareScreen);
document.getElementById("end-meeting").addEventListener("click", endMeeting);
document.getElementById("toggle-speech").addEventListener("click", toggleSpeechRecognition);

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
