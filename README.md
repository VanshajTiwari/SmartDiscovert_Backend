# HingeBot Backend & API Server

A production-grade **Node.js + Express + MongoDB (Mongoose) + Socket.io** backend for managing, synchronizing, remotely controlling, and collecting telemetry from the **HingeBot Android Automation Client** (`com.example.hingebot`).

---

## 1. Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                   HingeBot Android App                      │
│ (AccessibilityService + SessionRepository + WebSockets/HTTP)│
└──────────────┬──────────────────────────────▲───────────────┘
               │ HTTP Sync & Event Logs       │ Socket.io Commands
               ▼                              │
┌─────────────────────────────────────────────────────────────┐
│                  Express.js API Server                      │
│  ┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐  │
│  │ Auth & Devices   │ │ Session Engine   │ │ Realtime WS │  │
│  └──────────────────┘ └──────────────────┘ └─────────────┘  │
└──────────────┬──────────────────────────────┬───────────────┘
               │ Mongoose ODM                 │
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       MongoDB Database                      │
│ (Devices, Sessions, EventLogs, BotConfigs, CommandQueue)    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```text
SmartDiscovery_Backend/
├── .env.example              # Environment variables template
├── .gitignore
├── Dockerfile                # Production Docker container definition
├── docker-compose.yml        # Multi-container setup (Backend + MongoDB)
├── package.json              # Dependencies and scripts
├── server.js                 # Express server & Socket.io entrypoint
└── src/
    ├── config/
    │   ├── db.js             # Mongoose connection & lifecycle handlers
    │   └── redis.js          # Optional Redis client with fallback
    ├── controllers/
    │   ├── authController.js       # Device registration & listing
    │   ├── configController.js     # Bot strategy parameter management
    │   ├── sessionController.js    # Session lifecycle & batch event sync
    │   ├── commandController.js    # Remote command dispatch & ack
    │   └── analyticsController.js  # Global & per-device aggregations
    ├── middlewares/
    │   ├── authMiddleware.js       # Device API token & Admin key validation
    │   └── errorHandler.js         # Centralized error & 404 handler
    ├── models/
    │   ├── Device.js         # Android hardware & registration records
    │   ├── BotConfig.js      # Dynamic SequenceConfig / swipe thresholds
    │   ├── Session.js        # Automation session run stats
    │   ├── EventLog.js       # Granular SessionEvent audit logs
    │   └── CommandQueue.js   # Remote command queue & audit trail
    ├── routes/
    │   ├── deviceRoutes.js
    │   ├── configRoutes.js
    │   ├── sessionRoutes.js
    │   ├── commandRoutes.js
    │   └── analyticsRoutes.js
    ├── services/
    │   ├── sessionService.js       # Session processing logic
    │   ├── commandService.js       # Command push and polling logic
    │   └── analyticsService.js     # Aggregations & metrics computation
    └── websocket/
        └── socketHandler.js        # Socket.io bi-directional realtime handlers
```

---

## 3. Quickstart Guide

### Option A: Running with Docker Compose (Recommended)
Make sure Docker Desktop is installed and running:
```bash
docker-compose up -d --build
```
This starts:
- **Express Backend**: `http://localhost:5000`
- **MongoDB**: `localhost:27017`

### Option B: Running Locally with Node.js
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and verify database settings:
   ```bash
   cp .env.example .env
   ```
3. Start in development mode with hot-reloading:
   ```bash
   npm run dev
   ```
   Or production:
   ```bash
   npm start
   ```

---

## 4. REST API Documentation

### Base URL: `http://localhost:5000/api/v1`

### Authentication Headers
- **Device Authentication:** `x-api-token: <device-api-token>` or `Authorization: Bearer <device-api-token>`
- **Admin / Dashboard Authentication:** `x-admin-key: <ADMIN_API_KEY>` (Default: `admin-dev-secret-key-12345`)

---

### 4.1 Device Registration & Status

#### `POST /devices/register`
Registers a new Android device or updates an existing one. Returns the API token and the bot's dynamic configuration parameters.

**Request Body:**
```json
{
  "deviceId": "android-pixel7-987654",
  "name": "Pixel 7 Pro",
  "model": "Pixel 7 Pro",
  "androidVersion": "14",
  "appVersion": "1.0.0"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Device registered successfully",
  "data": {
    "deviceId": "android-pixel7-987654",
    "name": "Pixel 7 Pro",
    "apiToken": "hb_8f3d12a9bc4e...71e",
    "status": "ONLINE",
    "config": {
      "cycleSize": 10,
      "maxRightsPerCycle": 4,
      "maxTotalActions": 9999,
      "maxRightActions": 9999,
      "minStepDelayMs": 800,
      "maxStepDelayMs": 1500,
      "scrollDurationMs": 400,
      "scrollSettleMs": 750,
      "autoRestartOnCap": false
    }
  }
}
```

#### `GET /devices/status`
Headers: `x-api-token: <device-token>`
Returns the authenticated device's current profile.

#### `GET /devices`
Headers: `x-admin-key: <admin-key>`
Lists all registered devices.

---

### 4.2 Bot Strategy & Configuration

#### `GET /config/:deviceId`
Headers: `x-api-token` or `x-admin-key`
Fetches the current dynamic sequence parameters for the specified device.

#### `PUT /config/:deviceId`
Headers: `x-admin-key: <admin-key>`
Updates remote strategy parameters and automatically broadcasts `config:update` via WebSockets to the active client.

**Request Body:**
```json
{
  "cycleSize": 10,
  "maxRightsPerCycle": 3,
  "minStepDelayMs": 1000,
  "maxStepDelayMs": 2000,
  "scrollDurationMs": 450,
  "scrollSettleMs": 800
}
```

