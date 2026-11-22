const CommandQueue = require('../models/CommandQueue');
const { sendSocketCommand } = require('../websocket/socketHandler');

class CommandService {
  /**
   * Queue and push a command to a device
   */
  async queueCommand({ deviceId, command, payload = {} }) {
    const validCommands = ['START', 'PAUSE', 'RESUME', 'STOP', 'RESET'];
    if (!validCommands.includes(command.toUpperCase())) {
      throw new Error(`Invalid command: ${command}. Must be one of: ${validCommands.join(', ')}`);
    }

    const commandDoc = await CommandQueue.create({
      deviceId,
      command: command.toUpperCase(),
      payload,
      status: 'PENDING'
    });

    // Try delivering via real-time WebSocket
    const deliveredViaSocket = sendSocketCommand(
      deviceId,
      commandDoc.command,
      payload,
      commandDoc._id.toString()
    );

    if (deliveredViaSocket) {
      commandDoc.status = 'SENT';
      await commandDoc.save();
    }

    return {
      command: commandDoc,
      deliveredViaSocket
    };
  }

  /**
   * Retrieve pending commands for HTTP polling fallback
   */
  async getPendingCommands(deviceId) {
    const commands = await CommandQueue.find({
      deviceId,
      status: { $in: ['PENDING', 'SENT'] }
    }).sort({ createdAt: 1 }).limit(10);

    return commands;
  }

  /**
   * Acknowledge execution outcome from device
   */
  async acknowledgeCommand(commandId, status = 'EXECUTED', resultMessage = '') {
    const validStatuses = ['EXECUTED', 'FAILED'];
    const finalStatus = validStatuses.includes(status.toUpperCase()) ? status.toUpperCase() : 'EXECUTED';

    const command = await CommandQueue.findByIdAndUpdate(
      commandId,
      {
        status: finalStatus,
        resultMessage,
        executedAt: new Date()
      },
      { new: true }
    );

    return command;
  }
}

module.exports = new CommandService();
