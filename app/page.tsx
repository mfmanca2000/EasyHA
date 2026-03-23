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

function batteryColor(pct: number): string {
  if (pct > 50) return 'bg-green-500';
  if (pct > 20) return 'bg-yellow-500';
  return 'bg-red-500';
}

function batteryTextColor(pct: number): string {
  if (pct > 50) return 'text-green-400';
  if (pct > 20) return 'text-yellow-400';
  return 'text-red-400';
}

// Panel-specific accent colours
const PANEL_STYLES = [
  { border: 'border-amber-500/30', label: 'text-amber-400', value: 'text-amber-200', bg: 'bg-amber-500/8', glow: '' },
  { border: 'border-orange-500/30', label: 'text-orange-400', value: 'text-orange-200', bg: 'bg-orange-500/8', glow: '' },
  { border: 'border-yellow-500/30', label: 'text-yellow-400', value: 'text-yellow-200', bg: 'bg-yellow-500/8', glow: '' },
];

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

        {/* Quick stats in header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">☀ Today</span>
            <span className="font-mono font-semibold text-green-300">{fmtWithUnit(s(ENTITIES.solar.energyToday), 2)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">🚗</span>
            <span className={`font-mono font-semibold ${batteryTextColor(teslaPct)}`}>
              {teslaState ? `${teslaPct}%` : '—'}
            </span>
            <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${batteryColor(teslaPct)}`} style={{ width: `${teslaPct}%` }} />
            </div>
          </div>
          {error && <span className="text-red-400 text-xs">⚠ {error}</span>}
          <span className="text-xs text-slate-500">{lastUpdate}</span>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>

      {/* ── Row 1: Solar panels ── */}
      <div className="flex-shrink-0 grid grid-cols-3 gap-3">
        {ENTITIES.solar.panels.map((panel, i) => {
          const ps = PANEL_STYLES[i] ?? PANEL_STYLES[0];
          const val = s(panel.id);
          const watts = val ? parseFloat(val.state) || 0 : 0;
          return (
            <div key={panel.id} className={`${ps.bg} rounded-2xl p-4 border ${ps.border}`}>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${ps.label}`}>
                ☀ {panel.name}
              </p>
              <p className={`text-2xl font-bold font-mono leading-none ${ps.value}`}>
                {fmtWithUnit(val)}
              </p>
              {/* Mini sparkle bar proportional to 1000 W max */}
              <div className="mt-3 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-orange-400' : 'bg-yellow-400'}`}
                  style={{ width: `${Math.min(100, (watts / 1000) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Row 2: Grid ── */}
      <div className="flex-shrink-0 grid grid-cols-3 gap-3">
        {/* Import Power */}
        <div className="bg-red-500/8 rounded-2xl p-4 border border-red-500/25">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-red-400">↓ Import</p>
          <p className="text-2xl font-bold font-mono leading-none text-red-200">
            {fmtWithUnit(s(ENTITIES.grid.importPower))}
          </p>
          <div className="mt-3 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-red-400 transition-all duration-500"
              style={{ width: `${Math.min(100, ((s(ENTITIES.grid.importPower) ? parseFloat(s(ENTITIES.grid.importPower)!.state) || 0 : 0) / 3000) * 100)}%` }}
            />
          </div>
        </div>

        {/* Export Power */}
        <div className="bg-green-500/8 rounded-2xl p-4 border border-green-500/25">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-green-400">↑ Export</p>
          <p className="text-2xl font-bold font-mono leading-none text-green-200">
            {fmtWithUnit(s(ENTITIES.grid.exportPower))}
          </p>
          <div className="mt-3 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-green-400 transition-all duration-500"
              style={{ width: `${Math.min(100, ((s(ENTITIES.grid.exportPower) ? parseFloat(s(ENTITIES.grid.exportPower)!.state) || 0 : 0) / 3000) * 100)}%` }}
            />
          </div>
        </div>

        {/* Energy In today */}
        {ENTITIES.grid.importEnergy ? (
          <div className="bg-blue-500/8 rounded-2xl p-4 border border-blue-500/25">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-blue-400">↓ Energy In</p>
            <p className="text-2xl font-bold font-mono leading-none text-blue-200">
              {fmtWithUnit(s(ENTITIES.grid.importEnergy), 2)}
            </p>
            <div className="mt-3 h-1 bg-slate-700 rounded-full" />
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/30" />
        )}
      </div>

      {/* ── Lights grid ── */}
      <div className="flex-1 min-h-0 flex flex-col">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex-shrink-0">
          💡 Lights
        </p>
        <div
          className="flex-1 grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gridAutoRows: '1fr' }}
        >
          {ENTITIES.lights.map((light) => {
            const ls = s(light.id);
            const isOn = ls?.state === 'on';
            return (
              <button
                key={light.id}
                onClick={() => toggleLight(light.id, ls?.state ?? 'off')}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border transition-all duration-300 cursor-pointer p-3
                  ${isOn
                    ? 'bg-yellow-500/15 border-yellow-400/50 shadow-[0_0_24px_rgba(234,179,8,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-750'
                  }`}
              >
                {/* Bulb icon */}
                <div className={`relative transition-all duration-300 ${isOn ? 'scale-110' : 'scale-100 opacity-30'}`}>
                  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
                    {/* Glow behind bulb when on */}
                    {isOn && (
                      <circle cx="12" cy="10" r="7" fill="rgba(250,204,21,0.15)" />
                    )}
                    {/* Bulb glass */}
                    <path
                      d="M12 2C8.69 2 6 4.69 6 8c0 2.22 1.21 4.16 3 5.19V15a1 1 0 001 1h4a1 1 0 001-1v-1.81C16.79 12.16 18 10.22 18 8c0-3.31-2.69-6-6-6z"
                      fill={isOn ? 'rgba(250,204,21,0.9)' : 'rgba(148,163,184,0.4)'}
                    />
                    {/* Base */}
                    <rect x="9" y="16" width="6" height="1.5" rx="0.5" fill={isOn ? 'rgba(180,140,10,0.9)' : 'rgba(100,116,139,0.5)'} />
                    <rect x="9.5" y="18" width="5" height="1.5" rx="0.75" fill={isOn ? 'rgba(160,120,8,0.9)' : 'rgba(71,85,105,0.5)'} />
                    {/* Filament lines */}
                    <path
                      d="M10.5 11.5 L12 9 L13.5 11.5"
                      stroke={isOn ? 'rgba(255,255,255,0.6)' : 'rgba(148,163,184,0.2)'}
                      strokeWidth="0.8"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Outer glow ring */}
                  {isOn && (
                    <div className="absolute inset-0 rounded-full bg-yellow-400/10 blur-md -z-10 scale-150" />
                  )}
                </div>

                {/* Name */}
                <span className={`text-xs font-medium text-center leading-tight transition-colors duration-300 ${isOn ? 'text-yellow-100' : 'text-slate-500'}`}>
                  {light.name}
                </span>

                {/* ON/OFF pill */}
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full transition-all duration-300
                  ${isOn ? 'bg-yellow-400/20 text-yellow-300' : 'bg-slate-700 text-slate-600'}`}>
                  {isOn ? 'ON' : 'OFF'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
