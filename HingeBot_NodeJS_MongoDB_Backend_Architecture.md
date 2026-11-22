# HingeBot Backend Architecture & Design Document
**Stack:** Node.js + Express + MongoDB (Mongoose) + Socket.io

---

## 1. Executive Summary & Android Client Analysis

### 1.1 Android Client Analysis (`com.example.hingebot`)
The current Android application is an automated profile interaction system driven by Android's `AccessibilityService`. The key domain components identified in the codebase are:

1. **State Machine (`AutomationStateMachine.java`)**:
   - Manages states: `IDLE`, `RUNNING`, `PAUSED`, `STOPPED`, `ERROR`.
   - Generates randomized dynamic 10-swipe cycles (1–4 Right swipes, 6–9 Left swipes shuffled via Fisher-Yates).
   - Enforces configurable interaction caps (`maxRightActions`, `maxTotalActions`).
2. **Executors (`RightSwipeExecutor.java`, `LeftSwipeExecutor.java`, `ProfileScrollHelper.java`)**:
   - Handles accessibility node searching (hearts, send buttons, skip/cross buttons).
   - Simulates human-like smooth vertical gestures, tap fallbacks, and keyboard suppression.
   - Handles error boundaries (e.g., maximum consecutive failures, daily limits reached).
3. **Session & Configuration (`SessionRepository.java`, `SequenceConfig.java`, `AppConfig.java`)**:
   - Stores session counts locally via `SharedPreferences`.
   - Records granular timestamped `SessionEvent` logs (`STEP_RIGHT`, `STEP_LEFT`, `STEP_SKIPPED`, etc.).
4. **UI & Control (`MainActivity.java`, `FloatingOverlayService.java`)**:
   - Provides on-screen controls, floating overlay widget, and live stats broadcasting (`ACTION_STATUS_UPDATE`).

---

## 2. Node.js + MongoDB Backend System Architecture

The backend architecture centralizes session management, enables remote command execution (Start/Pause/Resume/Stop from web/mobile dashboards), collects real-time event analytics, and dynamically provisions bot parameters.

```
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

## 3. MongoDB Database Schema Design (Mongoose)

### 3.1 Device Schema (`models/Device.js`)
Identifies unique Android devices running the HingeBot app.

```javascript
const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: 'Android Device' },
  model: { type: String },
  androidVersion: { type: String },
  appVersion: { type: String },
  apiToken: { type: String, required: true },
  status: { type: String, enum: ['OFFLINE', 'ONLINE', 'ACTIVE_SESSION'], default: 'OFFLINE' },
  lastSeenAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Device', deviceSchema);
```

### 3.2 Bot Configuration Schema (`models/BotConfig.js`)
Remote strategy parameters pushed dynamically to the app.

```javascript
const mongoose = require('mongoose');

const botConfigSchema = new mongoose.Schema({
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, unique: true },
  cycleSize: { type: Number, default: 10 },
  maxRightsPerCycle: { type: Number, default: 4 },
  maxTotalActions: { type: Number, default: 9999 },
  maxRightActions: { type: Number, default: 9999 },
  minStepDelayMs: { type: Number, default: 800 },
  maxStepDelayMs: { type: Number, default: 1500 },
  scrollDurationMs: { type: Number, default: 400 },
  scrollSettleMs: { type: Number, default: 750 },
  autoRestartOnCap: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BotConfig', botConfigSchema);
```

### 3.3 Automation Session Schema (`models/Session.js`)
Tracks each automation run session.

```javascript
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  deviceId: { type: String, required: true, index: true },
  state: { 
    type: String, 
    enum: ['IDLE', 'RUNNING', 'PAUSED', 'STOPPED', 'ERROR'], 
    default: 'IDLE' 
  },
  rightCount: { type: Number, default: 0 },
  leftCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  durationSeconds: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  stopReason: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
```

### 3.4 Event Log Schema (`models/EventLog.js`)
Detailed event stream mirror of Android's `SessionEvent`.

```javascript
const mongoose = require('mongoose');

const eventLogSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  deviceId: { type: String, required: true, index: true },
  eventType: { 
    type: String, 
    enum: ['SESSION_STARTED', 'STEP_RIGHT', 'STEP_LEFT', 'STEP_SKIPPED', 'SESSION_STOPPED', 'SESSION_ERROR', 'CAP_REACHED'],
    required: true 
  },
  detail: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EventLog', eventLogSchema);
```

### 3.5 Command Queue Schema (`models/CommandQueue.js`)
For queued remote commands (Start, Pause, Resume, Stop).

```javascript
const mongoose = require('mongoose');

const commandQueueSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  command: { type: String, enum: ['START', 'PAUSE', 'RESUME', 'STOP', 'RESET'], required: true },
  payload: { type: Object, default: {} },
  status: { type: String, enum: ['PENDING', 'SENT', 'EXECUTED', 'FAILED'], default: 'PENDING' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CommandQueue', commandQueueSchema);
```

---

## 4. REST API Endpoint Specifications

### Device Auth & Config
- **`POST /api/v1/devices/register`**: Registers phone and returns API token + initial configuration.
- **`GET /api/v1/config/:deviceId`**: Fetches latest strategy parameters (`SequenceConfig`).
- **`PUT /api/v1/config/:deviceId`**: Updates remote delays and swipe ratios.

### Session & Sync
- **`POST /api/v1/sessions/start`**: Creates a new session entry.
- **`POST /api/v1/sessions/heartbeat`**: Periodic status push (`rightCount`, `leftCount`, `state`, `duration`).
- **`POST /api/v1/sessions/stop`**: Finalizes session record with `stopReason` and duration.
- **`POST /api/v1/events/batch`**: Bulk uploads logged `SessionEvents`.

### Remote Control & Dashboard Analytics
- **`POST /api/v1/commands/send`**: Sends remote commands (`START`, `PAUSE`, `RESUME`, `STOP`).
- **`GET /api/v1/analytics/summary`**: Aggregates total likes, rejections, active sessions, and conversion rates across all registered bots.

---

## 5. Project Directory Structure for Node.js Backend

```text
hingebot-backend/
├── package.json
├── .env
├── server.js
└── src/
    ├── config/
    │   ├── db.js
    │   └── redis.js
    ├── controllers/
    │   ├── authController.js
    │   ├── sessionController.js
    │   ├── configController.js
    │   └── commandController.js
    ├── middlewares/
    │   ├── authMiddleware.js
    │   └── errorHandler.js
    ├── models/
    │   ├── Device.js
    │   ├── BotConfig.js
    │   ├── Session.js
    │   ├── EventLog.js
    │   └── CommandQueue.js
    ├── routes/
    │   ├── deviceRoutes.js
    │   ├── sessionRoutes.js
    │   ├── configRoutes.js
    │   └── analyticsRoutes.js
    ├── services/
    │   ├── sessionService.js
    │   └── analyticsService.js
    └── websocket/
        └── socketHandler.js
```

---

## 6. Real-time Synchronization (Socket.io)

### Device-to-Server Events
- `device:heartbeat`: Sends current app `SessionState`, `rightCount`, `leftCount`, and overlay status.
- `event:logged`: Emits `SessionEvent` in real-time as swipes occur.

### Server-to-Device Events
- `command:execute`: Pushes `START`, `PAUSE`, `RESUME`, or `STOP` commands directly to `HingeAutomationService`.
- `config:update`: Pushes updated `SequenceConfig` parameters directly to the Android app.
