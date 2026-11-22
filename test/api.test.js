/**
 * Smoke and Unit Test suite for HingeBot Backend Architecture
 */
const assert = require('assert');

console.log('--- Starting HingeBot Backend Integrity Tests ---');

// 1. Model schemas check
const Device = require('../src/models/Device');
const BotConfig = require('../src/models/BotConfig');
const Session = require('../src/models/Session');
const EventLog = require('../src/models/EventLog');
const CommandQueue = require('../src/models/CommandQueue');

assert(Device && Device.schema, 'Device model is missing or malformed');
assert(BotConfig && BotConfig.schema, 'BotConfig model is missing or malformed');
assert(Session && Session.schema, 'Session model is missing or malformed');
assert(EventLog && EventLog.schema, 'EventLog model is missing or malformed');
assert(CommandQueue && CommandQueue.schema, 'CommandQueue model is missing or malformed');
console.log('✓ Mongoose models initialized successfully');

// 2. Token generation test
const token = Device.generateToken();
assert(token && token.startsWith('hb_'), 'Device token generation failed');
assert(token.length > 20, 'Device token length is too short');
console.log(`✓ Device token generation verified: ${token.substring(0, 10)}...`);

// 3. Controllers check
const authController = require('../src/controllers/authController');
const configController = require('../src/controllers/configController');
const sessionController = require('../src/controllers/sessionController');
const commandController = require('../src/controllers/commandController');
const analyticsController = require('../src/controllers/analyticsController');

assert(typeof authController.registerDevice === 'function', 'registerDevice must be a function');
assert(typeof configController.getConfig === 'function', 'getConfig must be a function');
assert(typeof configController.updateConfig === 'function', 'updateConfig must be a function');
assert(typeof sessionController.startSession === 'function', 'startSession must be a function');
assert(typeof sessionController.heartbeat === 'function', 'heartbeat must be a function');
assert(typeof sessionController.stopSession === 'function', 'stopSession must be a function');
assert(typeof sessionController.recordBatchEvents === 'function', 'recordBatchEvents must be a function');
assert(typeof commandController.sendCommand === 'function', 'sendCommand must be a function');
assert(typeof analyticsController.getSummary === 'function', 'getSummary must be a function');
console.log('✓ Controllers verified with expected handlers');

// 4. Services check
const sessionService = require('../src/services/sessionService');
const commandService = require('../src/services/commandService');
const analyticsService = require('../src/services/analyticsService');

assert(typeof sessionService.startSession === 'function', 'sessionService.startSession required');
assert(typeof commandService.queueCommand === 'function', 'commandService.queueCommand required');
assert(typeof analyticsService.getSummary === 'function', 'analyticsService.getSummary required');
console.log('✓ Services layer verified');

// 5. Middleware check
const { requireDeviceAuth, requireAdminAuth } = require('../src/middlewares/authMiddleware');
const { errorHandler, notFoundHandler } = require('../src/middlewares/errorHandler');
assert(typeof requireDeviceAuth === 'function', 'requireDeviceAuth required');
assert(typeof requireAdminAuth === 'function', 'requireAdminAuth required');
assert(typeof errorHandler === 'function', 'errorHandler required');
assert(typeof notFoundHandler === 'function', 'notFoundHandler required');
console.log('✓ Middlewares verified');

console.log('--- All Integrity Tests Passed! ---');
