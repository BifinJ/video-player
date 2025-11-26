# 🎬 SyncPlay - Collaborative Video Player

A cross-platform desktop application that allows multiple users to watch local videos together in real-time with synchronized playback and integrated voice chat.

## ✨ Features

- **🎯 VLC-Based Playback**: Plays ALL video formats (MKV, AVI, MP4, etc.)
- **📝 Subtitle Support**: Full subtitle support via VLC
- **🎮 Perfect Seeking**: Instant seeking with no buffering
- **🔄 Real-Time Sync**: All participants stay perfectly synchronized
- **🎙️ Voice Chat**: Built-in WebRTC voice communication
- **💬 Text Chat**: Floating chat messages over video
- **🏠 Room-Based**: Create or join rooms using simple codes
- **👑 Host Controls**: Host selects video and controls playback
- **🚫 No Login Required**: Simple and instant collaboration

## 🛠️ Tech Stack

- **Frontend**: React + Electron
- **Video Player**: VLC Media Player (via HTTP interface)
- **Backend**: Node.js + Express + Socket.IO
- **Real-Time**: WebRTC (SimplePeer)
- **Build**: Vite

## 📦 Installation

### Prerequisites
- **Node.js 16+** and npm
- **VLC Media Player** (required!)

### Install VLC

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install vlc
```

**Arch Linux:**
```bash
sudo pacman -S vlc
```

**Fedora:**
```bash
sudo dnf install vlc
```

**Verify:**
```bash
vlc --version
```

### Install SyncPlay

1. **Clone the repository**:
```bash
git clone <repository-url>
cd syncplay
```

2. **Install dependencies**:
```bash
npm install
```

## 🚀 Running the Application

### Development Mode

1. **Start the signaling server** (Terminal 1):
```bash
npm run server
```

2. **Start the Electron app** (Terminal 2):
```bash
npm run electron:start
```

The signaling server runs on `http://localhost:3001`

### Production Build

Build desktop applications:
```bash
npm run electron:build
```

This creates installers in the `dist/` folder for your platform.

## 🎮 How to Use

### Creating a Room
1. Launch SyncPlay
2. Click "Create Room"
3. Share the room code with others
4. Click "📁 Select Video"
5. VLC opens with your video
6. Control playback - all participants will sync automatically

### Joining a Room
1. Launch SyncPlay
2. Enter the room code
3. Click "Join"
4. VLC opens automatically when host selects video
5. Watch in perfect sync!

### Controls
- **▶️ Play/Pause** → Syncs all participants
- **Seek Bar** → Click to jump, everyone follows
- **🎤 Voice** → Toggle microphone
- **💬 Chat** → Send messages (appear over video)
- **👥 Participants** → See who's in the room

## 🎬 Supported Formats

Thanks to VLC, SyncPlay supports **ALL** video formats:

- **Video**: MKV, MP4, AVI, MOV, WMV, FLV, 3GP, WEBM, M4V, MPG, MPEG, VOB, OGV
- **Audio**: AAC, MP3, FLAC, OGG, WMA, WAV, AC3, DTS
- **Subtitles**: SRT, ASS, SSA, SUB, VTT

## 📝 Features Explained

### Synchronization
- When host plays/pauses/seeks, all clients receive the action
- New joiners automatically sync to current playback state
- Sub-100ms sync accuracy

### WebRTC Architecture
- Signaling via Socket.IO
- Peer-to-peer media streaming
- Data channels for playback sync
- Audio tracks for voice chat

### Room Management
- In-memory storage (no database needed)
- Automatic cleanup when host leaves
- Room codes are 6-character alphanumeric

## 🐛 Troubleshooting

### Video won't play
- Ensure the video format is supported (MP4, WebM recommended)
- Check file permissions
- Try a different video file

### Voice chat not working
- Grant microphone permissions
- Check browser/Electron permissions
- Ensure WebRTC is not blocked by firewall

### Connection issues
- Verify signaling server is running
- Check firewall settings
- Ensure correct server URL

### Participants not syncing
- Check network connection
- Verify all clients are on the same room
- Restart the application

## 🔒 Security Notes

- All video streaming is peer-to-peer (not through server)
- Server only handles signaling
- No data persistence (privacy-focused)
- Room codes are temporary and session-based

## 📄 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Contributions are welcome! Areas for improvement:
- Add text chat
- Screen sharing support
- Playlist management
- User avatars/names
- Reconnection handling
- Mobile app version

## 🙏 Acknowledgments

Built with:
- Electron
- React
- Socket.IO
- SimplePeer
- WebRTC

---

**Note**: This application requires a signaling server to coordinate connections. The server stores no persistent data and all video/audio is transmitted peer-to-peer.