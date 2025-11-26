import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";

const SIGNALING_SERVER = "http://localhost:3001";

function App() {
  const [screen, setScreen] = useState("home");
  const [roomId, setRoomId] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [videoPath, setVideoPath] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [floatingMessages, setFloatingMessages] = useState([]);
  const [subtitleTrack, setSubtitleTrack] = useState(null);
  const [showSubtitles, setShowSubtitles] = useState(false);

  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    socketRef.current = io(SIGNALING_SERVER);

    socketRef.current.on("user-joined", (data) => {
      setParticipants(data.participants);
      initiateConnection(data.userId);
    });

    socketRef.current.on("user-left", (data) => {
      setParticipants(data.participants);
      if (peersRef.current[data.userId]) {
        peersRef.current[data.userId].destroy();
        delete peersRef.current[data.userId];
      }
    });

    socketRef.current.on("connection-request", (userId) => {
      createPeer(userId, false);
    });

    socketRef.current.on("signal", (data) => {
      if (peersRef.current[data.from]) {
        peersRef.current[data.from].signal(data.signal);
      }
    });

    socketRef.current.on("video-play", (data) => {
      if (!isSyncingRef.current && videoRef.current) {
        isSyncingRef.current = true;
        videoRef.current.currentTime = data.time;
        videoRef.current.play();
        setIsPlaying(true);
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 100);
      }
    });

    socketRef.current.on("video-pause", (data) => {
      if (!isSyncingRef.current && videoRef.current) {
        isSyncingRef.current = true;
        videoRef.current.currentTime = data.time;
        videoRef.current.pause();
        setIsPlaying(false);
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 100);
      }
    });

    socketRef.current.on("video-seek", (data) => {
      if (!isSyncingRef.current && videoRef.current) {
        isSyncingRef.current = true;
        videoRef.current.currentTime = data.time;
        setCurrentTime(data.time);
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 100);
      }
    });

    socketRef.current.on("video-selected", (path) => {
      setVideoPath(path);
      loadVideo(path);
    });

    socketRef.current.on("room-closed", () => {
      alert("Host has left. Room closed.");
      setScreen("home");
      cleanup();
    });

    socketRef.current.on("chat-message", (data) => {
      const newMsg = { ...data, id: Date.now() };
      setMessages((prev) => [...prev, newMsg]);

      setFloatingMessages((prev) => [...prev, newMsg]);
      setTimeout(() => {
        setFloatingMessages((prev) => prev.filter((m) => m.id !== newMsg.id));
      }, 5000);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      cleanup();
    };
  }, []);

  const cleanup = () => {
    Object.values(peersRef.current).forEach((peer) => peer.destroy());
    peersRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  };

  const createRoom = () => {
    setError("");
    socketRef.current.emit("create-room", (response) => {
      if (response.success) {
        setRoomId(response.roomId);
        setIsHost(true);
        setParticipants([socketRef.current.id]);
        setScreen("room");
      }
    });
  };

  const joinRoom = () => {
    if (!joinRoomId.trim()) {
      setError("Please enter a room ID");
      return;
    }

    setError("");
    socketRef.current.emit(
      "join-room",
      joinRoomId.toUpperCase(),
      (response) => {
        if (response.success) {
          setRoomId(response.roomId);
          setIsHost(false);
          setParticipants(response.participants);
          setVideoPath(response.videoState.videoPath);
          setScreen("room");

          response.participants.forEach((participantId) => {
            if (participantId !== socketRef.current.id) {
              socketRef.current.emit("request-connection", participantId);
            }
          });
        } else {
          setError(response.error || "Failed to join room");
        }
      }
    );
  };

  const initiateConnection = (userId) => {
    createPeer(userId, true);
  };

  const createPeer = (userId, initiator) => {
    const peer = new Peer({
      initiator,
      trickle: false,
      stream: localStreamRef.current,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
        ],
      },
    });

    peer.on("signal", (signal) => {
      socketRef.current.emit("signal", {
        to: userId,
        signal,
      });
    });

    peer.on("stream", (stream) => {
      console.log("Received stream from peer:", userId);
      const audio = new Audio();
      audio.srcObject = stream;
      audio.volume = 1.0;
      audio.play().catch((err) => console.error("Audio play error:", err));
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
    });

    peer.on("close", () => {
      console.log("Peer connection closed:", userId);
    });

    peersRef.current[userId] = peer;
  };

  const loadVideo = async (path) => {
    try {
      setVideoLoading(true);
      console.log("Loading video:", path);

      // Try to get video info if available
      if (window.electronAPI && window.electronAPI.getVideoInfo) {
        try {
          const info = await window.electronAPI.getVideoInfo(path);
          console.log("Video info:", info);
          setDuration(info.duration);
        } catch (err) {
          console.warn("Could not get video info:", err);
        }
      }

      // Set video source
      const videoUrl = `http://localhost:8765/${encodeURIComponent(path)}`;
      console.log("Video URL:", videoUrl);
      setVideoPath(videoUrl);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
        }
      }, 100);
    } catch (err) {
      console.error("Failed to load video:", err);
      alert("Failed to load video. Check console for details.");
      setVideoLoading(false);
    }
  };

  const selectVideo = async () => {
    if (!isHost) return;

    if (window.electronAPI && window.electronAPI.selectVideo) {
      const path = await window.electronAPI.selectVideo();
      if (path) {
        console.log("Selected video path:", path);
        socketRef.current.emit("video-selected", path);
        await loadVideo(path);
      }
    } else {
      // Web fallback
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "video/*";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const url = URL.createObjectURL(file);
          setVideoPath(url);
          socketRef.current.emit("video-selected", url);

          if (videoRef.current) {
            videoRef.current.load();
          }
        }
      };
      input.click();
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      socketRef.current.emit("video-play", {
        time: videoRef.current.currentTime,
      });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      socketRef.current.emit("video-pause", {
        time: videoRef.current.currentTime,
      });
    }
  };

  const handleSeek = (e) => {
    if (!videoRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = pos * duration;

    videoRef.current.currentTime = time;
    setCurrentTime(time);
    socketRef.current.emit("video-seek", { time });
  };

  const toggleVoice = async () => {
    if (!voiceEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        localStreamRef.current = stream;
        setVoiceEnabled(true);

        Object.values(peersRef.current).forEach((peer) => {
          if (peer.addStream) {
            peer.addStream(stream);
          }
        });
      } catch (err) {
        console.error("Failed to get audio:", err);
        alert("Could not access microphone");
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      setVoiceEnabled(false);
    }
  };

  const sendMessage = () => {
    if (!messageInput.trim()) return;

    const message = {
      userId: socketRef.current.id,
      text: messageInput,
      timestamp: Date.now(),
    };

    socketRef.current.emit("chat-message", message);

    const newMsg = { ...message, id: Date.now() };
    setMessages((prev) => [...prev, newMsg]);

    setFloatingMessages((prev) => [...prev, newMsg]);
    setTimeout(() => {
      setFloatingMessages((prev) => prev.filter((m) => m.id !== newMsg.id));
    }, 5000);

    setMessageInput("");
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (screen === "home") {
    return (
      <div className="home-screen">
        <div className="home-container">
          <h1>🎬 SyncPlay</h1>
          <p>Watch videos together in perfect sync with VLC</p>

          <div className="home-actions">
            <button className="btn btn-primary" onClick={createRoom}>
              Create Room
            </button>

            <div className="divider">
              <span>OR</span>
            </div>

            <div className="input-group">
              <input
                className="input"
                type="text"
                placeholder="Enter Room ID"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === "Enter" && joinRoom()}
              />
              <button className="btn btn-primary" onClick={joinRoom}>
                Join
              </button>
            </div>

            {error && <div className="error">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎬 SyncPlay</h1>
        <div className="room-info">
          <button
            className="btn-icon"
            onClick={() => setShowParticipants(!showParticipants)}
            title="Participants"
          >
            👥 {participants.length}
          </button>
          <button
            className="btn-icon"
            onClick={() => setShowChat(!showChat)}
            title="Chat"
          >
            💬
          </button>
          <button
            className={`btn-icon ${voiceEnabled ? "active" : ""}`}
            onClick={toggleVoice}
            title={voiceEnabled ? "Mute" : "Unmute"}
          >
            {voiceEnabled ? "🎤" : "🔇"}
          </button>
          <div className="room-code">Room: {roomId}</div>
          {isHost && <span style={{ color: "#ffd700" }}>👑 Host</span>}
        </div>
      </header>

      <div className="main-content">
        <div className="video-section-full">
          <div className="video-container">
            {videoPath ? (
              <>
                <video
                  ref={videoRef}
                  src={videoPath}
                  onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                  onLoadedMetadata={(e) => {
                    console.log("Video loaded, duration:", e.target.duration);
                    if (e.target.duration && isFinite(e.target.duration)) {
                      setDuration(e.target.duration);
                    }
                    setVideoLoading(false);
                  }}
                  onWaiting={() => setVideoLoading(true)}
                  onCanPlay={() => setVideoLoading(false)}
                  onError={(e) => {
                    console.error("Video error:", e);
                    setVideoLoading(false);
                  }}
                  controls={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />

                {videoLoading && (
                  <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>Loading video...</p>
                  </div>
                )}

                <div className="floating-messages">
                  {floatingMessages.map((msg) => (
                    <div key={msg.id} className="floating-message">
                      <strong>
                        {msg.userId === socketRef.current?.id
                          ? "You"
                          : `User ${msg.userId.slice(0, 6)}`}
                        :
                      </strong>{" "}
                      {msg.text}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="video-placeholder">
                <h2>No video selected</h2>
                {isHost && <p>Click "📁 Select Video" to start</p>}
                {!isHost && <p>Waiting for host to select a video...</p>}
              </div>
            )}
          </div>

          <div className="controls">
            {isHost && (
              <button className="btn btn-primary" onClick={selectVideo}>
                📁 Select Video
              </button>
            )}

            <button
              className="btn btn-secondary"
              onClick={togglePlay}
              disabled={!videoPath}
            >
              {isPlaying ? "⏸️" : "▶️"}
            </button>

            <div className="seek-bar" onClick={handleSeek}>
              <div
                className="seek-progress"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>

            <div className="time-display">
              {formatTime(currentTime)} /{" "}
              {duration > 0 && isFinite(duration)
                ? formatTime(duration)
                : "--:--"}
            </div>
          </div>
        </div>

        {showParticipants && (
          <div className="overlay-panel participants-panel">
            <div className="panel-header">
              <h3>👥 Participants ({participants.length})</h3>
              <button
                className="close-btn"
                onClick={() => setShowParticipants(false)}
              >
                ✕
              </button>
            </div>
            <div className="panel-content">
              {participants.map((id) => (
                <div key={id} className="participant-item">
                  <div style={{ flex: 1 }}>
                    {id === socketRef.current?.id
                      ? "You"
                      : `User ${id.slice(0, 6)}`}
                  </div>
                  {id === participants[0] && (
                    <span className="host-badge">HOST</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showChat && (
          <div className="overlay-panel chat-panel">
            <div className="panel-header">
              <h3>💬 Chat</h3>
              <button className="close-btn" onClick={() => setShowChat(false)}>
                ✕
              </button>
            </div>
            <div className="panel-content chat-messages">
              {messages.map((msg, idx) => (
                <div key={idx} className="chat-message">
                  <strong>
                    {msg.userId === socketRef.current?.id
                      ? "You"
                      : `User ${msg.userId.slice(0, 6)}`}
                    :
                  </strong>
                  <span>{msg.text}</span>
                </div>
              ))}
            </div>
            <div className="chat-input-container">
              <input
                type="text"
                className="chat-input"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              />
              <button className="btn btn-primary" onClick={sendMessage}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
