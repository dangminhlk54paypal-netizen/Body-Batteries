import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
import {
  dailyWalkTotals,
  normalizeSteps,
  sessionMinutes,
  totalStepsForDate,
} from '../domain/steps/walkSessions';
import { formatDisplayDate, todayString } from '../lib/dateUtils';
import type { WalkSession } from '../types/walk';

// How many days of outings to load for the per-day accumulated list.
const HISTORY_DAYS = 7;
// iOS: how often to re-query the pedometer while an outing is active.
const LIVE_POLL_MS = 5000;
// Android: how often to persist the live step count of an active outing.
const ANDROID_SAVE_MS = 15000;

function formatSteps(n: number): string {
  return normalizeSteps(n).toLocaleString('vi-VN');
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// "Đi bộ ra ngoài": tap when leaving home, tap again when back. Steps for each
// outing come from the phone pedometer (Apple Health's step source on iPhone)
// and are accumulated per day; finishing an outing also logs the steps as
// activity (energy burn + the movement battery).
export function WalkTrackerCard() {
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
      console.warn('WalkTrackerCard load failed:', e);
    }
    setHealthToday(await getTodaySteps());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Refresh when the app comes back to the foreground (e.g. after a walk).
  useEffect(() => {
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
        const now = new Date();
        const steps = await getStepsBetween(start, now);
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

  async function handleLeaveHome() {
    if (busy) return;
    setBusy(true);
    try {
      const status = await ensurePedometer();
      if (status !== 'ok') {
        Alert.alert(
          'Không đọc được bước chân',
          status === 'denied'
            ? 'Hãy cho phép "Chuyển động & Thể chất" (Motion & Fitness) trong Cài đặt của iPhone để app đếm bước.'
            : 'Thiết bị này không có bộ đếm bước chân.'
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

  async function handleBackHome() {
    if (!active || busy) return;
    setBusy(true);
    try {
      const endedAt = Date.now();
      const queried = await getStepsBetween(new Date(active.startedAt), new Date(endedAt));
      const steps = normalizeSteps(queried ?? liveStepsRef.current);
      await finishWalk(active.id, endedAt, steps);
      if (steps > 0) await logActivity({ steps });
      setActive(null);
      await load();
    } catch (e) {
      console.warn('finishWalk failed:', e);
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    if (!active) return;
    Alert.alert('Huỷ lần ra ngoài này?', 'Số bước của lần này sẽ không được cộng.', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Huỷ lần này',
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
  const todayOutings = recent.filter((s) => s.date === today && s.endedAt !== null);
  const todayTotal = totalStepsForDate(recent, today);
  const pastDays = dailyWalkTotals(recent).filter((d) => d.date !== today);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚶 Đi bộ ra ngoài</Text>
      <Text style={styles.subtitle}>
        Bấm khi ra khỏi nhà, bấm lại khi về — app lấy số bước từ bộ đếm của iPhone (cùng nguồn
        với Apple Health) và cộng dồn theo ngày.
      </Text>

      {healthToday !== null && (
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Cả ngày (Apple Health / iPhone)</Text>
          <Text style={styles.statValue}>{formatSteps(healthToday)} bước</Text>
        </View>
      )}
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>
          Cộng dồn các lần ra ngoài hôm nay ({todayOutings.length} lần)
        </Text>
        <Text style={[styles.statValue, styles.accent]}>{formatSteps(todayTotal)} bước</Text>
      </View>

      {active ? (
        <View style={styles.activeBox}>
          <Text style={styles.activeText}>
            Đang ở ngoài từ {formatTime(active.startedAt)} · {sessionMinutes(active)} phút
          </Text>
          <Text style={styles.liveSteps}>{formatSteps(liveSteps)} bước</Text>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.home, pressed && styles.pressed]}
            onPress={handleBackHome}
            disabled={busy}
          >
            <Text style={styles.btnText}>🏠 Về nhà — cộng bước</Text>
          </Pressable>
          <Pressable onPress={handleCancel} hitSlop={8}>
            <Text style={styles.cancelText}>Huỷ lần này</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.btn, styles.leave, pressed && styles.pressed]}
          onPress={handleLeaveHome}
          disabled={busy}
        >
          <Text style={styles.btnText}>🚪 Ra khỏi nhà</Text>
        </Pressable>
      )}

      {todayOutings.map((s) => (
        <View key={s.id} style={styles.entryRow}>
          <Text style={styles.entryLabel}>
            {formatTime(s.startedAt)} – {formatTime(s.endedAt!)} · {sessionMinutes(s)} phút
          </Text>
          <Text style={styles.entryValue}>{formatSteps(s.steps)} bước</Text>
        </View>
      ))}

      {pastDays.length > 0 && <Text style={styles.sectionLabel}>Các ngày trước</Text>}
      {pastDays.map((d) => (
        <View key={d.date} style={styles.entryRow}>
          <Text style={styles.entryLabel}>
            {formatDisplayDate(d.date)} · {d.outings} lần
          </Text>
          <Text style={styles.entryValue}>{formatSteps(d.steps)} bước</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d2d44',
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 12, color: '#888', lineHeight: 17 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  statLabel: { flex: 1, color: '#aaa', fontSize: 13 },
  statValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  accent: { color: '#00B894' },
  activeBox: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    alignItems: 'center',
  },
  activeText: { color: '#ccc', fontSize: 13 },
  liveSteps: { color: '#00B894', fontSize: 28, fontWeight: '800' },
  btn: { alignSelf: 'stretch', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  leave: { backgroundColor: '#00B894' },
  home: { backgroundColor: '#0984e3' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cancelText: { color: '#888', fontSize: 12, textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
  sectionLabel: { color: '#888', fontSize: 12, marginTop: 4 },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  entryLabel: { color: '#ccc', fontSize: 13 },
  entryValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
