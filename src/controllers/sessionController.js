const sessionService = require('../services/sessionService');

/**
 * Create or initialize a session
 * POST /api/v1/sessions/start
 */
const startSession = async (req, res, next) => {
  try {
    const deviceId = req.body.deviceId || req.deviceId;
    const { sessionId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId is required either in body or via device authentication'
      });
    }

    const session = await sessionService.startSession({ sessionId, deviceId });

    res.status(201).json({
      success: true,
      message: 'Session started successfully',
      data: session
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Heartbeat update from Android automation service
 * POST /api/v1/sessions/heartbeat
 */
const heartbeat = async (req, res, next) => {
  try {
    const deviceId = req.body.deviceId || req.deviceId;
    const { sessionId, state, rightCount, leftCount, totalCount, durationSeconds } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required for heartbeat'
      });
    }

    const session = await sessionService.processHeartbeat({
      sessionId,
      deviceId,
      state,
      rightCount,
      leftCount,
      totalCount,
      durationSeconds
    });

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Stop and finalize a session
 * POST /api/v1/sessions/stop
 */
const stopSession = async (req, res, next) => {
  try {
    const deviceId = req.body.deviceId || req.deviceId;
    const { sessionId, stopReason, durationSeconds } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required to stop session'
      });
    }

    const session = await sessionService.stopSession({
      sessionId,
      deviceId,
      stopReason,
      durationSeconds
    });

    res.status(200).json({
      success: true,
      message: 'Session stopped successfully',
      data: session
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk upload of logged SessionEvents
 * POST /api/v1/events/batch
 */
const recordBatchEvents = async (req, res, next) => {
  try {
    const deviceId = req.body.deviceId || req.deviceId;
    const { sessionId, events } = req.body;

    if (!sessionId || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: 'sessionId and an array of events are required'
      });
    }

    const result = await sessionService.recordBatchEvents({
      sessionId,
      deviceId,
      events
    });

    res.status(201).json({
      success: true,
      message: `Processed ${result.insertedCount} events successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed session info with event logs
 * GET /api/v1/sessions/:sessionId
 */
const getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await sessionService.getSessionWithEvents(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: `Session not found with id: ${sessionId}`
      });
    }

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all sessions with pagination
 * GET /api/v1/sessions
 */
const listSessions = async (req, res, next) => {
  try {
    const { deviceId, state, page, limit } = req.query;
    const result = await sessionService.listSessions({
      deviceId,
      state,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10)
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startSession,
  heartbeat,
  stopSession,
  recordBatchEvents,
  getSession,
  listSessions
};
