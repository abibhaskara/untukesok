/**
 * Utility functions for date and countdown calculations in GMT+8 timezone (WITA / UTC+8).
 */

/**
 * Returns today's date string (YYYY-MM-DD) in GMT+8 timezone.
 */
export function getTodayGMT8String() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

/**
 * Returns a Date object set to 00:00:00 GMT+8 for today.
 */
export function getTodayGMT8Date() {
  const todayStr = getTodayGMT8String();
  return new Date(`${todayStr}T00:00:00+08:00`);
}

/**
 * Calculates days left until program deadline/date using GMT+8.
 * @param {Object} program - Program object containing date, deadline, or daysLeft
 * @returns {number} Sisa hari (0 if passed)
 */
export function calculateDaysLeftGMT8(program) {
  if (!program) return 0;

  let targetDateObj = null;

  // 1. Check if explicit deadline is set (e.g. "2026-08-14")
  if (program.deadline && typeof program.deadline === 'string' && program.deadline.trim() !== '') {
    const dStr = program.deadline.trim();
    targetDateObj = new Date(dStr.includes('T') ? dStr : `${dStr}T00:00:00+08:00`);
  } 
  // 2. Check if date is set (e.g. "2026-08-15" or "Oct 15 - Oct 18, 2026")
  else if (program.date && typeof program.date === 'string' && program.date.trim() !== '') {
    let dateStr = program.date.trim();
    if (dateStr.includes('-')) {
      const yearMatch = dateStr.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : new Date().getFullYear();
      const firstPart = dateStr.split('-')[0].trim();
      dateStr = `${firstPart}, ${year}`;
    }
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const eventDate = new Date(`${dateStr}T00:00:00+08:00`);
      if (!isNaN(eventDate.getTime())) {
        targetDateObj = new Date(eventDate.getTime() - (24 * 60 * 60 * 1000));
      }
    } else {
      const eventDate = new Date(dateStr);
      if (!isNaN(eventDate.getTime())) {
        targetDateObj = new Date(eventDate.getTime() - (24 * 60 * 60 * 1000));
      }
    }
  }

  if (targetDateObj && !isNaN(targetDateObj.getTime())) {
    const todayStart = getTodayGMT8Date();

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Makassar',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const targetStr = formatter.format(targetDateObj);
    const targetStart = new Date(`${targetStr}T00:00:00+08:00`);

    const timeDiff = targetStart.getTime() - todayStart.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysLeft;
  }

  // 3. Fallback to static program.daysLeft if present
  if (typeof program.daysLeft === 'number') {
    return program.daysLeft;
  }

  return -1;
}

/**
 * Calculates deadline date (H-1) and days left for a given event date string in GMT+8.
 * Used when creating/editing programs in Admin panel.
 * @param {string} eventDateStr - Date string (YYYY-MM-DD)
 * @returns {{ deadline: string, daysLeft: number }}
 */
export function calculateProgramDeadlineAndDaysLeft(eventDateStr) {
  if (!eventDateStr) return { deadline: '', daysLeft: 0 };

  const eventDate = new Date(`${eventDateStr}T00:00:00+08:00`);
  if (isNaN(eventDate.getTime())) return { deadline: '', daysLeft: 0 };

  const deadlineDate = new Date(eventDate.getTime() - (24 * 60 * 60 * 1000));
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const deadlineStr = formatter.format(deadlineDate);

  const todayStart = getTodayGMT8Date();
  const deadlineStart = new Date(`${deadlineStr}T00:00:00+08:00`);

  const timeDiff = deadlineStart.getTime() - todayStart.getTime();
  const daysLeft = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));

  return {
    deadline: deadlineStr,
    daysLeft
  };
}

/**
 * Formats a date string (e.g. YYYY-MM-DD) to DD/MM/YYYY.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDateDDMMYYYY(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
  const trimmed = dateStr.trim();
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${day}/${month}/${year}`;
  }
  return trimmed;
}

/**
 * Calculates duration in hours between startTime and endTime (e.g. "10:00" and "12:00" -> 2).
 * Fallback to defaultHours (2) if not specified or invalid.
 */
export function calculateProgramDurationHours(program, defaultHours = 2) {
  if (!program) return defaultHours;
  if (typeof program.durationHours === 'number' && program.durationHours > 0) {
    return program.durationHours;
  }
  if (program.startTime && program.endTime) {
    const parseHour = (timeStr) => {
      if (!timeStr || typeof timeStr !== 'string') return null;
      const match = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        return parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
      }
      return null;
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
 * Only adds hours AFTER the event is finished (daysLeft < 0 or status === 'Selesai').
 */
export function calculateTotalContributionHours(userApplications = []) {
  if (!Array.isArray(userApplications)) return 0;
  return userApplications.reduce((total, prog) => {
    if (!prog || prog.status === 'Dibatalkan') return total;

    const daysLeft = calculateDaysLeftGMT8({
      date: prog.programDate || prog.date,
      deadline: prog.programDeadline || prog.deadline
    });

    const isCompleted = prog.status === 'Selesai' || daysLeft < 0;

    if (isCompleted) {
      const duration = calculateProgramDurationHours(prog, 2);
      return total + duration;
    }

    return total;
  }, 0);
}
