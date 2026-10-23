'use client';

import { type Dispatch, type SetStateAction } from 'react';
import { Clock3, Plus, Radar, Users } from 'lucide-react';
import {
  clockLabel, DIRECTIONS, isSchoolExitTime, requestPedestrian,
  setSimulationClock, STREET_NAMES, type TrafficState
} from '@/lib/traffic';

type Props = {
  simulation: TrafficState;
  setSimulation: Dispatch<SetStateAction<TrafficState>>;
};

export default function PedestrianPanel({ simulation: sim, setSimulation }: Props) {
  const peak = isSchoolExitTime(sim);
  const waiting = DIRECTIONS.reduce((total, direction) => total + sim.pedestrianWaiting[direction], 0);
  const active = DIRECTIONS.reduce((total, direction) => total + sim.crossingPedestrians[direction], 0);

  return <section className="section">
    <div className="section-title"><span><Users size={17} /> Détection des piétons</span><Radar size={17} className="muted-icon" /></div>

    <div className="setting-row auto-row">
      <div><label>Détection automatique</label><small>Capteurs virtuels sur les trottoirs</small></div>
      <button role="switch" aria-checked={sim.autoPedestrians} aria-label="Détection piétonne automatique"
        className={`toggle ${sim.autoPedestrians ? 'enabled' : ''}`}
        onClick={() => setSimulation(s => ({ ...s, autoPedestrians: !s.autoPedestrians }))}><span /></button>
    </div>

    <div className="setting-row auto-row">
      <div><label>Affluence scolaire</label><small>12h–13h · 16h–17h30</small></div>
      <button role="switch" aria-checked={sim.schoolPeakMode} aria-label="Affluence scolaire"
        className={`toggle ${sim.schoolPeakMode ? 'enabled' : ''}`}
        onClick={() => setSimulation(s => ({ ...s, schoolPeakMode: !s.schoolPeakMode }))}><span /></button>
    </div>

    <div className="setting-row">
      <label htmlFor="traffic-clock"><Clock3 size={14} /> Heure simulée</label>
      <input id="traffic-clock" type="time" value={clockLabel(sim.clockSeconds)}
        onChange={e => setSimulation(s => setSimulationClock(s, e.target.value))}
        style={{ width: 113, padding: '7px 8px', color: '#d7f6ff', background: '#142735', border: '1px solid #315363', borderRadius: 7, colorScheme: 'dark' }} />
    </div>

    <p className="section-description" style={{ marginTop: 10 }}>
      <strong style={{ color: peak ? '#ffd28c' : '#78dfbd' }}>
        {peak ? 'Sortie des classes : passage fréquent' : 'Heure normale : demande classique'}
      </strong>
      {' '}· Arrivées ≈ toutes les {peak ? '7' : '45'} s. Horloge accélérée : 1 s = 10 s d’horloge.
    </p>

    <div className="section-title">
      <span>Piétons présents</span><span className="small-status">{waiting} ATTENTE · {active} PASSAGE</span>
    </div>
    <div className="direction-grid">
      {DIRECTIONS.map(d => <button key={d} className="direction-btn"
        disabled={sim.pedestrianWaiting[d] >= 9}
        title={`${sim.pedestrianWaiting[d]} piétons détectés à ${STREET_NAMES[d]}`}
        onClick={() => setSimulation(s => requestPedestrian(s, d))}>
        <span className="dir-name">{STREET_NAMES[d]} ({sim.pedestrianWaiting[d]})</span><Plus size={14} />
      </button>)}
    </div>
    <p className="helper-note"><span className="helper-dot" />
      Cliquer sur une direction ajoute un piéton. La traversée dure 15 s, après la sécurisation du carrefour.
    </p>
  </section>;
}
