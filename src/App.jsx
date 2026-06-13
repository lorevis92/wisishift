import { useState, useEffect, useRef, useLayoutEffect } from "react";

// ─── FONTS (same as WisiInvesting) ───────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap";
document.head.appendChild(fontLink);

// ─── THEME (identical to WisiInvesting) ──────────────────────────────────────
const T = {
  bg:            "#FFFFFF",
  surface:       "#F8F8F8",
  surfaceAlt:    "#F0F0F0",
  border:        "#E8E8E8",
  text:          "#111111",
  textSecondary: "#666666",
  textMuted:     "#AAAAAA",
  primary:       "#E8352A",
  primaryLight:  "rgba(232,53,42,0.06)",
  primaryBorder: "rgba(232,53,42,0.18)",
  green:         "#00996A",
  greenLight:    "rgba(0,153,106,0.06)",
  blue:          "#0277BD",
};

// ─── SHIFT ENGINE ────────────────────────────────────────────────────────────
// 28-day cycle:
// Days  1-3:  Morning   (06-14)
// Days  4-6:  Afternoon (14-22)
// Day   7:    OFF
// Days  8-10: Afternoon (14-22)
// Days 11-14: Night     (22-06)
// Days 15-17: OFF
// Days 18-21: Morning   (06-14)
// Days 22-24: Night     (22-06)
// Days 25-28: OFF

const CYCLE = [
  "morning","morning","morning",
  "afternoon","afternoon","afternoon",
  "off",
  "afternoon","afternoon","afternoon",
  "night","night","night","night",
  "off","off","off",
  "morning","morning","morning","morning",
  "night","night","night",
  "off","off","off","off",
];

const TEAM_ORDER = ["yellow","blue","red","green"];

