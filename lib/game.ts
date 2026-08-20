export type ActivityKind = "train" | "focus" | "move";
export type Relation = "neutral" | "pending" | "ally" | "rival";
export type BuildingKey = "hall" | "forge" | "barracks" | "lab";

export type Village = {
  id: number;
  name: string;
  owner: string;
  kingdom: string;
  power: number;
  loot: number;
  relation: Relation;
  sameKingdom: boolean;
  stage: 1 | 2 | 3 | 4 | 5;
};

export type WorldEvent = {
  id: string;
  tone: "neutral" | "good" | "danger" | "info";
  title: string;
  body: string;
  at: number;
};

export type GameState = {
  energy: number;
  gold: number;
  xp: number;
  knowledge: number;
  exploration: number;
  reputation: number;
  buildings: Record<BuildingKey, number>;
  activityCounts: Record<ActivityKind, number>;
  stepsToday: number;
  warActive: boolean;
  warStartedAt: number | null;
  ourScore: number;
  enemyScore: number;
  eventLog: WorldEvent[];
  villages: Village[];
};

export const initialState: GameState = {
  energy: 0,
  gold: 180,
  xp: 0,
  knowledge: 0,
  exploration: 0,
  reputation: 100,
  buildings: { hall: 1, forge: 1, barracks: 1, lab: 1 },
  activityCounts: { train: 0, focus: 0, move: 0 },
  stepsToday: 0,
  warActive: false,
  warStartedAt: null,
  ourScore: 0,
  enemyScore: 0,
  eventLog: [event("neutral", "Ash Valley is quiet", "Do something in the real world and the village will respond.")],
  villages: [
    { id: 1, name: "Skull Rock", owner: "Marcus", kingdom: "Black Fang", power: 520, loot: 170, relation: "neutral", sameKingdom: true, stage: 2 },
    { id: 2, name: "Iron Hollow", owner: "Ana", kingdom: "Black Fang", power: 380, loot: 120, relation: "neutral", sameKingdom: true, stage: 1 },
    { id: 3, name: "Black Peak", owner: "Victor", kingdom: "Black Fang", power: 850, loot: 260, relation: "neutral", sameKingdom: true, stage: 3 },
    { id: 4, name: "Red Marsh", owner: "Leo", kingdom: "Red Skull", power: 430, loot: 190, relation: "rival", sameKingdom: false, stage: 2 },
    { id: 5, name: "Bone Ridge", owner: "Maya", kingdom: "Red Skull", power: 680, loot: 240, relation: "rival", sameKingdom: false, stage: 3 },
  ],
};

export function event(tone: WorldEvent["tone"], title: string, body: string): WorldEvent {
  return { id: `${Date.now()}-${Math.random()}`, tone, title, body, at: Date.now() };
}

export function villageStage(s: GameState): 1 | 2 | 3 | 4 | 5 {
  const sum = s.buildings.hall + s.buildings.forge + s.buildings.barracks + s.buildings.lab;
  return Math.max(1, Math.min(5, 1 + Math.floor((sum - 4) / 3))) as 1 | 2 | 3 | 4 | 5;
}

export function gorillaStage(xp: number): 1 | 2 | 3 | 4 | 5 {
  if (xp >= 2000) return 5;
  if (xp >= 1200) return 4;
  if (xp >= 650) return 3;
  if (xp >= 250) return 2;
  return 1;
}

export const gorillaStageNames = ["Rookie", "Fighter", "Veteran", "Warlord", "Chieftain"] as const;
export const villageStageNames = ["Outpost", "Encampment", "Strong Village", "Fortress", "Primal Citadel"] as const;

export function gorillaLevel(xp: number) {
  return 1 + Math.floor(xp / 120);
}

export function villagePower(s: GameState) {
  const b = s.buildings;
  return 110 + b.forge * 52 + b.hall * 66 + b.barracks * 78 + b.lab * 32 + gorillaStage(s.xp) * 35;
}

export function activityReward(kind: ActivityKind, countBefore: number, steps = 0) {
  if (kind === "train") {
    if (countBefore === 0) return { energy: 100, gold: 30, xp: 60, knowledge: 0, exploration: 0, warScore: 50 };
    if (countBefore === 1) return { energy: 25, gold: 15, xp: 45, knowledge: 0, exploration: 0, warScore: 20 };
    return { energy: 0, gold: 5, xp: 35, knowledge: 0, exploration: 0, warScore: 0 };
  }
  if (kind === "focus") {
    return { energy: 20, gold: 20, xp: 45, knowledge: countBefore === 0 ? 80 : 35, exploration: 0, warScore: countBefore === 0 ? 35 : 10 };
  }
  const validSteps = Math.max(0, steps);
  return {
    energy: validSteps >= 5000 ? 20 : 0,
    gold: validSteps >= 3000 ? 15 : 5,
    xp: validSteps >= 3000 ? 40 : 20,
    knowledge: 0,
    exploration: Math.min(120, Math.floor(validSteps / 100)),
    warScore: validSteps >= 5000 ? 30 : 10,
  };
}

export function buildingCost(key: BuildingKey, level: number) {
  const base = {
    hall: { energy: 80, gold: 100, knowledge: 0 },
    forge: { energy: 70, gold: 95, knowledge: 0 },
    barracks: { energy: 90, gold: 110, knowledge: 0 },
    lab: { energy: 25, gold: 90, knowledge: 55 },
  }[key];
  return {
    energy: base.energy + (level - 1) * 24,
    gold: base.gold + (level - 1) * 65,
    knowledge: base.knowledge + (level - 1) * 25,
  };
}

export function buildingLabel(key: BuildingKey) {
  return { hall: "Great Hall", forge: "Forge", barracks: "Barracks", lab: "Research Lab" }[key];
}

export function buildingDescription(key: BuildingKey) {
  return {
    hall: "The center of your settlement. Raising it increases the village's scale and unlocks the next stage of civilization.",
    forge: "Reclaimed heat, metal and machines. The Forge supports equipment and the physical infrastructure of the village.",
    barracks: "Training, defense and organized force. Barracks increase how much your village can bring into conflict.",
    lab: "Focus becomes knowledge here. The Research Lab converts deliberate attention into better tools and new options.",
  }[key];
}

export function raidProbability(attackerPower: number, defenderPower: number) {
  const ratio = attackerPower / defenderPower;
  return Math.max(0.18, Math.min(0.86, 0.32 + 0.38 * ratio));
}

export function stageImage(stage: number) {
  return `/assets/village-stage-${Math.max(1, Math.min(5, stage))}.jpg`;
}

export function gorillaImage(stage: number) {
  return `/assets/gorilla-stage-${Math.max(1, Math.min(5, stage))}.png`;
}
