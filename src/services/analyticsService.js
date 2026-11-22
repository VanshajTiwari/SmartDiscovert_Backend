const Session = require('../models/Session');
const Device = require('../models/Device');
const EventLog = require('../models/EventLog');
const BotConfig = require('../models/BotConfig');

class AnalyticsService {
  /**
   * System-wide aggregated analytics
   */
  async getSummary() {
    const [
      totalsAgg,
      activeDevicesCount,
      totalDevicesCount,
      activeSessionsCount,
      recentErrorsCount
    ] = await Promise.all([
      Session.aggregate([
        {
          $group: {
            _id: null,
            totalRightSwipes: { $sum: '$rightCount' },
            totalLeftSwipes: { $sum: '$leftCount' },
            totalActions: { $sum: '$totalCount' },
            totalDurationSeconds: { $sum: '$durationSeconds' },
            sessionCount: { $sum: 1 }
          }
        }
      ]),
      Device.countDocuments({ status: { $in: ['ONLINE', 'ACTIVE_SESSION'] } }),
      Device.countDocuments(),
      Session.countDocuments({ state: 'RUNNING' }),
      EventLog.countDocuments({
        eventType: 'SESSION_ERROR',
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    ]);

    const stats = totalsAgg[0] || {
      totalRightSwipes: 0,
      totalLeftSwipes: 0,
      totalActions: 0,
      totalDurationSeconds: 0,
      sessionCount: 0
    };

    const rightSwipeRatio = stats.totalActions > 0 
      ? Number(((stats.totalRightSwipes / stats.totalActions) * 100).toFixed(2)) 
      : 0;

    // Today's stats aggregation
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayAgg = await Session.aggregate([
      { $match: { startedAt: { $gte: startOfToday } } },
      {
        $group: {
          _id: null,
          todayRight: { $sum: '$rightCount' },
          todayLeft: { $sum: '$leftCount' },
          todayTotal: { $sum: '$totalCount' },
          todaySessions: { $sum: 1 }
        }
      }
    ]);

    const todayStats = todayAgg[0] || {
      todayRight: 0,
      todayLeft: 0,
      todayTotal: 0,
      todaySessions: 0
    };

    return {
      overview: {
        totalRightSwipes: stats.totalRightSwipes,
        totalLeftSwipes: stats.totalLeftSwipes,
        totalActions: stats.totalActions,
        rightSwipeRatioPercent: rightSwipeRatio,
        totalDurationMinutes: Math.round(stats.totalDurationSeconds / 60),
        totalSessions: stats.sessionCount
      },
      activeStatus: {
        activeDevices: activeDevicesCount,
        totalDevices: totalDevicesCount,
        activeSessions: activeSessionsCount,
        errorsLast24Hours: recentErrorsCount
      },
      today: todayStats
    };
  }

  /**
   * Device-specific analytics and history
   */
  async getDeviceAnalytics(deviceId) {
    const device = await Device.findOne({ deviceId }).lean();
    if (!device) return null;

    const [sessionsAgg, config, recentSessions] = await Promise.all([
      Session.aggregate([
        { $match: { deviceId } },
        {
          $group: {
            _id: null,
            totalRight: { $sum: '$rightCount' },
            totalLeft: { $sum: '$leftCount' },
            totalActions: { $sum: '$totalCount' },
            totalDuration: { $sum: '$durationSeconds' },
            count: { $sum: 1 }
          }
        }
      ]),
      BotConfig.findOne({ deviceHardwareId: deviceId }).lean(),
      Session.find({ deviceId }).sort({ startedAt: -1 }).limit(10).lean()
    ]);

    const stats = sessionsAgg[0] || {
      totalRight: 0,
      totalLeft: 0,
      totalActions: 0,
      totalDuration: 0,
      count: 0
    };

    return {
      device,
      config,
      stats: {
        totalRightSwipes: stats.totalRight,
        totalLeftSwipes: stats.totalLeft,
        totalActions: stats.totalActions,
        totalSessions: stats.count,
        totalDurationSeconds: stats.totalDuration,
        rightSwipeRatio: stats.totalActions > 0 
          ? Number(((stats.totalRight / stats.totalActions) * 100).toFixed(2)) 
          : 0
      },
      recentSessions
    };
  }
}

module.exports = new AnalyticsService();
