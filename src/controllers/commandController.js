const commandService = require('../services/commandService');

/**
 * Push remote commands (START, PAUSE, RESUME, STOP, RESET)
 * POST /api/v1/commands/send
 */
const sendCommand = async (req, res, next) => {
  try {
    const { deviceId, command, payload } = req.body;

    if (!deviceId || !command) {
      return res.status(400).json({
        success: false,
        error: 'deviceId and command are required'
      });
    }

    const result = await commandService.queueCommand({
      deviceId,
      command,
      payload: payload || {}
    });

    res.status(200).json({
      success: true,
      message: `Command ${command} queued successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve pending commands for a device (HTTP polling fallback)
 * GET /api/v1/commands/pending/:deviceId
 */
const getPendingCommands = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const commands = await commandService.getPendingCommands(deviceId);

    res.status(200).json({
      success: true,
      count: commands.length,
      data: commands
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Acknowledge command execution status from device
 * POST /api/v1/commands/:commandId/ack
 */
const acknowledgeCommand = async (req, res, next) => {
  try {
    const { commandId } = req.params;
    const { status, resultMessage } = req.body;

    const command = await commandService.acknowledgeCommand(
      commandId,
      status,
      resultMessage
    );

    if (!command) {
      return res.status(404).json({
        success: false,
        error: `Command not found with id: ${commandId}`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Command acknowledged',
      data: command
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendCommand,
  getPendingCommands,
  acknowledgeCommand
};
