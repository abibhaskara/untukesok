/**
 * Utility functions for date and countdown calculations in GMT+8 timezone (WITA / UTC+8).
 */

const gmt8DateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Makassar',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/**
 * Returns today's date string (YYYY-MM-DD) in GMT+8 timezone.
 */
export function getTodayGMT8String() {
  return gmt8DateFormatter.format(new Date());
}

/**
 * Returns a Date object set to 00:00:00 GMT+8 for today.
 */
export function getTodayGMT8Date() {
  return new Date(`${getTodayGMT8String()}T00:00:00+08:00`);
}

/**
 * Calculates days left until program deadline/date using GMT+8.
 * @param {Object} program - Program object containing date, deadline, or daysLeft
 * @returns {number} Sisa hari (0 if passed)
 */
export function calculateDaysLeftGMT8(program) {
  if (!program) return 0;

  let targetDateObj = null;

  if (program.deadline && typeof program.deadline === 'string' && program.deadline.trim() !== '') {
    const dStr = program.deadline.trim();
    targetDateObj = new Date(dStr.includes('T') ? dStr : `${dStr}T00:00:00+08:00`);
  } else if (program.date && typeof program.date === 'string' && program.date.trim() !== '') {
    const dateStr = program.date.trim();
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) 
      ? new Date(`${dateStr}T00:00:00+08:00`)
      : new Date(dateStr);

    if (!isNaN(parsedDate.getTime())) {
      targetDateObj = new Date(parsedDate.getTime() - 86400000);
    }
  }

  if (targetDateObj && !isNaN(targetDateObj.getTime())) {
    const todayStart = getTodayGMT8Date();
    const targetStart = new Date(`${gmt8DateFormatter.format(targetDateObj)}T00:00:00+08:00`);
    return Math.ceil((targetStart.getTime() - todayStart.getTime()) / 86400000);
  }

  if (typeof program.daysLeft === 'number') {
    return program.daysLeft;
  }

  return -1;
}

/**
 * Calculates deadline date (H-1) and days left for a given event date string in GMT+8.
 */
export function calculateProgramDeadlineAndDaysLeft(eventDateStr) {
  if (!eventDateStr) return { deadline: '', daysLeft: 0 };

  const eventDate = new Date(`${eventDateStr}T00:00:00+08:00`);
  if (isNaN(eventDate.getTime())) return { deadline: '', daysLeft: 0 };

  const deadlineDate = new Date(eventDate.getTime() - 86400000);
  const deadlineStr = gmt8DateFormatter.format(deadlineDate);
  const todayStart = getTodayGMT8Date();
  const deadlineStart = new Date(`${deadlineStr}T00:00:00+08:00`);

  const daysLeft = Math.max(0, Math.ceil((deadlineStart.getTime() - todayStart.getTime()) / 86400000));

  return { deadline: deadlineStr, daysLeft };
}

/**
 * Formats a date string (e.g. YYYY-MM-DD) to DD/MM/YYYY.
 */
export function formatDateDDMMYYYY(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed.split('-').reverse().join('/');
  }
  return trimmed;
}

/**
 * Calculates duration in hours between startTime and endTime (e.g. "10:00" and "12:00" -> 2).
 */
export function calculateProgramDurationHours(program, defaultHours = 2) {
  if (!program) return defaultHours;
  if (typeof program.durationHours === 'number' && program.durationHours > 0) {
    return program.durationHours;
  }
  if (program.startTime && program.endTime) {
    const parseHour = (timeStr) => {
      const match = typeof timeStr === 'string' && timeStr.match(/^(\d{1,2}):(\d{2})/);
      return match ? parseInt(match[1], 10) + parseInt(match[2], 10) / 60 : null;
    };
    const start = parseHour(program.startTime);
    const end = parseHour(program.endTime);
    if (start !== null && end !== null && end > start) {
      return Math.round((end - start) * 10) / 10;
    }
  }
  return defaultHours;
}

/**
 * Calculates total completed contribution hours for a list of application programs.
 */
export function calculateTotalContributionHours(userApplications = []) {
  if (!Array.isArray(userApplications)) return 0;
  return userApplications.reduce((total, prog) => {
    if (!prog || prog.status === 'Dibatalkan') return total;

    const daysLeft = calculateDaysLeftGMT8({
      date: prog.programDate || prog.date,
      deadline: prog.programDeadline || prog.deadline
    });

    if (prog.status === 'Selesai' || daysLeft < 0) {
      return total + calculateProgramDurationHours(prog, 2);
    }
    return total;
  }, 0);
}
