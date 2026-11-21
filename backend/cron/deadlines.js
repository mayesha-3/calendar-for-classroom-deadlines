import Deadline from '../models/Deadline.js';
import User from '../models/User.js';
import { sendNotificationToUsers } from '../utils/messaging.js';

const DEADLINE_TIME_ZONE = 'Asia/Dhaka';

const getDateTimeParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)])
  );
};

const getUtcDateForZonedMidnight = (dateParts, timeZone) => {
  const midnightAsUtc = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day);
  let timestamp = midnightAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zonedParts = getDateTimeParts(new Date(timestamp), timeZone);
    const representedAsUtc = Date.UTC(
      zonedParts.year,
      zonedParts.month - 1,
      zonedParts.day,
      zonedParts.hour,
      zonedParts.minute,
      zonedParts.second
    );
    const adjustment = midnightAsUtc - representedAsUtc;

    if (adjustment === 0) break;
    timestamp += adjustment;
  }

  return new Date(timestamp);
};

const addCalendarDays = (dateParts, days) => {
  const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

export const getTomorrowDateRange = (now = new Date(), timeZone = DEADLINE_TIME_ZONE) => {
  const today = getDateTimeParts(now, timeZone);
  const tomorrow = addCalendarDays(today, 1);
  const dayAfterTomorrow = addCalendarDays(tomorrow, 1);

  return {
    start: getUtcDateForZonedMidnight(tomorrow, timeZone),
    end: getUtcDateForZonedMidnight(dayAfterTomorrow, timeZone),
  };
};

export const runDeadlineCheck = async () => {
  console.log('Running daily deadline check...');
  try {
    const { start, end } = getTomorrowDateRange();

    const dueTomorrow = await Deadline.find({
      deadline: {
        $gte: start,
        $lt: end,
      },
    }).lean();

    if (dueTomorrow.length === 0) {
      console.log('No deadlines due tomorrow.');
      return;
    }

    console.log(`Found ${dueTomorrow.length} deadlines due tomorrow.`);
    const users = await User.find({}, '_id').lean();
    const userIds = users.map(({ _id }) => _id);

    for (const dl of dueTomorrow) {
      if (userIds.length > 0) {
        const typeLabel = dl.type === 'other' ? (dl.customType || 'Other') : dl.type.replace(/_/g, ' ');
        await sendNotificationToUsers(
          userIds,
          'Deadline Due Tomorrow',
          `Reminder: "${dl.title}" (${typeLabel}) is due tomorrow.`,
          { deadlineId: dl._id.toString() }
        );
      }
    }
  } catch (error) {
    console.error('Error in deadline check execution:', error);
  }
};

// Run every day at 6:00 PM BDT (18:00 Asia/Dhaka)
export const startDeadlineCron = () => {
  if (typeof globalThis.WebSocketPair !== "undefined") return;
  import('node-cron').then((cron) => {
    (cron.default || cron).schedule('0 18 * * *', async () => {
      await runDeadlineCheck();
    }, { timezone: DEADLINE_TIME_ZONE });
  }).catch((error) => {
    console.error('Failed to start deadline reminder schedule:', error);
  });
};
