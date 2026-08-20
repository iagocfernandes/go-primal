"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "./Icons";
import {
  activityReward,
  BuildingKey,
  buildingCost,
  buildingDescription,
  buildingLabel,
  event,
  GameState,
  gorillaImage,
  gorillaLevel,
  gorillaStage,
  gorillaStageNames,
  initialState,
  raidProbability,
  stageImage,
  Village,
  villagePower,
  villageStage,
  villageStageNames,
} from "@/lib/game";

type Screen = "village" | "activity" | "gorilla" | "kingdom" | "missions" | "target" | "building";
type Reward = ReturnType<typeof activityReward> & { kind: "train" | "focus" | "move" };

const STORAGE_KEY = "go-primal-web-alpha-v051";
const buildingOrder: BuildingKey[] = ["hall", "forge", "barracks", "lab"];

function buildingImage(key: BuildingKey, level: number) {
  const visualStage = Math.max(1, Math.min(5, 1 + Math.floor((level - 1) / 2)));
  return `/assets/building-${key}-${visualStage}.jpg`;
}

function villageCardImage(v: Village) {
  return `/assets/rival-village-${Math.max(1, Math.min(5, v.id))}.jpg`;
}

const gorillaStageCopy = [
  { age: "Young", scale: "Compact", presence: "Learning" },
  { age: "Adult", scale: "Growing", presence: "Confident" },
  { age: "Mature", scale: "Heavy", presence: "Proven" },
  { age: "Battle-aged", scale: "Massive", presence: "Feared" },
  { age: "Elder", scale: "Dominant", presence: "Legendary" },
] as const;

