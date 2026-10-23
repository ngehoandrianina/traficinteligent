/** Moteur déterministe et indépendant de Three.js : pas de réseau ni capteurs matériels. */
export type Direction = 'N' | 'E' | 'S' | 'W';
export type Axis = 'NS' | 'EW';
export type Mode = 'idle' | 'green' | 'yellow' | 'clearance' | 'pedestrian' | 'emergency';
export type Density = 'low' | 'medium' | 'high';
export type VehicleKind = 'car' | 'ambulance' | 'convoy';
export type SimulationSpeed = 1 | 2 | 4;
export const DIRECTIONS: Direction[] = ['N', 'E', 'S', 'W'];
export const STREET_NAMES: Record<Direction, string> = {
  N: 'Nord', E: 'Est', S: 'Sud', W: 'Ouest'
};
export const MIN_GREEN = 10;
export const MAX_GREEN = 24;
export const YELLOW_TIME = 3;
export const MIN_CLEARANCE = 2;
export const PEDESTRIAN_TIME = 15;
export const CLOCK_RATE = 10; // 1 seconde simulée = 10 secondes à l'horloge
export const PEDESTRIAN_VEHICLE_GAP = 12; // pause minimale entre deux phases piétonnes si voitures présentes
export const STOP_PROGRESS = 50;
export const EXIT_INTERSECTION = 104;
export const CAR_SPEED = 13; // unités visuelles / s
export const EMERGENCY_SPEED = 15;
export const VEHICLE_GAP = 9.5;

export type Vehicle = {
  id: number;
  direction: Direction;
  progress: number;
  kind: VehicleKind;
  color: string;
  waiting: number;
};
export type Statistics = {
  passed: number;
  totalWait: number;
  emergenciesPassed: number;
  crossingsCompleted: number;
};
export type TrafficState = {
  mode: Mode;
  axis: Axis | null;
  nextAxis: Axis | null;
  elapsed: number;
  simTime: number;
  vehicles: Vehicle[];
  pedestrianRequests: Record<Direction, boolean>;
  pedestrianWaiting: Record<Direction, number>;
  crossingPedestrians: Record<Direction, number>;
  autoPedestrians: boolean;
  schoolPeakMode: boolean;
  clockSeconds: number;
  pedestrianSpawnElapsed: number;
  pedestrianGapUntil: number;
  emergencyId: number | null;
  lastServedAxis: Axis;
  nextId: number;
  spawnElapsed: number;
  seed: number;
  autoTraffic: boolean;
  density: Density;
  paused: boolean;
  speed: SimulationSpeed;
  stats: Statistics;
  events: { id: number; time: number; message: string; kind: 'normal' | 'warning' | 'success' }[];
};

export const axisOf = (dir: Direction): Axis => dir === 'N' || dir === 'S' ? 'NS' : 'EW';
const otherAxis = (axis: Axis): Axis => axis === 'NS' ? 'EW' : 'NS';
const emptyRequests = (): Record<Direction, boolean> => ({ N: false, E: false, S: false, W: false });
const emptyCounts = (): Record<Direction, number> => ({ N: 0, E: 0, S: 0, W: 0 });
const colors = ['#24a8f2', '#f69b45', '#8b75ed', '#34c7a3', '#e36e86', '#d1dee8'];

export function createInitialState(): TrafficState {
  return {
    mode: 'idle', axis: null, nextAxis: null, elapsed: 0, simTime: 0,
    vehicles: [], pedestrianRequests: emptyRequests(), emergencyId: null,
    pedestrianWaiting: emptyCounts(), crossingPedestrians: emptyCounts(),
    autoPedestrians: true, schoolPeakMode: true,
    clockSeconds: 16 * 3600, pedestrianSpawnElapsed: 0, pedestrianGapUntil: 0,
    lastServedAxis: 'EW', nextId: 1, spawnElapsed: 0, seed: 712367,
    autoTraffic: true, density: 'medium', paused: false, speed: 1,
    stats: { passed: 0, totalWait: 0, emergenciesPassed: 0, crossingsCompleted: 0 },
    events: [{ id: 0, time: 0, message: 'Système initialisé · attente de détection', kind: 'success' }]
  };
}

