'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ENTITIES } from './config';

interface EntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

type StatesMap = Record<string, EntityState | null>;

const ALL_ENTITY_IDS = [
  ...ENTITIES.solar.panels.map((p) => p.id),
  ENTITIES.solar.totalPower,
  ENTITIES.solar.energyToday,
  ENTITIES.grid.importPower,
  ENTITIES.grid.exportPower,
  ...(ENTITIES.grid.importEnergy ? [ENTITIES.grid.importEnergy] : []),
  ...(ENTITIES.grid.exportEnergy ? [ENTITIES.grid.exportEnergy] : []),
  ENTITIES.battery.tesla,
  ...ENTITIES.lights.map((l) => l.id),
];

function fmt(state: EntityState | null | undefined, decimals = 1): string {
  if (!state) return '—';
  const n = parseFloat(state.state);
  if (isNaN(n)) return state.state;
  return n.toFixed(decimals);
}

function unit(state: EntityState | null | undefined): string {
  if (!state) return '';
  return (state.attributes.unit_of_measurement as string) ?? '';
}

function fmtWithUnit(state: EntityState | null | undefined, decimals = 1): string {
  const v = fmt(state, decimals);
  const u = unit(state);
  return u ? `${v} ${u}` : v;
}

// Battery bar colour
function batteryColor(pct: number): string {
  if (pct > 50) return 'bg-green-500';
  if (pct > 20) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function Dashboard() {
  const [states, setStates] = useState<StatesMap>({});
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pendingToggle = useRef<Set<string>>(new Set());

  const fetchStates = useCallback(async () => {
    try {
      const res = await fetch(`/api/states?entities=${ALL_ENTITY_IDS.join(',')}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: (EntityState | null)[] = await res.json();
      const map: StatesMap = {};
      data.forEach((s) => {
        if (s) map[s.entity_id] = s;
      });
      setStates(map);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStates();
    const id = setInterval(fetchStates, 5000);
    return () => clearInterval(id);
  }, [fetchStates]);

  const toggleLight = async (entityId: string, currentState: string) => {
    if (pendingToggle.current.has(entityId)) return;
    const action = currentState === 'on' ? 'turn_off' : 'turn_on';
    // Optimistic update
    pendingToggle.current.add(entityId);
    setStates((prev) => ({
      ...prev,
      [entityId]: prev[entityId]
        ? { ...prev[entityId]!, state: action === 'turn_on' ? 'on' : 'off' }
        : null,
    }));
    try {
      await fetch('/api/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId, action }),
      });
    } finally {
      pendingToggle.current.delete(entityId);
      setTimeout(fetchStates, 800);
    }
  };

  const s = (id: string | null) => (id ? states[id] ?? null : null);

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg animate-pulse">Connecting to Home Assistant…</div>
      </div>
    );
  }

  const teslaState = s(ENTITIES.battery.tesla);
  const teslaPct = teslaState ? Math.max(0, Math.min(100, parseFloat(teslaState.state) || 0)) : 0;

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col p-3 gap-3 overflow-hidden select-none">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h1 className="text-lg font-bold tracking-wide text-amber-400">⚡ EasyHA</h1>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {error && <span className="text-red-400">⚠ {error}</span>}
          <span>Updated {lastUpdate}</span>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>

      {/* ── Main 3-column grid ── */}
      <div className="flex-1 grid grid-cols-3 gap-3 min-h-0">

        {/* ── Column 1: Solar + Grid ── */}
        <div className="flex flex-col gap-3 min-h-0">

          {/* Solar panels */}
          <div className="bg-slate-800 rounded-2xl p-3 border border-amber-500/25 flex-shrink-0">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2">☀ Solar — Now</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
              {ENTITIES.solar.panels.map((panel) => (
                <div key={panel.id}>
                  <p className="text-xs text-slate-400">{panel.name}</p>
                  <p className="text-sm font-mono font-semibold">{fmtWithUnit(s(panel.id))}</p>
                </div>
              ))}
              <div className="col-span-2 border-t border-slate-700 pt-2">
                <p className="text-xs text-amber-300/70">Total</p>
                <p className="text-sm font-mono font-bold text-amber-300">{fmtWithUnit(s(ENTITIES.solar.totalPower))}</p>
              </div>
            </div>
          </div>

          {/* Solar energy today */}
          <div className="bg-slate-800 rounded-2xl p-3 border border-green-500/25 flex-shrink-0">
            <p className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-1">📅 Energy Today</p>
            <p className="text-2xl font-bold text-green-300 leading-none whitespace-nowrap">
              {fmtWithUnit(s(ENTITIES.solar.energyToday), 2)}
            </p>
          </div>

          {/* Grid power */}
          <div className="bg-slate-800 rounded-2xl p-3 border border-blue-500/25 flex-shrink-0">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">🔌 Grid</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
              <div>
                <p className="text-xs text-slate-400">↓ Import</p>
                <p className="text-sm font-mono font-semibold text-red-400">{fmtWithUnit(s(ENTITIES.grid.importPower))}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">↑ Export</p>
                <p className="text-sm font-mono font-semibold text-green-400">{fmtWithUnit(s(ENTITIES.grid.exportPower))}</p>
              </div>
              {(ENTITIES.grid.importEnergy || ENTITIES.grid.exportEnergy) && (
                <>
                  {ENTITIES.grid.importEnergy && (
                    <div className="col-span-1 border-t border-slate-700 pt-2">
                      <p className="text-xs text-slate-400">↓ Energy In</p>
                      <p className="text-sm font-mono">{fmtWithUnit(s(ENTITIES.grid.importEnergy))}</p>
                    </div>
                  )}
                  {ENTITIES.grid.exportEnergy && (
                    <div className="col-span-1 border-t border-slate-700 pt-2">
                      <p className="text-xs text-slate-400">↑ Energy Out</p>
                      <p className="text-sm font-mono">{fmtWithUnit(s(ENTITIES.grid.exportEnergy))}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tesla battery */}
          <div className="bg-slate-800 rounded-2xl p-3 border border-red-500/25 flex-shrink-0">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-1">🚗 Tesla Battery</p>
            <p className="text-3xl font-bold leading-none">
              {teslaState ? `${teslaPct}%` : '—'}
            </p>
            <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${batteryColor(teslaPct)}`}
                style={{ width: `${teslaPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Columns 2–3: Lights ── */}
        <div className="col-span-2 bg-slate-800 rounded-2xl p-3 border border-yellow-500/25 flex flex-col min-h-0">
          <p className="text-xs font-semibold text-yellow-400 uppercase tracking-widest mb-3 flex-shrink-0">
            💡 Lights
          </p>
          <div className="flex-1 grid grid-cols-2 gap-2 content-start">
            {ENTITIES.lights.map((light) => {
              const ls = s(light.id);
              const isOn = ls?.state === 'on';
              return (
                <button
                  key={light.id}
                  onClick={() => toggleLight(light.id, ls?.state ?? 'off')}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer
                    ${isOn
                      ? 'bg-yellow-500/20 border border-yellow-400/50 text-yellow-200 shadow-[0_0_12px_rgba(234,179,8,0.15)]'
                      : 'bg-slate-700/60 border border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                    }`}
                >
                  <span>{light.name}</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all ${
                      isOn ? 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.8)]' : 'bg-slate-600'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
