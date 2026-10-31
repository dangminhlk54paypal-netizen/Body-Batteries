import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import {
  startWalk,
  finishWalk,
  deleteWalk,
  getActiveWalk,
  getRecentWalks,
  updateWalkSteps,
} from '../data/repositories/walkSessionRepository';
import {
  canQueryStepRange,
  ensurePedometer,
  getStepsBetween,
  getTodaySteps,
  watchSteps,
} from '../services/steps/pedometerService';
import { dailyWalkTotals, normalizeSteps, totalStepsForDate } from '../domain/steps/walkSessions';
import { todayString } from '../lib/dateUtils';
import { useT } from '../i18n/useT';
import type { DailyWalkTotal, WalkSession } from '../types/walk';

// How many days of outings to load for the per-day accumulated list.
const HISTORY_DAYS = 7;
// iOS: how often to re-query the pedometer while an outing is active.
const LIVE_POLL_MS = 5000;
// Android: how often to persist the live step count of an active outing.
const ANDROID_SAVE_MS = 15000;

export interface WalkTracker {
  active: WalkSession | null;
  liveSteps: number;
  healthToday: number | null;
  todayOutings: WalkSession[];
  todayTotal: number;
  pastDays: DailyWalkTotal[];
  busy: boolean;
  leaveHome: () => void;
  backHome: () => void;
  cancel: () => void;
}

// "Ra khỏi nhà" outings: tap when leaving home, tap again when back. Steps for
// each outing come from the phone pedometer (Apple Health's step source on
// iPhone) and are accumulated per day; finishing an outing also logs the steps
// as activity (energy burn + the movement battery). Lives in Home so the
// closed brick tile can show today's total.
export function useWalkTracker(): WalkTracker {
  const { t } = useT();
  const logActivity = useEnergyStore((s) => s.logActivity);

  const [active, setActive] = useState<WalkSession | null>(null);
  const [liveSteps, setLiveSteps] = useState(0);
  const [healthToday, setHealthToday] = useState<number | null>(null);
  const [recent, setRecent] = useState<WalkSession[]>([]);
  const [busy, setBusy] = useState(false);
  const liveStepsRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([getActiveWalk(), getRecentWalks(HISTORY_DAYS)]);
      setActive(a);
      setRecent(r);
      if (a && !canQueryStepRange) {
        liveStepsRef.current = a.steps;
        setLiveSteps(a.steps);
      }
    } catch (e) {
      console.warn('useWalkTracker load failed:', e);
    }
    setHealthToday(await getTodaySteps());
  }, []);

  // Home stays mounted across tabs, so load once and then refresh whenever the
  // app comes back to the foreground (e.g. after a walk).
  useEffect(() => {
    Promise.resolve().then(load);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  // Live step count while outside.
  useEffect(() => {
    if (!active) return;

    if (canQueryStepRange) {
      const start = new Date(active.startedAt);
      const poll = async () => {
        const steps = await getStepsBetween(start, new Date());
        if (steps !== null) setLiveSteps(steps);
        setHealthToday(await getTodaySteps());
      };
      poll();
      const id = setInterval(poll, LIVE_POLL_MS);
      return () => clearInterval(id);
    }

    // Android: only live streaming is possible, so steps accumulate on top of
    // what was saved for this outing and are persisted periodically.
    const base = active.steps;
    const unwatch = watchSteps((n) => {
      liveStepsRef.current = base + n;
      setLiveSteps(base + n);
    });
    const saveId = setInterval(() => {
      updateWalkSteps(active.id, liveStepsRef.current).catch(() => {});
    }, ANDROID_SAVE_MS);
    return () => {
      unwatch();
      clearInterval(saveId);
      updateWalkSteps(active.id, liveStepsRef.current).catch(() => {});
    };
  }, [active]);

  async function leaveHome() {
    if (busy) return;
    setBusy(true);
    try {
      const status = await ensurePedometer();
      if (status !== 'ok') {
        Alert.alert(
          t('components.walkTracker.noPedometerTitle'),
          t(status === 'denied' ? 'components.walkTracker.deniedBody' : 'components.walkTracker.unavailableBody')
        );
        return;
      }
      liveStepsRef.current = 0;
      setLiveSteps(0);
      setActive(await startWalk(Date.now()));
    } catch (e) {
      console.warn('startWalk failed:', e);
    } finally {
      setBusy(false);
    }
  }

  async function backHome() {
    if (!active || busy) return;
    setBusy(true);
    try {
      const endedAt = Date.now();
      const queried = await getStepsBetween(new Date(active.startedAt), new Date(endedAt));
      const steps = normalizeSteps(queried ?? liveStepsRef.current);
      await finishWalk(active.id, endedAt, steps);
      if (steps > 0) await logActivity({ steps, startAt: active.startedAt, endAt: endedAt });
      setActive(null);
      await load();
    } catch (e) {
      console.warn('finishWalk failed:', e);
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    if (!active) return;
    Alert.alert(t('components.walkTracker.cancelTitle'), t('components.walkTracker.cancelBody'), [
      { text: t('components.walkTracker.cancelNo'), style: 'cancel' },
      {
        text: t('components.walkTracker.cancelYes'),
        style: 'destructive',
        onPress: async () => {
          await deleteWalk(active.id);
          setActive(null);
          await load();
        },
      },
    ]);
  }

  const today = todayString();
  return {
    active,
    liveSteps,
    healthToday,
    todayOutings: recent.filter((s) => s.date === today && s.endedAt !== null),
    todayTotal: totalStepsForDate(recent, today),
    pastDays: dailyWalkTotals(recent).filter((d) => d.date !== today),
    busy,
    leaveHome,
    backHome,
    cancel,
  };
}