function toDateKey(date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function getShiftForDate(team, date) {
  const anchors = {
    green:  20250525,
    blue:   20250511,
    red:    20250518,
    yellow: 20250504,
  };
  const anchorKey = anchors[team];
  const anchorDate = new Date(
    Math.floor(anchorKey / 10000),
    Math.floor((anchorKey % 10000) / 100) - 1,
    anchorKey % 100
  );
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((targetDate - anchorDate) / 86400000);
  const cycleDay = (((diffDays - 1) % 28) + 28) % 28;
  return CYCLE[cycleDay];
}

const TEAM_META = {
  green:  { primary: "#00996A", light: "rgba(0,153,106,0.06)",  border: "rgba(0,153,106,0.20)",  name: "Green"  },
  blue:   { primary: "#0277BD", light: "rgba(2,119,189,0.06)",  border: "rgba(2,119,189,0.20)",  name: "Blue"   },
  red:    { primary: "#E8352A", light: "rgba(232,53,42,0.06)",  border: "rgba(232,53,42,0.20)",  name: "Red"    },
  yellow: { primary: "#C8A800", light: "rgba(200,168,0,0.06)",  border: "rgba(200,168,0,0.20)",  name: "Yellow" },
};

const SHIFT_META = {
  morning:        { label: "Morning",   short: "MOR", icon: "☀️",  time: "06:00 – 14:00", color: "#B87000", bg: "rgba(184,112,0,0.06)",  border: "rgba(184,112,0,0.18)"  },
  afternoon:      { label: "Afternoon", short: "AFT", icon: "🌤️", time: "14:00 – 22:00", color: "#0277BD", bg: "rgba(2,119,189,0.06)",  border: "rgba(2,119,189,0.18)"  },
  night:          { label: "Night",     short: "NGT", icon: "🌙",  time: "22:00 – 06:00", color: "#6B21A8", bg: "rgba(107,33,168,0.06)", border: "rgba(107,33,168,0.18)" },
  off:            { label: "Day Off",   short: "—",   icon: "😴",  time: "Free day",      color: "#AAAAAA", bg: "transparent",           border: T.border                },
  morning_sunday: { label: "Morning",   short: "MOR", icon: "☀️",  time: "06:00 – 18:00", color: "#B87000", bg: "rgba(184,112,0,0.06)",  border: "rgba(184,112,0,0.18)"  },
  night_sunday:   { label: "Night",     short: "NGT", icon: "🌙",  time: "18:00 – 06:00", color: "#6B21A8", bg: "rgba(107,33,168,0.06)", border: "rgba(107,33,168,0.18)" },
};

function getShiftTimes(shiftType, shiftStart) {
  if (shiftType === "off") return "Free day";
  const is5am = shiftStart === "5am";
  const times = {
    morning:        is5am ? "05:00 – 13:00" : "06:00 – 14:00",
    afternoon:      is5am ? "13:00 – 21:00" : "14:00 – 22:00",
    night:          is5am ? "21:00 – 05:00" : "22:00 – 06:00",
    morning_sunday: is5am ? "05:00 – 17:00" : "06:00 – 18:00",
    night_sunday:   is5am ? "17:00 – 05:00" : "18:00 – 06:00",
  };
  return times[shiftType] || "—";
}

function sameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function getDaysInMonth(year, month) {
  return new Date(year, month+1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  let d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function getEffectiveShift(team, date) {
  const base = getShiftForDate(team, date);
  if (date.getDay() !== 0) return base;
  if (base === "morning") return "morning_sunday";
  if (base === "night")   return "night_sunday";
  return "off";
}

function getAdjacentTeams(myTeam, date) {
  if (date.getDay() === 0) {
    const myEffective = getEffectiveShift(myTeam, date);
    if (myEffective === "off") return { before: null, after: null, myShift: "off" };
    if (myEffective === "morning_sunday") {
      const after = TEAM_ORDER.find(t => t !== myTeam && getEffectiveShift(t, date) === "night_sunday") || null;
      return { before: null, after, myShift: "morning_sunday", beforeShift: null, afterShift: "night_sunday" };
    }
    if (myEffective === "night_sunday") {
      const before = TEAM_ORDER.find(t => t !== myTeam && getEffectiveShift(t, date) === "morning_sunday") || null;
      return { before, after: null, myShift: "night_sunday", beforeShift: "morning_sunday", afterShift: null };
    }
    return { before: null, after: null, myShift: myEffective };
  }
  const myShift = getShiftForDate(myTeam, date);
  if (myShift === "off") return { before: null, after: null, myShift };
  const shiftOrder = ["morning","afternoon","night"];
  const myIdx = shiftOrder.indexOf(myShift);
  const beforeShift = shiftOrder[(myIdx - 1 + 3) % 3];
  const afterShift  = shiftOrder[(myIdx + 1) % 3];
  const before = TEAM_ORDER.find(t => t !== myTeam && getShiftForDate(t, date) === beforeShift) || null;
  const after  = TEAM_ORDER.find(t => t !== myTeam && getShiftForDate(t, date) === afterShift)  || null;
  return { before, after, myShift, beforeShift, afterShift };
}

// ─── BADGE COMPONENTS (same style as WisiInvesting) ──────────────────────────
function ShiftBadge({ shift }) {
  const sm = SHIFT_META[shift];
  return (
    <span style={{
      background: sm.bg, color: sm.color, border: `1px solid ${sm.border}`,
      fontSize: 10, fontWeight: 700, borderRadius: 3, padding: "2px 8px",
      textTransform: "uppercase", letterSpacing: "0.08em",
      fontFamily: "'Syne', sans-serif",
    }}>{sm.icon} {sm.label.toUpperCase()}</span>
  );
}

function TeamBadge({ team }) {
  const tm = TEAM_META[team];
  return (
    <span style={{
      background: tm.light, color: tm.primary, border: `1px solid ${tm.border}`,
      fontSize: 10, fontWeight: 700, borderRadius: 3, padding: "2px 6px",
      textTransform: "uppercase", letterSpacing: "0.08em",
      fontFamily: "'Syne', sans-serif",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: tm.primary, display: "inline-block" }} />
      TEAM {tm.name.toUpperCase()}
    </span>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const today = new Date();
  const [selectedTeam, setSelectedTeam] = useState(() => localStorage.getItem("wisishift_team") || null);
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installState, setInstallState] = useState('idle');
  const [shiftOverviewOpen, setShiftOverviewOpen] = useState(false);
  const [role, setRole] = useState(() => localStorage.getItem('wisishift_role') || 'opr');
  const [shiftStart, setShiftStart] = useState(() => localStorage.getItem('wisishift_start') || '6am');

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (selectedTeam) localStorage.setItem("wisishift_team", selectedTeam);
  }, [selectedTeam]);

  useEffect(() => {
    localStorage.setItem('wisishift_role', role);
  }, [role]);

  useEffect(() => {
    localStorage.setItem('wisishift_start', shiftStart);
  }, [shiftStart]);

  const [popoverRect, setPopoverRect] = useState(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!popoverRect) return;
    const onKey = (e) => { if (e.key === 'Escape') { setSelectedDay(null); setPopoverRect(null); } };
    const onDown = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) { setSelectedDay(null); setPopoverRect(null); } };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [popoverRect]);

  useLayoutEffect(() => {
    if (!popoverRect || !popoverRef.current) return;
    const el = popoverRef.current;
    const pw = el.offsetWidth;
    const ph = el.offsetHeight;
    let left = popoverRect.right + 8;
    if (left + pw > window.innerWidth) left = popoverRect.left - pw - 8;
    let top = popoverRect.top;
    if (top + ph > window.innerHeight) top = popoverRect.bottom - ph;
    if (top < 8) top = 8;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.opacity = '1';
  }, [popoverRect]);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!selectedTeam) return <Onboarding onSelect={setSelectedTeam} today={today} isMobile={isMobile} shiftStart={shiftStart} setShiftStart={setShiftStart} />;

  const tm = TEAM_META[selectedTeam];
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString("en-US", { month: "long" });
  const daysCount = getDaysInMonth(viewYear, viewMonth);
  const firstDay  = getFirstDayOfMonth(viewYear, viewMonth);
  const adj = getAdjacentTeams(selectedTeam, today);
  const todayShift = getShiftForDate(selectedTeam, today);
  const sm = SHIFT_META[todayShift];

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysCount; d++) days.push(d);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y=>y-1); setViewMonth(11); }
    else setViewMonth(m=>m-1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y=>y+1); setViewMonth(0); }
    else setViewMonth(m=>m+1);
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'Syne', system-ui, sans-serif", fontSize: 15 }}>

      {/* ── HEADER ── */}
      <header style={{ background: T.bg, borderBottom: `1px solid ${T.border}`, padding: isMobile ? "8px 12px" : "12px 20px", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              onClick={() => { setSelectedTeam(null); window.scrollTo(0, 0); }}
              style={{ display: "flex", alignItems: "center", gap: 2, cursor: "pointer" }}
            >
              <img src="/logo-wisi.png" height={isMobile ? 40 : 56} alt="WISI" style={{ display: "block" }} />
              <span style={{ fontWeight: 800, color: "#E8352A", letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 13 : 16 }}>SHIFT</span>
            </div>
            <TeamBadge team={selectedTeam} />
            <span style={{
              background: "#F8F8F8", color: "#666666", border: "1px solid #E8E8E8",
              fontSize: 10, fontWeight: 700, borderRadius: 3, padding: "2px 6px",
              textTransform: "uppercase", letterSpacing: "0.08em",
              fontFamily: "'Syne', sans-serif",
            }}>{shiftStart.toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {installPrompt && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={async () => {
                    setInstallState('installing');
                    installPrompt.prompt();
                    const { outcome } = await installPrompt.userChoice;
                    if (outcome === 'accepted') {
                      setInstallState('done');
                    } else {
                      setInstallState('error');
                    }
                    setTimeout(() => { setInstallState('idle'); setInstallPrompt(null); }, 3000);
                  }}
                  style={{
                    background: T.primary, border: "none",
                    borderRadius: 3, color: "#fff",
                    fontSize: 10, fontWeight: 700, padding: "6px 12px",
                    cursor: "pointer", fontFamily: "'Syne', sans-serif",
                    letterSpacing: "0.07em", textTransform: "uppercase",
                  }}
                >Install App</button>
                {installState === 'installing' && (
                  <span style={{ fontSize: 10, color: T.textSecondary, fontFamily: "'Syne', sans-serif" }}>Installing...</span>
                )}
                {installState === 'done' && (
                  <span style={{ fontSize: 10, color: T.green, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>✓ Installed!</span>
                )}
                {installState === 'error' && (
                  <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'Syne', sans-serif" }}>Dismissed</span>
                )}
              </div>
            )}
            <button
              onClick={() => setSelectedTeam(null)}
              style={{
                background: "transparent", border: `1px solid ${T.border}`,
                borderRadius: 3, color: T.textSecondary,
                fontSize: 10, fontWeight: 700, padding: "6px 12px",
                cursor: "pointer", fontFamily: "'Syne', sans-serif",
                letterSpacing: "0.07em", textTransform: "uppercase",
              }}
            >Change team</button>
          </div>
        </div>
      </header>

      <main style={{ padding: isMobile ? "16px" : "28px 20px", maxWidth: 760, margin: "0 auto", boxSizing: "border-box", width: "100%" }}>

        {/* ── TODAY CARD ── */}
        <div style={{
          background: T.bg, border: `1px solid ${T.border}`,
          borderRadius: 6, padding: "24px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 14, fontFamily: "'Syne', sans-serif" }}>
            Today — {today.toLocaleString("en-US", { weekday: "long", day: "numeric", month: "long" })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            {/* Left: today's shift */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 36 }}>{sm.icon}</span>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: sm.color, letterSpacing: "0.04em", fontFamily: "Georgia, 'Times New Roman', serif" }}>
                    {sm.label}
                  </div>
                  <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: "'DM Mono', monospace" }}>{getShiftTimes(todayShift, shiftStart)}</div>
                </div>
              </div>
              <ShiftBadge shift={todayShift} />
            </div>

            {/* Right: handover info */}
            {todayShift !== "off" && (adj.before || adj.after) && (
              <div style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 4, padding: "10px 12px", minWidth: 200, width: "100%", alignSelf: "stretch",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 12, fontFamily: "'Syne', sans-serif" }}>
                  Shift handover
                </div>
                {adj.before && (
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: T.textSecondary, fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap" }}>Previous shift:</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: SHIFT_META[adj.beforeShift].color, fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap" }}>{SHIFT_META[adj.beforeShift].label}</span>
                    <TeamBadge team={adj.before} />
                  </div>
                )}
                {adj.after && (
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: T.textSecondary, fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap" }}>Next shift:</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: SHIFT_META[adj.afterShift].color, fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap" }}>{SHIFT_META[adj.afterShift].label}</span>
                    <TeamBadge team={adj.after} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── CALENDAR ── */}
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "24px" }}>
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button onClick={prevMonth} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3, color: T.textSecondary, width: 32, height: 32, cursor: "pointer", fontSize: 16, fontFamily: "'Syne', sans-serif" }}>‹</button>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0, letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif" }}>
              {monthName.charAt(0).toUpperCase()+monthName.slice(1)} {viewYear}
            </h2>
            <button onClick={nextMonth} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3, color: T.textSecondary, width: 32, height: 32, cursor: "pointer", fontSize: 16, fontFamily: "'Syne', sans-serif" }}>›</button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: T.textMuted, padding: "4px 0", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Syne', sans-serif" }}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
            {days.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const date = new Date(viewYear, viewMonth, day);
              const shift = getShiftForDate(selectedTeam, date);
              const dsm = SHIFT_META[shift];
              const isToday = sameDay(date, today);
              const isSelected = selectedDay && sameDay(date, selectedDay);
              const isOff = shift === "off";

              return (
                <div
                  key={day}
                  onClick={(e) => {
                    if (isMobile) {
                      setSelectedDay(isSelected ? null : date);
                      setPopoverRect(null);
                    } else {
                      if (isSelected) { setSelectedDay(null); setPopoverRect(null); }
                      else { setSelectedDay(date); setPopoverRect(e.currentTarget.getBoundingClientRect()); }
                    }
                  }}
                  style={{
                    borderRadius: 4,
                    padding: "6px 4px",
                    minHeight: isMobile ? 48 : 56,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                    cursor: "pointer",
                    background: isToday ? T.primary : isSelected ? T.primaryLight : isOff ? "transparent" : dsm.bg,
                    border: isToday ? `1.5px solid ${T.primary}` : isSelected ? `1.5px solid ${T.primaryBorder}` : `1px solid ${isOff ? T.border : dsm.border}`,
                    transition: "border-color .12s",
                  }}
                >
                  <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: isToday ? 700 : 400, color: isToday ? "#fff" : isOff ? T.textMuted : T.text, fontFamily: "'DM Mono', monospace" }}>{day}</div>
                  {!isOff && (
                    <div style={{ fontSize: 8, fontWeight: 700, color: isToday ? "#fff" : dsm.color, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif" }}>
                      {dsm.short}
                    </div>
                  )}
                  {!isOff && <div style={{ fontSize: isMobile ? 10 : 12 }}>{dsm.icon}</div>}
                </div>
              );
            })}
          </div>

        </div>


        {/* ── MONTHLY HOURS ── */}
        {(() => {
          const target = role === 'ms' ? 178 : 175.5;
          const actualHours = Array.from({ length: daysCount }, (_, i) => {
            const date = new Date(viewYear, viewMonth, i + 1);
            const shift = getEffectiveShift(selectedTeam, date);
            if (shift === "morning_sunday" || shift === "night_sunday") return 12;
            if (shift === "off") return 0;
            return 8;
          }).reduce((sum, h) => sum + h, 0);
          const flex = actualHours - target;
          const pct = Math.min((actualHours / target) * 100, 100);
          const overTarget = actualHours >= target;
          const flexColor = flex > 0 ? "#00996A" : flex < 0 ? "#E8352A" : T.textMuted;
          const flexSign  = flex > 0 ? "+" : "";
          const roleToggleBase = { fontFamily: "'Syne', sans-serif", fontSize: 10, fontWeight: 700, textTransform: "uppercase", border: "1px solid #E8E8E8", borderRadius: 3, padding: "4px 10px", cursor: "pointer", letterSpacing: "0.05em" };
          return (
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "24px", marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif" }}>
                  Monthly Hours — {monthName} {viewYear}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {['opr', 'ms'].map(r => (
                    <button key={r} onClick={() => setRole(r)} style={{ ...roleToggleBase, background: role === r ? "#E8352A" : "#F8F8F8", color: role === r ? "#FFFFFF" : "#666666" }}>
                      {r === 'opr' ? 'Opr.' : 'MS'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
                {[
                  { label: "You Will Work", value: `${actualHours}h`,               color: T.text    },
                  { label: "Target",        value: `${target}h`,                     color: T.text    },
                  { label: "Flex Hours",    value: `${flexSign}${flex.toFixed(1)}h`, color: flexColor },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: "#F0F0F0", borderRadius: 2, height: 4, marginBottom: 10, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: overTarget ? "#00996A" : "#E8352A", borderRadius: 2 }} />
              </div>

              <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'Syne', sans-serif" }}>
                Weekdays: 8h · Sundays: 12h · Monthly target: {target}h
              </div>
            </div>
          );
        })()}

        {/* ── SHIFT OVERVIEW TABLE ── */}
        {(() => {
          const teamColors = { green: "#00996A", blue: "#0277BD", red: "#E8352A", yellow: "#C8A800" };
          const teamBg     = { green: "rgba(0,153,106,0.08)", blue: "rgba(2,119,189,0.08)", red: "rgba(232,53,42,0.08)", yellow: "rgba(200,168,0,0.08)" };
          const renderBadge = (team) => (
            <span key={team} style={{
              background: teamBg[team], color: teamColors[team],
              border: `1px solid ${teamColors[team]}44`,
              fontSize: 10, fontWeight: 700, borderRadius: 3, padding: "2px 8px",
              textTransform: "uppercase", letterSpacing: "0.06em",
              fontFamily: "'Syne', sans-serif", display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: teamColors[team], display: "inline-block" }} />
              {team.charAt(0).toUpperCase() + team.slice(1)}
            </span>
          );
          const buildShiftTeams = (date) => {
            const shiftTeams = { morning: [], afternoon: [], night: [] };
            TEAM_ORDER.forEach(team => {
              const s = getShiftForDate(team, date);
              if (s !== "off" && shiftTeams[s]) shiftTeams[s].push(team);
            });
            return shiftTeams;
          };
          return (
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, marginTop: 16 }}>
              {/* Toggle header */}
              <button
                onClick={() => setShiftOverviewOpen(o => !o)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 24px", background: "transparent", border: "none", cursor: "pointer",
                  fontFamily: "'Syne', sans-serif",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#666666", letterSpacing: "0.10em", textTransform: "uppercase" }}>
                    Shift Overview
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    Daily team coverage by shift
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#666666", letterSpacing: "0.10em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {shiftOverviewOpen ? "▲ Hide" : "▼ Show"}
                </span>
              </button>

              {shiftOverviewOpen && (isMobile ? (
                /* ── Mobile: day cards ── */
                <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${T.border}` }}>
                  {Array.from({ length: daysCount }, (_, i) => {
                    const d = i + 1;
                    const date = new Date(viewYear, viewMonth, d);
                    const isToday = sameDay(date, today);
                    const isSunday = date.getDay() === 0;
                    const shiftTeams = buildShiftTeams(date);
                    const rows = isSunday
                      ? [{ key: "morning", sm: SHIFT_META.morning_sunday }, { key: "night", sm: SHIFT_META.night_sunday }]
                      : [{ key: "morning", sm: SHIFT_META.morning }, { key: "afternoon", sm: SHIFT_META.afternoon }, { key: "night", sm: SHIFT_META.night }];
                    return (
                      <div key={d} style={{
                        background: isToday ? "rgba(232,53,42,0.06)" : "#FFFFFF",
                        border: `1px solid ${T.border}`,
                        borderLeft: isToday ? "3px solid #E8352A" : `1px solid ${T.border}`,
                        borderRadius: 4, padding: "12px 16px", marginTop: i === 0 ? 12 : 0,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isToday ? T.primary : T.text, fontFamily: "'DM Mono', monospace" }}>
                            {date.toLocaleString("en-US", { day: "2-digit", month: "short" })}
                          </span>
                          <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>
                            {date.toLocaleString("en-US", { weekday: "short" })}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {rows.map(({ key, sm }) => (
                            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 11, color: sm.color, fontWeight: 700, fontFamily: "'Syne', sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
                                {sm.icon} {sm.label}
                              </span>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                {shiftTeams[key].length > 0 ? shiftTeams[key].map(renderBadge) : <span style={{ fontSize: 10, color: T.textMuted }}>—</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ── Desktop: table ── */
                <div style={{ overflowX: "auto", borderTop: `1px solid ${T.border}` }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Syne', sans-serif", fontSize: 11 }}>
                    <thead>
                      <tr>
                        {["Date", "Day", "Morning", "Afternoon", "Night"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "9px 14px", borderBottom: `1px solid ${T.border}`, fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.10em", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: daysCount }, (_, i) => {
                        const d = i + 1;
                        const date = new Date(viewYear, viewMonth, d);
                        const isToday = sameDay(date, today);
                        const isSunday = date.getDay() === 0;
                        const shiftTeams = buildShiftTeams(date);
                        return (
                          <tr key={d} style={{
                            background: isToday ? "rgba(232,53,42,0.06)" : i % 2 === 0 ? "#FFFFFF" : "#F8F8F8",
                            borderLeft: isToday ? "3px solid #E8352A" : "3px solid transparent",
                          }}>
                            <td style={{ padding: "9px 14px", borderBottom: `1px solid ${T.border}`, fontFamily: "'DM Mono', monospace", color: isToday ? T.primary : T.text, fontWeight: isToday ? 700 : 400 }}>
                              {date.toLocaleString("en-US", { day: "2-digit", month: "short" })}
                            </td>
                            <td style={{ padding: "9px 14px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>
                              {date.toLocaleString("en-US", { weekday: "short" })}
                            </td>
                            <td style={{ padding: "9px 14px", borderBottom: `1px solid ${T.border}` }}>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{shiftTeams.morning.map(renderBadge)}</div>
                            </td>
                            <td style={{ padding: "9px 14px", borderBottom: `1px solid ${T.border}` }}>
                              {!isSunday && <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{shiftTeams.afternoon.map(renderBadge)}</div>}
                            </td>
                            <td style={{ padding: "9px 14px", borderBottom: `1px solid ${T.border}` }}>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{shiftTeams.night.map(renderBadge)}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          );
        })()}
      </main>

      {/* ── DAY DETAIL BOTTOM SHEET (mobile) ── */}
      {selectedDay && isMobile && (() => {
        const myShift = getEffectiveShift(selectedTeam, selectedDay);
        const myShiftMeta = SHIFT_META[myShift];
        const dayName = selectedDay.toLocaleString("en-US", { weekday: "long" });
        const dateStr = selectedDay.toLocaleString("en-US", { day: "numeric", month: "long", year: "numeric" });
        const allTeamRows = TEAM_ORDER.map(team => {
          const shift = getEffectiveShift(team, selectedDay);
          return { team, shift, meta: SHIFT_META[shift], isOff: shift === "off" };
        }).sort((a, b) => { if (a.isOff === b.isOff) return 0; return a.isOff ? 1 : -1; });
        const close = () => setSelectedDay(null);
        return (
          <>
            <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }} />
            <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: "#fff", borderRadius: "16px 16px 0 0", padding: "20px 20px 32px", boxShadow: "0 -4px 24px rgba(0,0,0,0.12)" }}>
              <div style={{ width: 40, height: 4, background: "#E8E8E8", borderRadius: 2, margin: "0 auto 16px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif" }}>
                  {dayName} — {dateStr}
                </div>
                <button onClick={close} style={{ background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 4, marginLeft: 8 }}>×</button>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>My Shift</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "12px 14px", background: T.surface, borderRadius: 4 }}>
                {myShift === "off" ? (
                  <span style={{ fontSize: 14, color: T.textMuted, fontFamily: "'Syne', sans-serif" }}>😴 Day off</span>
                ) : (
                  <>
                    <span style={{ fontSize: 22 }}>{myShiftMeta.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: myShiftMeta.color, fontFamily: "'Syne', sans-serif" }}>{myShiftMeta.label}</span>
                    <span style={{ fontSize: 13, color: T.textSecondary, fontFamily: "'DM Mono', monospace" }}>{getShiftTimes(myShift, shiftStart)}</span>
                  </>
                )}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>Who Is Working</div>
              <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
                {allTeamRows.map(({ team, shift, meta, isOff }) => {
                  const isMyTeam = team === selectedTeam;
                  const tm2 = TEAM_META[team];
                  return (
                    <div key={team} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                      background: isMyTeam ? "rgba(232,53,42,0.06)" : T.bg,
                      borderLeft: isMyTeam ? "3px solid #E8352A" : "3px solid transparent",
                      borderBottom: `1px solid ${T.border}`,
                    }}>
                      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: tm2.primary, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: tm2.primary, fontFamily: "'Syne', sans-serif", width: 48, flexShrink: 0 }}>{tm2.name}</span>
                      {isOff ? (
                        <span style={{ fontSize: 13, color: T.textMuted, fontFamily: "'Syne', sans-serif" }}>— Day off</span>
                      ) : (
                        <>
                          <span style={{ fontSize: 16 }}>{meta.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: meta.color, fontFamily: "'Syne', sans-serif" }}>{meta.label}</span>
                          <span style={{ fontSize: 12, color: T.textSecondary, fontFamily: "'DM Mono', monospace" }}>{getShiftTimes(shift, shiftStart)}</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        );
      })()}

      {/* ── DAY DETAIL POPOVER (desktop) ── */}
      {selectedDay && !isMobile && popoverRect && (() => {
        const myShift = getEffectiveShift(selectedTeam, selectedDay);
        const myShiftMeta = SHIFT_META[myShift];
        const dayName = selectedDay.toLocaleString("en-US", { weekday: "long" });
        const dateStr = selectedDay.toLocaleString("en-US", { day: "numeric", month: "long", year: "numeric" });
        const allTeamRows = TEAM_ORDER.map(team => {
          const shift = getEffectiveShift(team, selectedDay);
          return { team, shift, meta: SHIFT_META[shift], isOff: shift === "off" };
        }).sort((a, b) => { if (a.isOff === b.isOff) return 0; return a.isOff ? 1 : -1; });
        return (
          <div ref={popoverRef} style={{
            position: 'fixed', left: popoverRect.right + 8, top: popoverRect.top,
            opacity: 0, zIndex: 100,
            background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6,
            padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            minWidth: 260, maxWidth: 320,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif" }}>
                {dayName} — {dateStr}
              </div>
              <button onClick={() => { setSelectedDay(null); setPopoverRect(null); }} style={{ background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 4, marginLeft: 8 }}>×</button>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>My Shift</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 12px", background: T.surface, borderRadius: 4 }}>
              {myShift === "off" ? (
                <span style={{ fontSize: 13, color: T.textMuted, fontFamily: "'Syne', sans-serif" }}>😴 Day off</span>
              ) : (
                <>
                  <span style={{ fontSize: 20 }}>{myShiftMeta.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: myShiftMeta.color, fontFamily: "'Syne', sans-serif" }}>{myShiftMeta.label}</span>
                  <span style={{ fontSize: 12, color: T.textSecondary, fontFamily: "'DM Mono', monospace" }}>{getShiftTimes(myShift, shiftStart)}</span>
                </>
              )}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>Who Is Working</div>
            <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
              {allTeamRows.map(({ team, shift, meta, isOff }) => {
                const isMyTeam = team === selectedTeam;
                const tm2 = TEAM_META[team];
                return (
                  <div key={team} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                    background: isMyTeam ? "rgba(232,53,42,0.06)" : T.bg,
                    borderLeft: isMyTeam ? "3px solid #E8352A" : "3px solid transparent",
                    borderBottom: `1px solid ${T.border}`,
                  }}>
                    <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: tm2.primary, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: tm2.primary, fontFamily: "'Syne', sans-serif", width: 46, flexShrink: 0 }}>{tm2.name}</span>
                    {isOff ? (
                      <span style={{ fontSize: 12, color: T.textMuted, fontFamily: "'Syne', sans-serif" }}>— Day off</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 14 }}>{meta.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: meta.color, fontFamily: "'Syne', sans-serif" }}>{meta.label}</span>
                        <span style={{ fontSize: 11, color: T.textSecondary, fontFamily: "'DM Mono', monospace" }}>{getShiftTimes(shift, shiftStart)}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${T.border}`, background: T.surface, padding: isMobile ? "16px" : "20px", marginTop: 40 }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: T.textSecondary, fontFamily: "'Syne', sans-serif" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Part of the</span>
                <img src="/logo-wisiverse.png" height={24} alt="WiSiVERSE" style={{ display: "block" }} />
                <span>ecosystem</span>
              </div>
            </span>
          </div>
          <a href="https://wisiverse.com" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: T.primary, fontWeight: 700, fontFamily: "'Syne', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}>
            wisiverse.com →
          </a>
        </div>
      </footer>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({ onSelect, today, isMobile, shiftStart, setShiftStart }) {
  const shiftToggleBase = { fontFamily: "'Syne', sans-serif", fontSize: 10, fontWeight: 700, textTransform: "uppercase", border: "1px solid #E8E8E8", borderRadius: 3, padding: "4px 10px", cursor: "pointer", letterSpacing: "0.05em" };
  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'Syne', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: T.bg, borderBottom: `1px solid ${T.border}`, padding: isMobile ? "8px 12px" : "12px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, justifyContent: isMobile ? "center" : "flex-start" }}>
          <img src="/logo-wisi.png" height={isMobile ? 40 : 56} alt="WISI" style={{ display: "block" }} />
          <span style={{ fontWeight: 800, color: "#E8352A", letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 13 : 16 }}>SHIFT</span>
        </div>
      </header>

      <main style={{ padding: isMobile ? "24px 16px" : "48px 20px", maxWidth: 560, margin: "0 auto" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", padding: isMobile ? "32px 0 36px" : "48px 0 48px" }}>
          <h1 style={{ fontSize: "clamp(28px, 6vw, 52px)", fontWeight: 700, color: T.text, margin: "0 0 0", lineHeight: 1.05, letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "Georgia, 'Times New Roman', serif" }}>
            Your shifts
          </h1>
          <h1 style={{ fontSize: "clamp(28px, 6vw, 52px)", fontWeight: 700, color: T.primary, margin: "0 0 20px", lineHeight: 1.05, letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "Georgia, 'Times New Roman', serif" }}>
            always with you
          </h1>
          <p style={{ fontSize: 14, color: T.textSecondary, margin: "0 0 8px", lineHeight: 1.75 }}>
            Select your team to view the full shift calendar.
          </p>
          <p style={{ fontSize: 12, color: T.textMuted, margin: 0, fontFamily: "'DM Mono', monospace" }}>
            Your choice is saved automatically.
          </p>
        </div>

        {/* Team cards */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "'Syne', sans-serif" }}>
            What's your team color?
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {['6am', '5am'].map(v => (
              <button key={v} onClick={() => setShiftStart(v)} style={{ ...shiftToggleBase, background: shiftStart === v ? "#E8352A" : "#F8F8F8", color: shiftStart === v ? "#FFFFFF" : "#666666" }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(TEAM_META).map(([key, tm]) => {
            const todayShift = getShiftForDate(key, today);
            const sm = SHIFT_META[todayShift];
            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                style={{
                  background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6,
                  padding: "18px 20px", cursor: "pointer", textAlign: "left",
                  fontFamily: "'Syne', sans-serif", transition: "border-color .15s",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = tm.primary}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: tm.primary, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "0.06em" }}>
                      Team {tm.name}
                    </div>
                    <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Today:</span>
                      <span style={{ color: sm.color, fontWeight: 700 }}>{sm.icon} {sm.label}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", color: T.textMuted }}>{getShiftTimes(todayShift, shiftStart)}</span>
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Select →
                </span>
              </button>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${T.border}`, background: T.surface, padding: "20px", marginTop: 40 }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: T.textSecondary, fontFamily: "'Syne', sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Part of the</span>
                <img src="/logo-wisiverse.png" height={24} alt="WiSiVERSE" style={{ display: "block" }} />
                <span>ecosystem</span>
              </div>
          </span>
          <a href="https://wisiverse.com" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: T.primary, fontWeight: 700, fontFamily: "'Syne', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}>
            wisiverse.com →
          </a>
        </div>
      </footer>
    </div>
  );
}