function event(s: TrafficState, message: string, kind: 'normal' | 'warning' | 'success' = 'normal'): void {
  s.events = [{ id: s.nextId++, time: s.simTime, message, kind }, ...s.events].slice(0, 6);
}

function random(s: TrafficState): number {
  s.seed = (1664525 * s.seed + 1013904223) >>> 0;
  return s.seed / 4294967296;
}

export function addVehicle(state: TrafficState, direction: Direction, kind: VehicleKind = 'car'): TrafficState {
  // Une seule demande prioritaire simultanée, pour rendre l'arbitrage non ambigu.
  if (kind !== 'car' && state.emergencyId !== null) return state;
  const s: TrafficState = { ...state, vehicles: [...state.vehicles], events: [...state.events] };
  const tail = s.vehicles.filter(v => v.direction === direction && v.progress < STOP_PROGRESS)
    .reduce((min, v) => Math.min(min, v.progress), Infinity);
  // L'interface représente une route d'arrivée finie. Évite le chevauchement des véhicules.
  const start = Math.min(8, Number.isFinite(tail) ? tail - VEHICLE_GAP - 1 : 8);
  if (start < -12) return state;
  const id = s.nextId++;
  s.vehicles.push({ id, direction, progress: start, kind, waiting: 0,
    color: kind === 'car' ? colors[Math.floor(random(s) * colors.length)] : '#f6f9ff' });
  if (kind !== 'car') {
    s.emergencyId = id;
    event(s, `${kind === 'ambulance' ? 'AMBULANCE' : 'CONVOI'} · priorité ${STREET_NAMES[direction]}`, 'warning');
  }
  return s;
}

/** Retourne vrai dans les créneaux de sortie des classes (heure locale simulée). */
export function isSchoolExitTime(state: Pick<TrafficState, 'clockSeconds' | 'schoolPeakMode'>): boolean {
  if (!state.schoolPeakMode) return false;
  const minute = (state.clockSeconds / 60) % (24 * 60);
  return (minute >= 12 * 60 && minute < 13 * 60) ||
    (minute >= 16 * 60 && minute < 17 * 60 + 30);
}

