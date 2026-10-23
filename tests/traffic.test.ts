import { describe, expect, test } from 'vitest';
import {
  addVehicle, createInitialState, pedestrianLight, requestPedestrian, sensors,
  stepSimulation, trafficLight, PEDESTRIAN_TIME, isSchoolExitTime, setSimulationClock
} from '../lib/traffic';

function drive(state: ReturnType<typeof createInitialState>, time: number) {
  for (let i = 0; i < Math.ceil(time * 10); i++) state = stepSimulation(state, 0.1);
  return state;
}

describe('contrôleur de carrefour', () => {
  test('sans voiture, feux véhicules rouges et passage piéton libre', () => {
    const state = drive({ ...createInitialState(), autoTraffic: false, autoPedestrians: false }, 15);
    expect(state.mode).toBe('idle');
    expect(trafficLight(state, 'N')).toBe('red');
    expect(trafficLight(state, 'E')).toBe('red');
    expect(pedestrianLight(state)).toBe('walk');
  });

  test('sans voiture un clic lance immédiatement 15 s de traversée', () => {
    let state = { ...createInitialState(), autoTraffic: false };
    state = requestPedestrian(state, 'W');
    expect(state.mode).toBe('pedestrian');
    expect(trafficLight(state, 'W')).toBe('red');
    state = drive(state, 14);
    expect(state.mode).toBe('pedestrian');
  });

  test('un véhicule active son détecteur puis obtient le vert', () => {
    let state = { ...createInitialState(), autoTraffic: false };
    state = addVehicle(state, 'N');
    expect(sensors(state).N).toBe(1);
    state = drive(state, 0.1);
    expect(trafficLight(state, 'N')).toBe('green');
    expect(trafficLight(state, 'E')).toBe('red');
  });

  test('un appel piéton est servi pendant 15 secondes sans vert véhicules', () => {
    let state = { ...createInitialState(), autoTraffic: false };
    state = addVehicle(state, 'N');
    state = drive(state, 1);
    state = requestPedestrian(state, 'E');
    let found = false;
    for (let i = 0; i < 550; i++) {
      state = stepSimulation(state, 0.1);
      if (state.mode === 'pedestrian') { found = true; break; }
    }
    expect(found).toBe(true);
    expect(pedestrianLight(state)).toBe('walk');
    expect(trafficLight(state, 'N')).toBe('red');
    state = drive(state, PEDESTRIAN_TIME - 0.5);
    expect(state.mode).toBe('pedestrian');
    state = drive(state, 1);
    expect(state.mode).not.toBe('pedestrian');
    expect(state.stats.crossingsCompleted).toBe(1);
  });

  test('priorité ambulance : les axes croisés sont au rouge', () => {
    let state = { ...createInitialState(), autoTraffic: false };
    state = addVehicle(state, 'E', 'ambulance');
    state = drive(state, 0.1);
    expect(state.mode).toBe('emergency');
    expect(trafficLight(state, 'E')).toBe('green');
    expect(trafficLight(state, 'N')).toBe('red');
    expect(trafficLight(state, 'S')).toBe('red');
    expect(trafficLight(state, 'W')).toBe('green');
    state = drive(state, 19);
    expect(state.mode).not.toBe('emergency');
  });

  test('priorité croisée attend orange + dégagement sécurisé', () => {
    let state = { ...createInitialState(), autoTraffic: false };
    state = addVehicle(state, 'N');
    state = drive(state, 2);
    state = addVehicle(state, 'E', 'ambulance');
    let beforeEmergencyGreen = false;
    for (let i = 0; i < 150; i++) {
      state = stepSimulation(state, 0.1);
      if (state.mode === 'yellow' || state.mode === 'clearance') beforeEmergencyGreen = true;
      if (state.mode === 'emergency') break;
    }
    expect(beforeEmergencyGreen).toBe(true);
    expect(state.mode).toBe('emergency');
    expect(trafficLight(state, 'N')).toBe('red');
  });

  test('en trafic intense, jamais de verts conflictuels', () => {
    let state: ReturnType<typeof createInitialState> = {
  ...createInitialState(),
  density: 'high'
  };
    for (let i = 0; i < 1200; i++) {
      state = stepSimulation(state, 0.1);
      const ns = trafficLight(state, 'N') === 'green';
      const ew = trafficLight(state, 'E') === 'green';
      expect(ns && ew).toBe(false);
      if (state.mode === 'pedestrian') {
        expect(trafficLight(state, 'S')).toBe('red');
        expect(trafficLight(state, 'W')).toBe('red');
      }
    }
  });

  test('la simulation peut être mise en pause', () => {
    const state = { ...createInitialState(), paused: true };
    expect(stepSimulation(state, 5)).toBe(state);
  });

  test('un second véhicule prioritaire ne peut être injecté simultanément', () => {
    let state = createInitialState();
    state = addVehicle(state, 'N', 'ambulance');
    expect(addVehicle(state, 'S', 'convoy')).toBe(state);
  });

  test('les heures de sortie scolaires activent la détection piétonne fréquente', () => {
    let state = setSimulationClock({ ...createInitialState(), autoTraffic: false }, '16:05');
    expect(isSchoolExitTime(state)).toBe(true);
    state = drive(state, 8);
    expect(state.mode).toBe('pedestrian');
    expect(Object.values(state.crossingPedestrians).some(n => n > 0)).toBe(true);
    expect(trafficLight(state, 'N')).toBe('red');
  });

  test('hors période scolaire, les arrivées de piétons sont espacées', () => {
    let state = setSimulationClock({ ...createInitialState(), autoTraffic: false }, '10:00');
    expect(isSchoolExitTime(state)).toBe(false);
    state = drive(state, 8);
    expect(state.mode).toBe('idle');
    expect(Object.values(state.pedestrianWaiting).every(n => n === 0)).toBe(true);
  });
});
