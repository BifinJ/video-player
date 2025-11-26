const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

// Fix Linux library issues
// app.commandLine.appendSwitch("disable-gpu");
// app.commandLine.appendSwitch("disable-software-rasterizer");
// app.commandLine.appendSwitch("no-sandbox");
// app.disableHardwareAcceleration();

let mainWindow;
let videoServer = null;
const VIDEO_SERVER_PORT = 8765;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (process.env.NODE_ENV !== "production") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  startVideoServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (videoServer) {
    videoServer.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (videoServer) {
    videoServer.close();
  }
});

// Handle file selection
ipcMain.handle("select-video", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Videos", extensions: ["mp4", "webm", "ogg", "mov", "m4v"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Handle subtitle file selection
ipcMain.handle("select-subtitle", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Subtitles", extensions: ["srt", "vtt", "ass", "ssa"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Simple video server with range support
function startVideoServer() {
  videoServer = http.createServer((req, res) => {
    const filePath = decodeURIComponent(req.url.substring(1));

    console.log("📥 Video request:", path.basename(filePath));

    if (!fs.existsSync(filePath)) {
      console.error("❌ File not found:", filePath);
      res.writeHead(404);
      res.end("File not found");
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine MIME type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".ogg": "video/ogg",
      ".mov": "video/quicktime",
      ".m4v": "video/mp4",
      ".srt": "text/srt",
      ".vtt": "text/vtt",
      ".ass": "text/x-ssa",
      ".ssa": "text/x-ssa",
    };

    const mimeType = mimeTypes[ext] || "application/octet-stream";

    if (range) {
      // Handle range request for seeking
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      console.log(`📤 Streaming range: ${start}-${end}/${fileSize}`);

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": mimeType,
        "Access-Control-Allow-Origin": "*",
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // Full file request
      console.log(
        `📤 Streaming full file (${(fileSize / 1024 / 1024).toFixed(2)} MB)`
      );

      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
      });

      fs.createReadStream(filePath).pipe(res);
    }
  });

  videoServer.listen(VIDEO_SERVER_PORT, () => {
    console.log(
      `\n✅ Video server running on http://localhost:${VIDEO_SERVER_PORT}\n`
    );
  });
}