---

### 4.3 Session Lifecycle & Synchronization

#### `POST /sessions/start`
Headers: `x-api-token` or `x-admin-key`
Initializes a new session run.

**Request Body:**
```json
{
  "sessionId": "sess_1700650000000",
  "deviceId": "android-pixel7-987654"
}
```

#### `POST /sessions/heartbeat`
Headers: `x-api-token`
Periodic telemetry push from the automation background service.

**Request Body:**
```json
{
  "sessionId": "sess_1700650000000",
  "deviceId": "android-pixel7-987654",
  "state": "RUNNING",
  "rightCount": 12,
  "leftCount": 28,
  "durationSeconds": 340
}
```

#### `POST /sessions/stop`
Headers: `x-api-token`
Finalizes the session upon manual stop or interaction cap hit.

**Request Body:**
```json
{
  "sessionId": "sess_1700650000000",
  "deviceId": "android-pixel7-987654",
  "stopReason": "CAP_REACHED",
  "durationSeconds": 450
}
```

#### `POST /events/batch`
Headers: `x-api-token`
Bulk syncs events recorded locally in Android's `SessionRepository`.

**Request Body:**
```json
{
  "sessionId": "sess_1700650000000",
  "deviceId": "android-pixel7-987654",
  "events": [
    {
      "eventType": "STEP_RIGHT",
      "detail": "Heart clicked at profile bottom",
      "timestamp": "2026-11-22T12:00:05.120Z"
    },
    {
      "eventType": "STEP_LEFT",
      "detail": "Cross button clicked",
      "timestamp": "2026-11-22T12:00:08.450Z"
    }
  ]
}
```

#### `GET /sessions/:sessionId`
Fetches a single session with up to 500 chronological events.

#### `GET /sessions?deviceId=...&state=...&page=1&limit=20`
Lists sessions with pagination and state filtering.

---

### 4.4 Remote Command Execution

#### `POST /commands/send`
Headers: `x-admin-key: <admin-key>`
Dispatches a remote command to the target device. Queues the command and pushes it immediately if the device is connected via Socket.io.

**Request Body:**
```json
{
  "deviceId": "android-pixel7-987654",
  "command": "START",
  "payload": {
    "targetCycles": 5
  }
}
```
*Supported Commands:* `START`, `PAUSE`, `RESUME`, `STOP`, `RESET`.

#### `GET /commands/pending/:deviceId`
Headers: `x-api-token` or `x-admin-key`
Fallback endpoint for clients polling for pending commands.

#### `POST /commands/:commandId/ack`
Headers: `x-api-token`
Acknowledges command execution result from the device.

---

### 4.5 Analytics & Telemetry

#### `GET /analytics/summary`
Aggregates total right swipes (likes), left swipes (crosses), like-ratio percentage, active sessions, and today's metrics across the entire fleet.

#### `GET /analytics/devices`
Returns status, last seen timestamps, and active sessions for all devices.

#### `GET /analytics/device/:deviceId`
Returns in-depth metrics and history for an individual device.

---

## 5. Socket.io Real-time Protocol

### Connection Handshake
Connect to the server with device authentication:
```javascript
const socket = io("http://localhost:5000", {
  auth: {
    token: "hb_8f3d12a9bc4e...71e",
    deviceId: "android-pixel7-987654"
  }
});
```

### Device ➔ Server Events
1. **`device:heartbeat`**:
   ```javascript
   socket.emit("device:heartbeat", {
     sessionId: "sess_1700650000000",
     state: "RUNNING", // IDLE, RUNNING, PAUSED, STOPPED, ERROR
     rightCount: 15,
     leftCount: 35,
     totalCount: 50,
     durationSeconds: 420
   });
   ```

2. **`event:logged`**:
   ```javascript
   socket.emit("event:logged", {
     sessionId: "sess_1700650000000",
     eventType: "STEP_RIGHT", // STEP_RIGHT, STEP_LEFT, STEP_SKIPPED, etc.
     detail: "Heart clicked",
     timestamp: new Date().toISOString()
   });
   ```

3. **`command:ack`**:
   ```javascript
   socket.emit("command:ack", {
     commandId: "655dc3...",
     status: "EXECUTED", // EXECUTED, FAILED
     resultMessage: "State changed to RUNNING"
   });
   ```

### Server ➔ Device Events
1. **`command:execute`**:
   Listened by the Android automation service to remotely trigger state transitions:
   ```javascript
   socket.on("command:execute", ({ commandId, command, payload }) => {
     // command is one of: START, PAUSE, RESUME, STOP, RESET
     // execute in AutomationStateMachine and acknowledge
   });
   ```

2. **`config:update`**:
   Pushed when remote strategy parameters are updated from dashboard:
   ```javascript
   socket.on("config:update", ({ config }) => {
     // apply updated delays and ratios
   });
   ```

---

## 6. Android Client Integration Example (Kotlin/Java)

To connect from the Android app using `socket.io-client.java`:

```java
IO.Options options = new IO.Options();
options.auth = Collections.singletonMap("token", savedApiToken);
Socket socket = IO.socket("http://YOUR_SERVER_IP:5000", options);

socket.on(Socket.EVENT_CONNECT, args -> {
    Log.d("HingeBot", "Connected to remote control server");
});

socket.on("command:execute", args -> {
    JSONObject data = (JSONObject) args[0];
    String command = data.getString("command");
    
    switch (command) {
        case "START":
            automationStateMachine.start();
            break;
        case "PAUSE":
            automationStateMachine.pause();
            break;
        case "RESUME":
            automationStateMachine.resume();
            break;
        case "STOP":
            automationStateMachine.stop();
            break;
    }
});

socket.connect();
```