export default function GoPrimalApp() {
  const [state, setState] = useState<GameState>(initialState);
  const [screen, setScreen] = useState<Screen>("village");
  const [building, setBuilding] = useState<BuildingKey>("hall");
  const [targetId, setTargetId] = useState<number | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [activityTab, setActivityTab] = useState<"train" | "focus" | "move">("train");
  const [stepsInput, setStepsInput] = useState(6200);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [focusRunning, setFocusRunning] = useState(false);
  const [previewGorillaStage, setPreviewGorillaStage] = useState<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setState(JSON.parse(raw)); } catch {}
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  useEffect(() => {
    if (!focusRunning || focusSeconds <= 0) return;
    const timer = setInterval(() => setFocusSeconds((v) => {
      if (v <= 1) {
        setFocusRunning(false);
        return 0;
      }
      return v - 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [focusRunning, focusSeconds]);

  useEffect(() => {
    if (!state.warActive) return;
    const timer = setInterval(() => {
      setState((s) => {
        if (!s.warActive) return s;
        const gain = 35 + Math.floor(Math.random() * 76);
        return {
          ...s,
          enemyScore: s.enemyScore + gain,
          eventLog: [event("danger", "Red Skull moved", `Simulated rival activity added +${gain} War Score.`), ...s.eventLog].slice(0, 12),
        };
      });
    }, 12000);
    return () => clearInterval(timer);
  }, [state.warActive]);

  useEffect(() => {
    const pending = state.villages.find((v) => v.relation === "pending");
    if (!pending) return;
    const timer = setTimeout(() => {
      setState((s) => ({
        ...s,
        villages: s.villages.map((v) => v.id === pending.id ? { ...v, relation: pending.id % 2 ? "ally" : "neutral" } : v),
        eventLog: [
          event(pending.id % 2 ? "good" : "neutral", pending.id % 2 ? "Alliance accepted" : "Alliance declined", pending.id % 2 ? `${pending.name} accepted your pact. Joint raids are now available.` : `${pending.name} chose to remain neutral.`),
          ...s.eventLog,
        ].slice(0, 12),
      }));
    }, 6500);
    return () => clearTimeout(timer);
  }, [state.villages]);

  const power = useMemo(() => villagePower(state), [state]);
  const vStage = villageStage(state);
  const gStage = gorillaStage(state.xp);
  const target = state.villages.find((v) => v.id === targetId) ?? null;
  const actualGorillaImage = gorillaImage(previewGorillaStage ?? gStage);

  function pushEvent(tone: "neutral" | "good" | "danger" | "info", title: string, body: string) {
    setState((s) => ({ ...s, eventLog: [event(tone, title, body), ...s.eventLog].slice(0, 12) }));
  }

  function completeActivity(kind: "train" | "focus" | "move") {
    const r = activityReward(kind, state.activityCounts[kind], kind === "move" ? stepsInput : 0);
    setState((s) => ({
      ...s,
      energy: s.energy + r.energy,
      gold: s.gold + r.gold,
      xp: s.xp + r.xp,
      knowledge: s.knowledge + r.knowledge,
      exploration: s.exploration + r.exploration,
      stepsToday: kind === "move" ? stepsInput : s.stepsToday,
      activityCounts: { ...s.activityCounts, [kind]: s.activityCounts[kind] + 1 },
      ourScore: s.ourScore + (s.warActive ? r.warScore : 0),
      eventLog: [event("good", activityTitle(kind), `${rewardText(r)}${s.warActive ? ` · +${r.warScore} War Score.` : ""}`), ...s.eventLog].slice(0, 12),
    }));
    setReward({ ...r, kind });
    setFocusRunning(false);
    setFocusSeconds(0);
  }

  function upgradeBuilding() {
    const level = state.buildings[building];
    const cost = buildingCost(building, level);
    const missing: string[] = [];
    if (state.energy < cost.energy) missing.push(`${cost.energy - state.energy} Energy`);
    if (state.gold < cost.gold) missing.push(`${cost.gold - state.gold} Gold`);
    if (state.knowledge < cost.knowledge) missing.push(`${cost.knowledge - state.knowledge} Knowledge`);
    if (missing.length) {
      pushEvent("info", "Upgrade not ready", `You still need ${missing.join(" + ")}. The requirement is shown before you commit.`);
      return;
    }
    setState((s) => ({
      ...s,
      energy: s.energy - cost.energy,
      gold: s.gold - cost.gold,
      knowledge: s.knowledge - cost.knowledge,
      buildings: { ...s.buildings, [building]: s.buildings[building] + 1 },
      xp: s.xp + 30,
      eventLog: [event("good", `${buildingLabel(building)} grew`, `Level ${level + 1}. Your effort is now visible in the world.`), ...s.eventLog].slice(0, 12),
    }));
    setScreen("village");
  }

  function proposeAlliance(v: Village) {
    if (!v.sameKingdom) {
      pushEvent("neutral", "Not in Alpha yet", "Cross-Kingdom alliances stay locked until diplomacy has real consequences.");
      return;
    }
    setState((s) => ({
      ...s,
      villages: s.villages.map((x) => x.id === v.id ? { ...x, relation: "pending" } : x),
      eventLog: [event("info", "Alliance request sent", `${v.name} must accept before becoming an ally. Simulated response arrives in a few seconds.`), ...s.eventLog].slice(0, 12),
    }));
  }

  function endAlliance(v: Village) {
    setState((s) => ({
      ...s,
      villages: s.villages.map((x) => x.id === v.id ? { ...x, relation: "neutral" } : x),
      eventLog: [event("neutral", "Alliance ended", `${v.name} is neutral again.`), ...s.eventLog].slice(0, 12),
    }));
  }

  function raid(v: Village, joint = false) {
    if (v.relation === "ally") {
      pushEvent("neutral", "Raid blocked", "Allied villages cannot raid each other. Break the pact first.");
      return;
    }
    if (v.relation === "pending") {
      pushEvent("neutral", "Request pending", "Resolve the alliance proposal before attacking this village.");
      return;
    }
    const cost = joint ? 70 : 60;
    if (state.energy < cost) {
      pushEvent("info", "Not enough Energy", `This action costs ${cost} Energy. Train or save Energy first.`);
      return;
    }
    const allies = state.villages.filter((x) => x.relation === "ally");
    const attackPower = joint ? power + allies.reduce((sum, a) => sum + a.power * 0.68, 0) : power;
    const probability = raidProbability(attackPower, v.power);
    const won = Math.random() < probability;
    const internalModifier = v.sameKingdom ? 0.7 : 1;
    const antiBullying = attackPower > v.power * 1.5 ? 0.25 : 1;
    const loot = won ? Math.max(20, Math.round(v.loot * internalModifier * antiBullying * (joint ? 1.3 : 1))) : 0;
    const warGain = won && state.warActive && !v.sameKingdom ? (joint ? 140 : 100) : 0;
    setState((s) => ({
      ...s,
      energy: s.energy - cost,
      gold: s.gold + loot,
      xp: s.xp + (won ? (joint ? 110 : 75) : 25),
      reputation: s.reputation + (v.sameKingdom ? -12 : 0),
      ourScore: s.ourScore + warGain,
      enemyScore: s.enemyScore + (!won && s.warActive && !v.sameKingdom ? 40 : 0),
      eventLog: [event(won ? "good" : "danger", won ? `${joint ? "Warband" : "Raid"} victory` : "Raid failed", won ? `${v.name}: +${loot} Gold${warGain ? ` · +${warGain} War Score` : ""}.` : `${v.name} held. ${cost} Energy was spent.`), ...s.eventLog].slice(0, 12),
    }));
    setScreen("kingdom");
  }

  function toggleWar() {
    setState((s) => ({
      ...s,
      warActive: !s.warActive,
      warStartedAt: !s.warActive ? Date.now() : null,
      ourScore: 0,
      enemyScore: 0,
      eventLog: [event(!s.warActive ? "danger" : "neutral", !s.warActive ? "Kingdom War declared" : "Test war ended", !s.warActive ? "Black Fang vs Red Skull. Rival activity is simulated every ~12 seconds in this prototype." : "Scores reset."), ...s.eventLog].slice(0, 12),
    }));
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
    setScreen("village");
    setReward(null);
  }

  return (
    <main className="app">
      <Header
        screen={screen}
        setScreen={setScreen}
        state={state}
        onReset={reset}
      />

      <div className="page">
        {screen === "village" && (
          <VillageScreen
            state={state}
            stage={vStage}
            power={power}
            setScreen={setScreen}
            setBuilding={setBuilding}
          />
        )}

        {screen === "activity" && (
          <ActivityScreen
            tab={activityTab}
            setTab={setActivityTab}
            steps={stepsInput}
            setSteps={setStepsInput}
            focusSeconds={focusSeconds}
            focusRunning={focusRunning}
            startFocus={() => { setFocusSeconds(20); setFocusRunning(true); }}
            completeActivity={completeActivity}
          />
        )}

        {screen === "building" && (
          <BuildingScreen
            state={state}
            building={building}
            onUpgrade={upgradeBuilding}
            onBack={() => setScreen("village")}
          />
        )}

        {screen === "gorilla" && (
          <GorillaScreen
            state={state}
            stage={gStage}
            image={actualGorillaImage}
            previewStage={previewGorillaStage}
            setPreviewStage={setPreviewGorillaStage}
          />
        )}

        {screen === "kingdom" && (
          <KingdomScreen
            state={state}
            onToggleWar={toggleWar}
            onVisit={(id) => { setTargetId(id); setScreen("target"); }}
          />
        )}

        {screen === "target" && target && (
          <TargetScreen
            target={target}
            power={power}
            state={state}
            onBack={() => setScreen("kingdom")}
            onPropose={() => proposeAlliance(target)}
            onEndAlliance={() => endAlliance(target)}
            onRaid={() => raid(target, false)}
            onJointRaid={() => raid(target, true)}
          />
        )}

        {screen === "missions" && <MissionsScreen state={state} />}
      </div>

      <MobileNav screen={screen} setScreen={setScreen} />

      {reward && (
        <RewardModal
          reward={reward}
          state={state}
          onClose={() => { setReward(null); setScreen("village"); }}
          goVillage={() => { setReward(null); setScreen("village"); }}
          goGorilla={() => { setReward(null); setScreen("gorilla"); }}
          goKingdom={() => { setReward(null); setScreen("kingdom"); }}
        />
      )}
    </main>
  );
}

function Header({ screen, setScreen, state, onReset }: { screen: Screen; setScreen: (s: Screen) => void; state: GameState; onReset: () => void }) {
  return (
    <header className="header">
      <button className="brand" onClick={() => setScreen("village")} aria-label="GO PRIMAL home">
        <span>GO</span><span>PRIMAL</span>
      </button>
      <nav className="desktop-nav">
        <Nav active={screen === "village" || screen === "building"} label="Village" icon="village" onClick={() => setScreen("village")} />
        <Nav active={screen === "kingdom" || screen === "target"} label="Kingdom" icon="kingdom" onClick={() => setScreen("kingdom")} />
        <button className="activity-nav" onClick={() => setScreen("activity")}><Icon name="plus"/> <span>Do something real</span></button>
        <Nav active={screen === "missions"} label="Missions" icon="missions" onClick={() => setScreen("missions")} />
        <Nav active={screen === "gorilla"} label="Gorilla" icon="gorilla" onClick={() => setScreen("gorilla")} />
      </nav>
      <div className="resources">
        <Resource icon="bolt" value={state.energy} title="Energy" />
        <Resource icon="coin" value={state.gold} title="Gold" />
        <Resource icon="brain" value={state.knowledge} title="Knowledge" />
        <button className="reset" onClick={onReset} title="Reset prototype">↺</button>
      </div>
    </header>
  );
}

function Nav({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><Icon name={icon}/><span>{label}</span></button>;
}

function Resource({ icon, value, title }: { icon: string; value: number; title: string }) {
  return <div className="resource" title={title}><Icon name={icon}/><strong>{value}</strong></div>;
}

function VillageScreen({ state, stage, power, setScreen, setBuilding }: { state: GameState; stage: number; power: number; setScreen: (s: Screen) => void; setBuilding: (b: BuildingKey) => void }) {
  const stageName = villageStageNames[stage - 1];
  return (
    <section className="village-page">
      <div className="village-heading">
        <div>
          <p className="eyebrow">BLACK FANG · ASH VALLEY</p>
          <h1>{stageName}</h1>
          <p className="lede">Your real life builds this world.</p>
        </div>
        <div className="village-stats">
          <MiniStat label="Village power" value={power} />
          <MiniStat label="Gorilla" value={`Lv. ${gorillaLevel(state.xp)}`} />
          <MiniStat label="Reputation" value={state.reputation} />
        </div>
      </div>

      <div className="world-frame">
        <img src={stageImage(stage)} className="world-image" alt={`${stageName} village`} />
        <div className="world-shade"/>
        <div className="stage-badge"><span>STAGE {stage}</span><strong>{stageName}</strong></div>
        <BuildingHotspot label="FORGE" level={state.buildings.forge} className="hotspot forge" onClick={() => { setBuilding("forge"); setScreen("building"); }} />
        <BuildingHotspot label="GREAT HALL" level={state.buildings.hall} className="hotspot hall" onClick={() => { setBuilding("hall"); setScreen("building"); }} />
        <BuildingHotspot label="BARRACKS" level={state.buildings.barracks} className="hotspot barracks" onClick={() => { setBuilding("barracks"); setScreen("building"); }} />
        <BuildingHotspot label="RESEARCH" level={state.buildings.lab} className="hotspot lab" onClick={() => { setBuilding("lab"); setScreen("building"); }} />
        <button className="real-action" onClick={() => setScreen("activity")}><span>DO SOMETHING REAL</span><Icon name="arrow"/></button>
        {state.warActive && <button className="war-chip" onClick={() => setScreen("kingdom")}><span>WAR LIVE</span><strong>{state.ourScore} — {state.enemyScore}</strong></button>}
      </div>

      <div className="below-world">
        <section className="world-pulse">
          <div className="section-title"><div><p className="eyebrow">WORLD PULSE</p><h2>Things happen because you move.</h2></div><span className="live-dot">LIVE</span></div>
          <div className="event-list">
            {state.eventLog.slice(0,4).map((e) => <div className={`event ${e.tone}`} key={e.id}><span className="event-dot"/><div><strong>{e.title}</strong><p>{e.body}</p></div></div>)}
          </div>
        </section>
        <section className="progress-card">
          <p className="eyebrow">VILLAGE EVOLUTION</p>
          <h2>Build bigger, not shinier.</h2>
          <div className="stage-track">
            {[1,2,3,4,5].map((n) => <div key={n} className={`stage-node ${n <= stage ? "done" : ""}`}><span>{n}</span><small>{villageStageNames[n-1]}</small></div>)}
          </div>
          <img src="/assets/village-evolution-wide.jpg" alt="Village evolution reference" className="evolution-strip"/>
        </section>
      </div>
    </section>
  );
}

function BuildingHotspot({ label, level, className, onClick }: { label: string; level: number; className: string; onClick: () => void }) {
  return <button className={className} onClick={onClick}><span>{label}</span><strong>LV. {level}</strong></button>;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="mini-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function ActivityScreen({ tab, setTab, steps, setSteps, focusSeconds, focusRunning, startFocus, completeActivity }: {
  tab: "train" | "focus" | "move";
  setTab: (v: "train" | "focus" | "move") => void;
  steps: number;
  setSteps: (v: number) => void;
  focusSeconds: number;
  focusRunning: boolean;
  startFocus: () => void;
  completeActivity: (kind: "train" | "focus" | "move") => void;
}) {
  return (
    <section className="activity-page narrow-page">
      <p className="eyebrow">REAL ACTION → VIRTUAL CONSEQUENCE</p>
      <h1>Do something real.</h1>
      <p className="lede">Train your body. Protect your focus. Move through the world.</p>
      <div className="activity-tabs">
        <ActivityTab active={tab === "train"} icon="dumbbell" title="TRAIN" subtitle="Build physical Energy" onClick={() => setTab("train")} />
        <ActivityTab active={tab === "focus"} icon="timer" title="FOCUS" subtitle="Build Knowledge" onClick={() => setTab("focus")} />
        <ActivityTab active={tab === "move"} icon="walk" title="MOVE" subtitle="Build Exploration" onClick={() => setTab("move")} />
      </div>

      {tab === "train" && <div className="activity-form"><div className="form-row"><label>Activity</label><div className="select-like">Strength training <span>⌄</span></div></div><div className="form-row"><label>Duration</label><div className="select-like">45 minutes <span>⌄</span></div></div><div className="proof"><div className="proof-icon">+</div><div><strong>Add proof</strong><p>Photo or screenshot in Web Alpha.</p></div></div><button className="primary-btn" onClick={() => completeActivity("train")}>COMPLETE TRAINING</button></div>}

      {tab === "focus" && <div className="activity-form focus-form"><div className="focus-orb"><Icon name="timer"/><strong>{formatTime(focusSeconds || 20)}</strong><span>{focusRunning ? "FOCUS RUNNING" : "ALPHA DEMO"}</span></div><p className="form-note">The web alpha cannot block iPhone apps. This tests the loop; the native version can later use Screen Time APIs.</p>{!focusRunning && focusSeconds === 0 ? <button className="secondary-btn" onClick={startFocus}>START 20-SECOND DEMO</button> : focusRunning ? <button className="secondary-btn" disabled>STAY WITH IT</button> : <button className="primary-btn" onClick={() => completeActivity("focus")}>COMPLETE FOCUS SESSION</button>}</div>}

      {tab === "move" && <div className="activity-form"><div className="move-number"><span>STEPS TODAY</span><strong>{steps.toLocaleString()}</strong></div><input type="range" min="1000" max="15000" step="500" value={steps} onChange={(e) => setSteps(Number(e.target.value))}/><div className="move-scale"><span>1k</span><span>15k</span></div><p className="form-note">Manual in the web alpha. Later this can come directly from HealthKit / Health Connect.</p><button className="primary-btn" onClick={() => completeActivity("move")}>SYNC MOVEMENT</button></div>}
    </section>
  );
}

function ActivityTab({ active, icon, title, subtitle, onClick }: { active: boolean; icon: string; title: string; subtitle: string; onClick: () => void }) {
  return <button className={`activity-tab ${active ? "active" : ""}`} onClick={onClick}><Icon name={icon}/><strong>{title}</strong><span>{subtitle}</span></button>;
}

function BuildingScreen({ state, building, onUpgrade, onBack }: { state: GameState; building: BuildingKey; onUpgrade: () => void; onBack: () => void }) {
  const level = state.buildings[building];
  const cost = buildingCost(building, level);
  const enough = state.energy >= cost.energy && state.gold >= cost.gold && state.knowledge >= cost.knowledge;
  return (
    <section className="building-page narrow-page">
      <button className="back-link" onClick={onBack}>← Village</button>
      <p className="eyebrow">VILLAGE INFRASTRUCTURE</p>
      <div className="building-title-row"><div><h1>{buildingLabel(building)}</h1><p className="lede">Level {level} → {level + 1}</p></div><span className={`ready-badge ${enough ? "ready" : ""}`}>{enough ? "UPGRADE READY" : "NOT READY"}</span></div>
      <div className="building-visual building-product"><img src={buildingImage(building, level)} alt={buildingLabel(building)}/><div className="building-overlay"><strong>{buildingLabel(building)}</strong><span>Current level {level} · next form previewed after upgrade</span></div></div>
      <p className="building-copy">{buildingDescription(building)}</p>
      <div className="cost-row"><Cost icon="bolt" label="Energy" have={state.energy} need={cost.energy}/><Cost icon="coin" label="Gold" have={state.gold} need={cost.gold}/>{cost.knowledge > 0 && <Cost icon="brain" label="Knowledge" have={state.knowledge} need={cost.knowledge}/>}</div>
      <button className={`primary-btn ${!enough ? "disabled-look" : ""}`} onClick={onUpgrade}>{enough ? "UPGRADE NOW" : "SHOW ME WHAT'S MISSING"}</button>
    </section>
  );
}

function Cost({ icon, label, have, need }: { icon: string; label: string; have: number; need: number }) {
  const ok = have >= need;
  return <div className={`cost ${ok ? "ok" : "missing"}`}><Icon name={icon}/><div><span>{label}</span><strong>{have} / {need}</strong></div></div>;
}

function GorillaScreen({ state, stage, image, previewStage, setPreviewStage }: { state: GameState; stage: number; image: string; previewStage: number | null; setPreviewStage: (v: number | null) => void }) {
  const shownStage = previewStage ?? stage;
  const stageMeta = gorillaStageCopy[shownStage - 1];
  const [customTab, setCustomTab] = useState<"fur" | "hair" | "face" | "style">("fur");
  const strip = customTab === "fur" ? "/assets/fur-strip.jpg" : customTab === "hair" ? "/assets/hair-strip.jpg" : customTab === "face" ? "/assets/face-strip.jpg" : null;
  return (
    <section className="gorilla-page">
      <div className="gorilla-hero-panel gorilla-v051">
        <div className="gorilla-meta">
          <p className="eyebrow">YOUR GORILLA</p>
          <h1>Iago</h1>
          <p className="lede">{gorillaStageNames[shownStage-1]} · Level {gorillaLevel(state.xp)}</p>
          <div className="gorilla-facts">
            <MiniStat label="Age" value={stageMeta.age}/>
            <MiniStat label="Scale" value={stageMeta.scale}/>
            <MiniStat label="Presence" value={stageMeta.presence}/>
          </div>
          <div className="xp-line"><span style={{width:`${Math.min(100,(state.xp%120)/120*100)}%`}}/></div>
          <small>{state.xp} XP · body progression stays with you</small>
          {previewStage !== null && previewStage !== stage && <p className="preview-note">Previewing a future body stage. Cosmetics remain independent from age and size.</p>}
        </div>

        <div className="gorilla-image-wrap">
          <div className="gorilla-stage-kicker">{String(shownStage).padStart(2,"0")} · {gorillaStageNames[shownStage-1]}</div>
          <img src={image} alt="Your Gorilla"/>
        </div>

        <div className="custom-panel">
          <p className="eyebrow">CUSTOMIZE</p>
          <h2>Make him yours.</h2>
          <div className="custom-tabs">
            {(["fur","hair","face","style"] as const).map((tab) => <button key={tab} className={customTab===tab?"selected":""} onClick={()=>setCustomTab(tab)}>{tab.toUpperCase()}</button>)}
          </div>
          {strip ? <div className="custom-strip"><img src={strip} alt={`${customTab} options`}/><div className="strip-selector"/></div> : <div className="style-options"><button>NO GEAR</button><button>SPORT</button><button>EXPLORER</button><button>WARRIOR</button></div>}
          <p className="custom-note"><strong>Cosmetics express identity.</strong><br/>Age, body scale and raw presence are earned through real-world progression.</p>
        </div>
      </div>

      <section className="gorilla-progression">
        <div className="section-title"><div><p className="eyebrow">PHYSICAL PROGRESSION</p><h2>Same hero. More life behind him.</h2></div><button className="text-btn" onClick={() => setPreviewStage(null)}>Show actual stage</button></div>
        <div className="gorilla-stage-grid">{[1,2,3,4,5].map((n) => <button key={n} className={`${shownStage === n ? "active" : ""} ${n <= stage ? "unlocked" : ""}`} onClick={() => setPreviewStage(n)}><img src={gorillaImage(n)} alt={gorillaStageNames[n-1]}/><span>{n}. {gorillaStageNames[n-1]}</span><small>{n <= stage ? "Unlocked" : "Preview"}</small></button>)}</div>
      </section>
    </section>
  );
}

function KingdomScreen({ state, onToggleWar, onVisit }: { state: GameState; onToggleWar: () => void; onVisit: (id: number) => void }) {
  return (
    <section className="kingdom-page">
      <div className="kingdom-head"><div><p className="eyebrow">YOUR KINGDOM</p><h1>Black Fang</h1><p className="lede">A political faction. Not every village inside it is your ally.</p></div><div className="kingdom-summary"><MiniStat label="Villages" value={82}/><MiniStat label="Your reputation" value={state.reputation}/><MiniStat label="War" value={state.warActive ? "LIVE" : "PEACE"}/></div></div>
      <section className={`war-board ${state.warActive ? "live" : ""}`}><div><p className="eyebrow">KINGDOM WAR</p><h2>{state.warActive ? "Black Fang vs Red Skull" : "No active war"}</h2><p>{state.warActive ? "The rival side is simulated every ~12 seconds so the prototype feels alive." : "Declare a test war to pressure the world and your behavior."}</p></div><div className="war-score"><div><strong>{state.ourScore}</strong><span>BLACK FANG</span></div><b>VS</b><div><strong>{state.enemyScore}</strong><span>RED SKULL</span></div></div><button className={state.warActive ? "danger-btn" : "primary-btn"} onClick={onToggleWar}>{state.warActive ? "END TEST WAR" : "DECLARE 72H TEST WAR"}</button></section>
      <div className="kingdom-grid">{state.villages.map((v) => <button className="village-card" key={v.id} onClick={() => onVisit(v.id)}><div className={`village-card-image ${v.sameKingdom ? "same" : "enemy"}`}><img src={villageCardImage(v)} alt={v.name}/><span className="village-color-mark" style={{background:v.sameKingdom ? "#6f7f48" : "#b85542"}}/></div><div className="village-card-body"><div><strong>{v.name}</strong><span>{v.owner} · {v.kingdom}</span></div><Relation relation={v.relation}/><div className="card-bottom"><span>{v.power} PWR</span><span>Visit →</span></div></div></button>)}</div>
    </section>
  );
}

function Relation({ relation }: { relation: Village["relation"] }) {
  return <span className={`relation ${relation}`}>{relation === "pending" ? "REQUEST SENT" : relation.toUpperCase()}</span>;
}

function TargetScreen({ target, power, state, onBack, onPropose, onEndAlliance, onRaid, onJointRaid }: { target: Village; power: number; state: GameState; onBack: () => void; onPropose: () => void; onEndAlliance: () => void; onRaid: () => void; onJointRaid: () => void }) {
  const risk = power > target.power * 1.2 ? "FAVORABLE" : power > target.power * .85 ? "EVEN" : "RISKY";
  const allies = state.villages.filter((v) => v.relation === "ally").length;
  return (
    <section className="target-page">
      <button className="back-link" onClick={onBack}>← Kingdom</button>
      <div className={`target-scene ${target.sameKingdom ? "same" : "enemy"}`}><img src={villageCardImage(target)} alt={target.name}/><div className="target-overlay"><span>{target.kingdom}</span><h1>{target.name}</h1><p>{target.owner} · {target.power} PWR</p></div></div>
      <div className="target-actions"><div className="target-info"><p className="eyebrow">DECISION</p><h2>Enemy, neighbor or future ally?</h2><p>Same-Kingdom raids are legal but politically expensive. Alliances only become active after the other village accepts.</p><div className="target-metrics"><MiniStat label="Risk" value={risk}/><MiniStat label="Possible loot" value={`~${target.loot}`}/><MiniStat label="Your Energy" value={state.energy}/></div></div><div className="action-stack"><Relation relation={target.relation}/>{target.relation === "neutral" && target.sameKingdom && <button className="secondary-btn" onClick={onPropose}>PROPOSE ALLIANCE</button>}{target.relation === "pending" && <button className="secondary-btn" disabled>WAITING FOR RESPONSE…</button>}{target.relation === "ally" && <button className="secondary-btn" onClick={onEndAlliance}>END ALLIANCE</button>}<button className="danger-btn" onClick={onRaid}>RAID · 60 ENERGY</button><button className="black-btn" onClick={onJointRaid}>WARband RAID · {allies} ALLIES</button>{target.sameKingdom && <small className="warning">Internal raid: -30% loot and -12 Reputation.</small>}</div></div>
    </section>
  );
}

function MissionsScreen({ state }: { state: GameState }) {
  const missions = [
    { type:"BODY", title:"Warrior's Duty", body:"Complete one training session.", done:state.activityCounts.train>0, progress:`${Math.min(1,state.activityCounts.train)}/1` },
    { type:"MIND", title:"Deep Work", body:"Complete a focus session.", done:state.activityCounts.focus>0, progress:`${Math.min(1,state.activityCounts.focus)}/1` },
    { type:"WORLD", title:"Long Walk", body:"Reach 6,000 steps today.", done:state.stepsToday>=6000, progress:`${Math.min(6000,state.stepsToday).toLocaleString()}/6,000` },
    { type:"SOCIAL", title:"Make a Pact", body:"Get one alliance accepted.", done:state.villages.some(v=>v.relation==="ally"), progress:state.villages.some(v=>v.relation==="ally")?"1/1":"0/1" },
  ];
  return <section className="missions-page narrow-page"><p className="eyebrow">MISSIONS</p><h1>Real goals. Game consequences.</h1><p className="lede">Not everything needs to be exercise. But everything needs to represent meaningful, verifiable effort.</p><div className="mission-list">{missions.map((m)=><div className={`mission ${m.done?"done":""}`} key={m.title}><span>{m.type}</span><div><strong>{m.title}</strong><p>{m.body}</p></div><b>{m.done?"DONE":m.progress}</b></div>)}</div></section>;
}

function RewardModal({ reward, state, onClose, goVillage, goGorilla, goKingdom }: { reward: Reward; state: GameState; onClose: () => void; goVillage: () => void; goGorilla: () => void; goKingdom: () => void }) {
  const stage = gorillaStage(state.xp);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="reward-modal" onMouseDown={(e)=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><Icon name="close"/></button><div className="reward-gorilla"><img src={gorillaImage(stage)} alt="Gorilla celebrating"/></div><p className="eyebrow">{activityTitle(reward.kind).toUpperCase()}</p><h1>The world moved because you did.</h1><div className="reward-grid">{reward.energy>0&&<RewardStat icon="bolt" value={reward.energy} label="Energy"/>}{reward.gold>0&&<RewardStat icon="coin" value={reward.gold} label="Gold"/>}{reward.knowledge>0&&<RewardStat icon="brain" value={reward.knowledge} label="Knowledge"/>}{reward.exploration>0&&<RewardStat icon="compass" value={reward.exploration} label="Exploration"/>}<RewardStat icon="gorilla" value={reward.xp} label="XP"/></div><p className="reward-question">What will you do with it?</p><div className="reward-actions"><button onClick={goGorilla}>GORILLA</button><button className="primary" onClick={goVillage}>VILLAGE</button><button onClick={goKingdom}>KINGDOM</button></div></div></div>;
}

function RewardStat({ icon, value, label }: { icon: string; value: number; label: string }) { return <div><Icon name={icon}/><strong>+{value}</strong><span>{label}</span></div>; }

function MobileNav({ screen, setScreen }: { screen: Screen; setScreen: (s: Screen) => void }) {
  return <nav className="mobile-nav"><Nav active={screen==="village"||screen==="building"} label="Village" icon="village" onClick={()=>setScreen("village")}/><Nav active={screen==="kingdom"||screen==="target"} label="Kingdom" icon="kingdom" onClick={()=>setScreen("kingdom")}/><button className="mobile-plus" onClick={()=>setScreen("activity")}><Icon name="plus"/></button><Nav active={screen==="missions"} label="Missions" icon="missions" onClick={()=>setScreen("missions")}/><Nav active={screen==="gorilla"} label="Gorilla" icon="gorilla" onClick={()=>setScreen("gorilla")}/></nav>;
}

function activityTitle(kind: "train" | "focus" | "move") { return kind === "train" ? "Training complete" : kind === "focus" ? "Focus complete" : "Movement synced"; }
function rewardText(r: ReturnType<typeof activityReward>) { const p=[]; if(r.energy)p.push(`+${r.energy} Energy`); if(r.gold)p.push(`+${r.gold} Gold`); if(r.knowledge)p.push(`+${r.knowledge} Knowledge`); if(r.exploration)p.push(`+${r.exploration} Exploration`); p.push(`+${r.xp} XP`); return p.join(" · "); }
function formatTime(s:number){const m=Math.floor(s/60).toString().padStart(2,"0");const sec=(s%60).toString().padStart(2,"0");return `${m}:${sec}`;}
