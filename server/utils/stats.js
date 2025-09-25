/**
 * Calculate a consecutive-day streak from a list of completed meditations.
 * The function treats completion timestamps as UTC dates and counts
 * consecutive days ending with today or yesterday.
 */
export function calculateStreak(completedMeditations) {
  if (!Array.isArray(completedMeditations) || completedMeditations.length === 0) {
    return 0;
  }

  const completionDates = completedMeditations
    .map((entry) => new Date(entry.completed_at).toDateString())
    .filter((date, index, arr) => arr.indexOf(date) === index)
    .sort((a, b) => new Date(b) - new Date(a));

  if (completionDates.length === 0) {
    return 0;
  }

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

  if (completionDates[0] !== today && completionDates[0] !== yesterday) {
    return 0;
  }

  let streak = 1;
  let currentDate = new Date(completionDates[0]);

  for (let i = 1; i < completionDates.length; i += 1) {
    const previousDay = new Date(currentDate);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDayString = previousDay.toDateString();

    if (completionDates[i] === previousDayString) {
      streak += 1;
      currentDate = new Date(completionDates[i]);
    } else {
      break;
    }
  }

  return streak;
}

