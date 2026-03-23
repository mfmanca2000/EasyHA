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

function batteryAccent(pct: number) {
  if (pct > 50) return { border: 'border-green-500/30', label: 'text-green-400', dim: 'text-green-600', glow: 'rgba(34,197,94,', bg: 'rgba(16,30,20,1)', cellGlow: 'rgba(34,197,94,0.5)' };
  if (pct > 20) return { border: 'border-yellow-500/30', label: 'text-yellow-400', dim: 'text-yellow-600', glow: 'rgba(234,179,8,', bg: 'rgba(30,25,10,1)', cellGlow: 'rgba(234,179,8,0.5)' };
  return { border: 'border-red-500/30', label: 'text-red-400', dim: 'text-red-600', glow: 'rgba(239,68,68,', bg: 'rgba(30,10,10,1)', cellGlow: 'rgba(239,68,68,0.5)' };
}

function batteryStatus(pct: number): string {
  if (pct > 80) return 'Fully Charged';
  if (pct > 50) return 'Good Range';
  if (pct > 20) return 'Moderate';
  if (pct > 10) return 'Low Battery';
  return 'Critical!';
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
          {error && <span className="text-red-400 text-xs">⚠ {error}</span>}
          <span className="text-xs text-slate-500">{lastUpdate}</span>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>

      {/* ── Row 1: Solar panels ── */}
      <div className="flex-shrink-0 grid grid-cols-3 gap-2">
        {ENTITIES.solar.panels.map((panel, i) => {
          const ps = PANEL_STYLES[i] ?? PANEL_STYLES[0];
          const val = s(panel.id);
          const watts = val ? parseFloat(val.state) || 0 : 0;
          return (
            <div key={panel.id} className={`${ps.bg} rounded-xl p-2.5 border ${ps.border}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${ps.label}`}>
                ☀ {panel.name}
              </p>
              <p className={`text-lg font-bold font-mono leading-none ${ps.value}`}>
                {fmtWithUnit(val)}
              </p>
              <div className="mt-1.5 h-1 bg-slate-700 rounded-full overflow-hidden">
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
      <div className="flex-shrink-0 grid grid-cols-3 gap-2">
        {/* Import Power */}
        <div className="bg-red-500/8 rounded-xl p-2.5 border border-red-500/25">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 text-red-400">↓ Import</p>
          <p className="text-lg font-bold font-mono leading-none text-red-200">
            {fmtWithUnit(s(ENTITIES.grid.importPower))}
          </p>
          <div className="mt-1.5 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-red-400 transition-all duration-500"
              style={{ width: `${Math.min(100, ((s(ENTITIES.grid.importPower) ? parseFloat(s(ENTITIES.grid.importPower)!.state) || 0 : 0) / 3000) * 100)}%` }}
            />
          </div>
        </div>

        {/* Export Power */}
        <div className="bg-green-500/8 rounded-xl p-2.5 border border-green-500/25">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 text-green-400">↑ Export</p>
          <p className="text-lg font-bold font-mono leading-none text-green-200">
            {fmtWithUnit(s(ENTITIES.grid.exportPower))}
          </p>
          <div className="mt-1.5 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-green-400 transition-all duration-500"
              style={{ width: `${Math.min(100, ((s(ENTITIES.grid.exportPower) ? parseFloat(s(ENTITIES.grid.exportPower)!.state) || 0 : 0) / 3000) * 100)}%` }}
            />
          </div>
        </div>

        {/* Energy In today */}
        {ENTITIES.grid.importEnergy ? (
          <div className="bg-blue-500/8 rounded-xl p-2.5 border border-blue-500/25">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 text-blue-400">↓ Energy In</p>
            <p className="text-lg font-bold font-mono leading-none text-blue-200">
              {fmtWithUnit(s(ENTITIES.grid.importEnergy), 2)}
            </p>
            <div className="mt-1.5 h-1 bg-slate-700 rounded-full" />
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-700/30" />
        )}
      </div>

      {/* ── Lights grid ── */}
      <div className="flex-1 min-h-0 flex flex-col">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 flex-shrink-0">
          💡 Lights
        </p>
        <div
          className="grid gap-2 overflow-y-auto"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))', gridAutoRows: '92px' }}
        >
          {ENTITIES.lights.map((light) => {
            const ls = s(light.id);
            const isOn = ls?.state === 'on';
            return (
              <button
                key={light.id}
                onClick={() => toggleLight(light.id, ls?.state ?? 'off')}
                className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden
                  ${isOn
                    ? 'border-yellow-400/50 shadow-[0_0_18px_rgba(234,179,8,0.4),0_4px_12px_rgba(0,0,0,0.5)]'
                    : 'border-slate-700/70 shadow-[0_2px_8px_rgba(0,0,0,0.4)] hover:border-slate-600 hover:shadow-[0_4px_12px_rgba(0,0,0,0.5)]'
                  }`}
                style={{
                  background: isOn
                    ? 'radial-gradient(ellipse at 50% -10%, rgba(253,224,71,0.28) 0%, rgba(234,179,8,0.10) 50%, rgba(15,23,42,0.97) 100%)'
                    : 'linear-gradient(160deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,1) 100%)',
                }}
              >
                {/* Glow orb behind icon */}
                {isOn && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 w-14 h-14 rounded-full bg-yellow-300/30 blur-xl pointer-events-none" />
                )}

                {/* Bulb icon */}
                <div className={`relative z-10 transition-all duration-300 ${isOn ? 'scale-115 drop-shadow-[0_0_6px_rgba(253,224,71,0.9)]' : 'opacity-20'}`}>
                  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
                    <path
                      d="M12 2C8.69 2 6 4.69 6 8c0 2.22 1.21 4.16 3 5.19V15a1 1 0 001 1h4a1 1 0 001-1v-1.81C16.79 12.16 18 10.22 18 8c0-3.31-2.69-6-6-6z"
                      fill={isOn ? '#fde047' : 'rgba(148,163,184,0.6)'}
                    />
                    <rect x="9" y="16" width="6" height="1.5" rx="0.5" fill={isOn ? '#ca8a04' : 'rgba(100,116,139,0.6)'} />
                    <rect x="9.5" y="18" width="5" height="1.5" rx="0.75" fill={isOn ? '#a16207' : 'rgba(71,85,105,0.6)'} />
                    <path
                      d="M10.5 11.5 L12 9 L13.5 11.5"
                      stroke={isOn ? 'rgba(255,255,255,0.75)' : 'rgba(148,163,184,0.2)'}
                      strokeWidth="0.9" fill="none" strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* Name */}
                <span className={`relative z-10 text-[9px] font-semibold text-center leading-tight tracking-wide transition-colors duration-300 px-1
                  ${isOn ? 'text-yellow-100' : 'text-slate-500'}`}>
                  {light.name}
                </span>

                {/* Bottom accent line */}
                <div className={`absolute bottom-0 left-0 right-0 h-[2px] transition-opacity duration-300
                  ${isOn ? 'opacity-100' : 'opacity-0'}`}
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(253,224,71,0.7), transparent)' }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tesla Battery Row ── */}
      {(() => {
        const acc = batteryAccent(teslaPct);
        return (
          <div
            className={`flex-shrink-0 relative overflow-hidden rounded-2xl border ${acc.border}`}
            style={{
              background: `linear-gradient(135deg, ${acc.bg} 0%, rgba(15,23,42,1) 100%)`,
              boxShadow: `0 0 32px ${acc.glow}0.12), inset 0 1px 0 rgba(255,255,255,0.04)`,
            }}
          >
            {/* Ambient radial glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 15% 50%, ${acc.glow}0.1) 0%, transparent 65%)` }}
            />

            <div className="relative flex items-center gap-4 px-4 py-3">

              {/* Left: Tesla icon + label */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0 w-10">
                <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
                  {/* Stylised car silhouette */}
                  <path
                    d="M3 14h18M5 14l1.5-4h11L19 14M5 14v2.5a.5.5 0 00.5.5H7a.5.5 0 00.5-.5V16h9v.5a.5.5 0 00.5.5h1.5a.5.5 0 00.5-.5V14"
                    stroke={`${acc.glow}0.9)`}
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Wheels */}
                  <circle cx="7.5" cy="17" r="1.3" fill={`${acc.glow}0.7)`} />
                  <circle cx="16.5" cy="17" r="1.3" fill={`${acc.glow}0.7)`} />
                  {/* Windshield hint */}
                  <path d="M8 10l1-3h6l1 3" stroke={`${acc.glow}0.5)`} strokeWidth="1" strokeLinecap="round" />
                </svg>
                <span className={`text-[8px] font-black uppercase tracking-widest ${acc.label}`}>Tesla</span>
              </div>

              {/* Center: battery shape + status */}
              <div className="flex-1 flex flex-col gap-1.5">

                {/* Battery shape */}
                <div className="relative flex items-center h-7">
                  {/* Outer shell */}
                  <div className="flex-1 relative h-full rounded-lg border border-slate-600/50 overflow-hidden bg-slate-900/60">
                    {/* Glowing fill */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 ${batteryColor(teslaPct)} transition-all duration-1000 ease-out`}
                      style={{
                        width: `${teslaPct}%`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 0 10px ${acc.cellGlow}`,
                      }}
                    />
                    {/* Shine overlay on fill */}
                    <div
                      className="absolute left-0 top-0 h-1/2 pointer-events-none transition-all duration-1000"
                      style={{
                        width: `${teslaPct}%`,
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)',
                      }}
                    />
                    {/* Cell dividers */}
                    {[25, 50, 75].map((pos) => (
                      <div
                        key={pos}
                        className="absolute top-1 bottom-1 w-px bg-slate-900/70 z-10"
                        style={{ left: `${pos}%` }}
                      />
                    ))}
                  </div>
                  {/* Battery terminal nub */}
                  <div className="w-1.5 h-3.5 rounded-r-sm flex-shrink-0 border border-slate-600/50 bg-slate-700/60 -ml-px" />
                </div>

                {/* Status + cell labels */}
                <div className="flex items-center justify-between px-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${acc.dim}`}>
                    {batteryStatus(teslaPct)}
                  </span>
                  <div className="flex gap-3">
                    {['25%', '50%', '75%'].map((t) => (
                      <span key={t} className="text-[8px] text-slate-600 font-mono">{t}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: big percentage */}
              <div className="flex-shrink-0 flex flex-col items-end justify-center min-w-[3.5rem]">
                <div className="flex items-end leading-none gap-0.5">
                  <span
                    className={`text-3xl font-black font-mono tabular-nums ${batteryTextColor(teslaPct)}`}
                    style={{ textShadow: `0 0 24px ${acc.glow}0.6)` }}
                  >
                    {teslaState ? teslaPct : '—'}
                  </span>
                  {teslaState && (
                    <span className={`text-sm font-bold mb-0.5 ${acc.dim}`}>%</span>
                  )}
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
