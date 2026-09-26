import { useEffect, useState } from 'react';

const CHECK_EVERY_MS = 5 * 60 * 1000;

function currentHour(): number {
  return new Date().getHours();
}

// The local hour (0–23), refreshed every few minutes so time-paced UI (Home
// keyword chips) moves on while the screen stays open. setState only runs
// inside the interval callback, never synchronously in the effect body.
export function useCurrentHour(): number {
  const [hour, setHour] = useState(currentHour);
  useEffect(() => {
    const id = setInterval(() => setHour(currentHour()), CHECK_EVERY_MS);
    return () => clearInterval(id);
  }, []);
  return hour;
}