export function clockLabel(clockSeconds: number): string {
  const total = Math.floor((clockSeconds % 86400 + 86400) % 86400 / 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function setSimulationClock(state: TrafficState, clock: string): TrafficState {
  if (!/^\d{2}:\d{2}$/.test(clock)) return state;
  const [hours, minutes] = clock.split(':').map(Number);
  if (hours > 23 || minutes > 59) return state;
  return { ...state, clockSeconds: hours * 3600 + minutes * 60, pedestrianSpawnElapsed: 0 };
}

/** Détection d'une personne sur le trottoir ou appel manuel au passage. */
function queuePedestrian(s: TrafficState, direction: Direction): void {
  if (s.pedestrianWaiting[direction] >= 9) return;
  s.pedestrianWaiting[direction] += 1;
  if (!s.pedestrianRequests[direction]) {
    s.pedestrianRequests[direction] = true;
    event(s, `Piéton détecté · ${STREET_NAMES[direction]}`);
  }
  // Sans circulation prioritaire, début immédiat seulement si la zone est libre.
  if (s.mode === 'idle' && s.emergencyId === null && intersectionClear(s)) {
    begin(s, 'pedestrian');
  }
}

export function requestPedestrian(state: TrafficState, direction: Direction): TrafficState {
  const s: TrafficState = {
    ...state,
    pedestrianRequests: { ...state.pedestrianRequests },
    pedestrianWaiting: { ...state.pedestrianWaiting },
    crossingPedestrians: { ...state.crossingPedestrians },
    events: [...state.events]
  };
  queuePedestrian(s, direction);
  return s;
}

function begin(s: TrafficState, mode: Mode, axis: Axis | null = null): void {
  s.mode = mode;
  s.axis = axis;
  s.elapsed = 0;
  if (mode === 'green' && axis) {
    s.lastServedAxis = axis;
    event(s, `Feu vert · axe ${axis}`, 'success');
  } else if (mode === 'emergency' && axis) {
    event(s, `PRIORITÉ ACTIVE · axe ${axis}`, 'warning');
  } else if (mode === 'pedestrian') {
    s.crossingPedestrians = { ...s.pedestrianWaiting };
    s.pedestrianWaiting = emptyCounts();
    s.pedestrianRequests = emptyRequests();
    const total = Object.values(s.crossingPedestrians).reduce((a, b) => a + b, 0);
    event(s, `Traversée piétonne · ${total} personne(s) · 15 s`, 'success');
  } else if (mode === 'idle') {
    event(s, 'Aucune voiture · tous feux rouges, piétons libres');
  }
}

export function sensors(state: TrafficState): Record<Direction, number> {
  const result: Record<Direction, number> = {
    N: 0,
    E: 0,
    S: 0,
    W: 0
  };

  const vehicles = Array.isArray(state?.vehicles)
    ? state.vehicles
    : [];

  vehicles.forEach((v) => {
    if (
      v.progress >= -12 &&
      v.progress <= STOP_PROGRESS + 1 &&
      v.direction in result
    ) {
      result[v.direction] += 1;
    }
  });

  return result;
}

function axisDemand(s: TrafficState, axis: Axis): number {
  const counts = sensors(s);
  return axis === 'NS' ? counts.N + counts.S : counts.E + counts.W;
}

function hasPedRequest(s: TrafficState): boolean {
  return DIRECTIONS.some(d => s.pedestrianRequests[d]);
}

function getEmergency(s: TrafficState): Vehicle | undefined {
  return s.vehicles.find(v => v.id === s.emergencyId && v.progress < EXIT_INTERSECTION);
}

function intersectionClear(s: TrafficState): boolean {
  // Les véhicules entrés légalement pendant le vert/jaune terminent leur sortie.
  return s.vehicles.every(v => v.progress < STOP_PROGRESS + 0.5 || v.progress > EXIT_INTERSECTION);
}

function chooseAxis(s: TrafficState): Axis | null {
  const n = axisDemand(s, 'NS');
  const e = axisDemand(s, 'EW');
  if (!n && !e) return null;
  if (n && !e) return 'NS';
  if (e && !n) return 'EW';
  // Alternance équitable en cas de demandes des deux axes.
  return otherAxis(s.lastServedAxis);
}

function decideFromIdle(s: TrafficState): void {
  // Toujours bloquer les véhicules tant qu'un véhicule traverse encore le carré central.
  if (!intersectionClear(s)) return;
  const emergency = getEmergency(s);
  if (emergency) {
    begin(s, 'emergency', axisOf(emergency.direction));
    return;
  }
  if (hasPedRequest(s) && (s.simTime >= s.pedestrianGapUntil || !chooseAxis(s))) {
    begin(s, 'pedestrian');
    return;
  }
  const axis = chooseAxis(s);
  if (axis) begin(s, 'green', axis);
}

function updateController(s: TrafficState, dt: number): void {
  s.elapsed += dt;
  const emergency = getEmergency(s);
  const emergencyAxis = emergency ? axisOf(emergency.direction) : null;

  if (s.mode === 'idle') {
    decideFromIdle(s);
    return;
  }
  if (s.mode === 'green') {
    // Si le véhicule prioritaire arrive sur le même axe, garder le vert.
    if (emergencyAxis === s.axis) {
      begin(s, 'emergency', emergencyAxis);
      return;
    }
    const opposingDemand = axisDemand(s, otherAxis(s.axis!)) > 0;
    const ownDemand = axisDemand(s, s.axis!) > 0;
    const newPriority = emergencyAxis !== null;
    const expiry = s.elapsed >= MAX_GREEN;
    const minCompleted = s.elapsed >= MIN_GREEN;
    const pedestrianReady = hasPedRequest(s) && s.simTime >= s.pedestrianGapUntil;
    const needSwitch = newPriority || (minCompleted && (pedestrianReady || opposingDemand || !ownDemand));
    if (expiry || needSwitch) {
      s.nextAxis = emergencyAxis;
      begin(s, 'yellow', s.axis);
    }
    return;
  }
  if (s.mode === 'emergency') {
    // Laisser passer le convoi, puis sécuriser le retour au cycle normal.
    if (!emergency || emergency.progress >= EXIT_INTERSECTION) {
      s.nextAxis = null;
      begin(s, 'yellow', s.axis);
    }
    return;
  }
  if (s.mode === 'yellow') {
    if (s.elapsed >= YELLOW_TIME) begin(s, 'clearance');
    return;
  }
  if (s.mode === 'clearance') {
    if (s.elapsed < MIN_CLEARANCE || !intersectionClear(s)) return;
    if (emergencyAxis) begin(s, 'emergency', emergencyAxis);
    else if (hasPedRequest(s) && (s.simTime >= s.pedestrianGapUntil || !chooseAxis(s))) begin(s, 'pedestrian');
    else {
      const axis = chooseAxis(s);
      if (axis) begin(s, 'green', axis);
      else begin(s, 'idle');
    }
    s.nextAxis = null;
    return;
  }
  if (s.mode === 'pedestrian' && s.elapsed >= PEDESTRIAN_TIME) {
    s.stats.crossingsCompleted += 1;
    event(s, 'Traversée terminée · 15 s', 'success');
    s.crossingPedestrians = emptyCounts();
    s.pedestrianGapUntil = s.simTime + PEDESTRIAN_VEHICLE_GAP;
    // Le passage n'est jamais coupé en plein milieu, même par une urgence.
    begin(s, 'clearance');
  }
}

function updateVehicles(s: TrafficState, dt: number): void {
  const ordered = [...s.vehicles].sort((a, b) => b.progress - a.progress);
  const frontByDirection: Partial<Record<Direction, number>> = {};
  const remaining: Vehicle[] = [];
  for (const vehicle of ordered) {
    const dir = vehicle.direction;
    const green = (s.mode === 'green' || s.mode === 'emergency') && s.axis === axisOf(dir);
    const beyondLine = vehicle.progress > STOP_PROGRESS + 0.001;
    const speed = vehicle.kind === 'car' ? CAR_SPEED : EMERGENCY_SPEED;
    const possible = vehicle.progress + speed * dt;
    // Arrêt avant passage piéton quand l'axe est rouge / orange.
    const lightLimit = green || beyondLine ? Infinity : STOP_PROGRESS;
    const ahead = frontByDirection[dir];
    const spacingLimit = ahead === undefined ? Infinity : ahead - VEHICLE_GAP;
    const nextProgress = Math.max(vehicle.progress, Math.min(possible, lightLimit, spacingLimit));
    if (nextProgress - vehicle.progress < speed * dt * 0.5 && vehicle.progress < EXIT_INTERSECTION) {
      vehicle.waiting += dt;
    }
    vehicle.progress = nextProgress;
    // La priorité s'achève dès que l'ambulance a libéré la zone conflictuelle.
    if (s.emergencyId === vehicle.id && vehicle.progress >= EXIT_INTERSECTION) {
      s.emergencyId = null;
      event(s, 'Véhicule prioritaire · intersection libérée', 'success');
    }
    // Les capteurs détectent, mais n'arrêtent pas les véhicules physiquement.
    frontByDirection[dir] = nextProgress;
    if (vehicle.progress >= 152) {
      s.stats.passed += 1;
      s.stats.totalWait += vehicle.waiting;
      if (vehicle.kind !== 'car') s.stats.emergenciesPassed += 1;
      if (s.emergencyId === vehicle.id) s.emergencyId = null;
    } else remaining.push(vehicle);
  }
  s.vehicles = remaining;
}

function autoSpawn(s: TrafficState, dt: number): void {
  if (!s.autoTraffic) return;
  s.spawnElapsed += dt;
  const interval = { low: 6.5, medium: 3.4, high: 1.7 }[s.density];
  if (s.spawnElapsed < interval) return;
  s.spawnElapsed -= interval;
  const direction = DIRECTIONS[Math.floor(random(s) * DIRECTIONS.length)];
  // addVehicle est pur et reconstruit ses tableaux ; fusionner ici les seules valeurs modifiées.
  const next = addVehicle(s, direction);
  s.vehicles = next.vehicles;
  s.nextId = next.nextId;
  s.seed = next.seed;
}

/** Détection automatique des piétons : plus fréquente aux sorties scolaires. */
function autoSpawnPedestrians(s: TrafficState, dt: number): void {
  if (!s.autoPedestrians) return;
  s.pedestrianSpawnElapsed += dt;
  const peak = isSchoolExitTime(s);
  const interval = peak ? 7 : 45;
  if (s.pedestrianSpawnElapsed < interval) return;
  s.pedestrianSpawnElapsed -= interval;
  const direction = DIRECTIONS[Math.floor(random(s) * DIRECTIONS.length)];
  const count = peak ? 2 + Math.floor(random(s) * 2) : 1;
  for (let i = 0; i < count; i++) queuePedestrian(s, direction);
}

export function stepSimulation(state: TrafficState, dt: number): TrafficState {
  if (state.paused || dt <= 0) return state;
  // Découpage fixe pour un comportement identique en accéléré et en temps réel.
  const steps = Math.ceil(dt / 0.1);
  const subDt = dt / steps;
  const s: TrafficState = {
    ...state,
    vehicles: state.vehicles.map(v => ({ ...v })),
    pedestrianRequests: { ...state.pedestrianRequests },
    pedestrianWaiting: { ...state.pedestrianWaiting },
    crossingPedestrians: { ...state.crossingPedestrians },
    stats: { ...state.stats },
    events: [...state.events]
  };
  for (let i = 0; i < steps; i++) {
    s.simTime += subDt;
    s.clockSeconds = (s.clockSeconds + subDt * CLOCK_RATE) % 86400;
    autoSpawn(s, subDt);
    autoSpawnPedestrians(s, subDt);
    updateController(s, subDt);
    updateVehicles(s, subDt);
  }
  return s;
}

export function trafficLight(state: TrafficState, direction: Direction): 'red' | 'yellow' | 'green' {
  if (state.axis !== axisOf(direction)) return 'red';
  if (state.mode === 'green' || state.mode === 'emergency') return 'green';
  if (state.mode === 'yellow') return 'yellow';
  return 'red';
}

export function pedestrianLight(
  state?: TrafficState
): 'walk' | 'stop' {

  // Sécurité : état absent
  if (!state) {
    return 'stop';
  }

  // Piétons autorisés si carrefour libre
  // ou phase piétonne active
  if (
    state.mode === 'idle' ||
    state.mode === 'pedestrian'
  ) {
    return 'walk';
  }

  return 'stop';
}

export function phaseRemaining(state: TrafficState): number | null {
  const length: Partial<Record<Mode, number>> = {
    green: MAX_GREEN, yellow: YELLOW_TIME, clearance: MIN_CLEARANCE, pedestrian: PEDESTRIAN_TIME
  };
  const max = length[state.mode];
  return max === undefined ? null : Math.max(0, Math.ceil(max - state.elapsed));
}

export function activeEmergency(state: TrafficState): Vehicle | undefined {
  return getEmergency(state);
}
