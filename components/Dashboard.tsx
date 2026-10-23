'use client';

import dynamic from 'next/dynamic';
import PedestrianPanel from './PedestrianPanel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Ambulance, ArrowRight, CarFront, Check, ChevronDown, Clock3,
  Cross, Gauge, Info, MapPin, Pause, Play, Plus, Radar, RotateCcw,
  Settings2, ShieldCheck, Siren, Timer, TrafficCone, Users, Zap
} from 'lucide-react';
import {
  activeEmergency, addVehicle, createInitialState, DIRECTIONS,
  pedestrianLight, phaseRemaining, requestPedestrian, sensors, stepSimulation,
  STREET_NAMES, trafficLight, type Density, type Direction,
  type SimulationSpeed, type TrafficState, type VehicleKind
} from '@/lib/traffic';

const IntersectionScene = dynamic(() => import('./IntersectionScene'), {
  ssr: false,
  loading: () => <div className="scene-loading"><span className="spinner" />Initialisation du moteur 3D…</div>
});

const modeNames: Record<TrafficState['mode'], string> = {
  idle: 'Carrefour au repos', green: 'Circulation autorisée', yellow: 'Transition de sécurité',
  clearance: 'Intersection sécurisée', pedestrian: 'Traversée piétonne',
  emergency: 'Priorité d’urgence'
};
const modeHints: Record<TrafficState['mode'], string> = {
  idle: 'Toutes les voitures à l’arrêt · piétons libres',
  green: 'Voitures sur l’axe actif uniquement',
  yellow: 'Orange · fin de la circulation',
  clearance: 'Tous les véhicules au rouge',
  pedestrian: 'Véhicules au rouge · traversée 15 s',
  emergency: 'Axes transversaux au rouge'
};
const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

function TrafficDot({ status }: { status: 'red' | 'yellow' | 'green' }) {
  return <span className={`traffic-indicator ${status}`}>
    <i className={status === 'red' ? 'on red' : ''} />
    <i className={status === 'yellow' ? 'on yellow' : ''} />
    <i className={status === 'green' ? 'on green' : ''} />
  </span>;
}

export default function Dashboard() {
  const [sim, setSim] = useState(createInitialState);
  const [priorityKind, setPriorityKind] = useState<Exclude<VehicleKind, 'car'>>('ambulance');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSim(current => stepSimulation(current, 0.1 * current.speed));
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  const dispatch = useCallback((direction: Direction, kind: VehicleKind) => {
    setSim(s => addVehicle(s, direction, kind));
  }, []);
  const cross = useCallback((direction: Direction) => {
    setSim(s => requestPedestrian(s, direction));
  }, []);
  const detectors = useMemo(() => sensors(sim), [sim]);
  const emergency = activeEmergency(sim);
  const remaining = phaseRemaining(sim);
  const isWalk = pedestrianLight(sim) === 'walk';
  const avgWait = sim.stats.passed > 0 ? sim.stats.totalWait / sim.stats.passed : 0;
  const pending = DIRECTIONS.filter(d => sim.pedestrianRequests[d]).length;

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><TrafficCone size={24} strokeWidth={2.2} /></div>
        <div><div className="brand-name">CIVITAS <span>3D</span></div><div className="brand-sub">SMART TRAFFIC LAB</div></div>
      </div>
      <div className="header-center"><span className="header-divider" /><span className="breadcrumb">SIMULATION</span><ArrowRight size={14} /><span className="breadcrumb-active">Carrefour intelligent</span></div>
      <div className="top-right">
        <div className="live-pill"><span className={`pulse-dot ${sim.paused ? 'stopped' : ''}`} />{sim.paused ? 'EN PAUSE' : 'SIMULATION ACTIVE'}</div>
        <div className="header-time"><Clock3 size={15} /> {formatTime(sim.simTime)}</div>
        <button className="icon-button help-button" onClick={() => setShowHelp(true)} title="Aide et raccourcis"><Info size={19} /></button>
      </div>
    </header>

    <main className="workspace">
      <aside className="left-panel panel-scroll">
        <div className="panel-eyebrow"><Settings2 size={13} /> CENTRE DE CONTRÔLE</div>
        <section className="section controller-section">
          <div className="section-title"><span>État du carrefour</span><span className="small-status">LIVE</span></div>
          <div className={`phase-card phase-${sim.mode}`}>
            <div className="phase-top"><div className="phase-icon">{sim.mode === 'emergency' ? <Siren size={22} /> : sim.mode === 'pedestrian' || sim.mode === 'idle' ? <Users size={22} /> : <Activity size={22} />}</div>
              <span className="phase-kicker">PHASE ACTUELLE</span></div>
            <div className="phase-name">{modeNames[sim.mode]}</div>
            <div className="phase-description">{modeHints[sim.mode]}</div>
            <div className="phase-bottom">
              <span className="phase-axis">{sim.axis ? `AXE ${sim.axis}` : 'TOUS LES AXES'}</span>
              <span className="phase-count"><Timer size={15} />{remaining !== null ? `${remaining} s` : 'AUTO'}</span>
            </div>
            {remaining !== null && <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, sim.mode === 'pedestrian' ? 100 * (remaining / 15) : 100 * (remaining / (sim.mode === 'yellow' ? 3 : sim.mode === 'clearance' ? 2 : 24))))}%` }} /></div>}
          </div>
        </section>

        <section className="section">
          <div className="section-title"><span>Simulation</span><Gauge size={17} className="muted-icon" /></div>
          <div className="transport-buttons">
            <button className={`button-main ${sim.paused ? 'button-go' : ''}`} onClick={() => setSim(s => ({ ...s, paused: !s.paused }))}>
              {sim.paused ? <Play size={17} fill="currentColor" /> : <Pause size={17} fill="currentColor" />}
              {sim.paused ? 'Reprendre' : 'Pause'}
            </button>
            <button className="button-reset" onClick={() => setSim(createInitialState())} title="Réinitialiser"><RotateCcw size={17} /></button>
          </div>
          <div className="setting-row"><label>Vitesse de simulation</label><span className="value-tag">x{sim.speed}</span></div>
          <div className="segmented three">
            {([1, 2, 4] as SimulationSpeed[]).map(speed => <button key={speed}
              className={sim.speed === speed ? 'selected' : ''}
              onClick={() => setSim(s => ({ ...s, speed }))}>×{speed}</button>)}
          </div>
          <div className="setting-row auto-row"><div><label>Trafic automatique</label><small>Génération de voitures</small></div>
            <button role="switch" aria-checked={sim.autoTraffic} className={`toggle ${sim.autoTraffic ? 'enabled' : ''}`}
              onClick={() => setSim(s => ({ ...s, autoTraffic: !s.autoTraffic }))}><span /></button>
          </div>
          <div className="setting-row density-row"><label>Intensité du trafic</label></div>
          <div className="segmented three">
            {([['low', 'Faible'], ['medium', 'Moyen'], ['high', 'Élevé']] as [Density, string][]).map(([density, name]) => <button
              key={density} disabled={!sim.autoTraffic} className={sim.density === density ? 'selected' : ''}
              onClick={() => setSim(s => ({ ...s, density }))}>{name}</button>)}
          </div>
        </section>

        <PedestrianPanel simulation={sim} setSimulation={setSim} />

        <section className="section emergency-section">
          <div className="section-title"><span><Siren size={17} color="#ff7886" /> Priorité d’urgence</span><span className="urgent-badge">PRIORITAIRE</span></div>
          <p className="section-description">L’axe choisi passe au vert après sécurisation. Les voies transversales passent au rouge.</p>
          <div className="priority-choice">
            <button className={priorityKind === 'ambulance' ? 'active' : ''} onClick={() => setPriorityKind('ambulance')}><Ambulance size={17} />Ambulance</button>
            <button className={priorityKind === 'convoy' ? 'active' : ''} onClick={() => setPriorityKind('convoy')}><ShieldCheck size={17} />Convoi</button>
          </div>
          <div className="direction-grid">
            {DIRECTIONS.map(d => <button key={d} disabled={sim.emergencyId !== null} className="direction-btn emergency-btn"
              onClick={() => dispatch(d, priorityKind)}><span className="dir-name">{STREET_NAMES[d]}</span><span className="dir-plus"><Plus size={14} /></span></button>)}
          </div>
          {sim.emergencyId !== null && <div className="emergency-live"><span className="pulse-dot" /> Véhicule prioritaire en cours de traitement</div>}
        </section>

        <section className="section last-section">
          <div className="section-title"><span>Injection de véhicules</span><CarFront size={17} className="muted-icon" /></div>
          <p className="section-description">Ajoutez une voiture sur une entrée pour tester les capteurs.</p>
          <div className="direction-grid">
            {DIRECTIONS.map(d => <button key={d} className="direction-btn" onClick={() => dispatch(d, 'car')}>
              <span className="dir-name">{STREET_NAMES[d]}</span><Plus size={14} /></button>)}
          </div>
        </section>
      </aside>

      <section className="scene-column">
        <div className="scene-header">
          <div><div className="scene-heading"><span className="scene-heading-icon"><MapPin size={16} /></span> Vue du carrefour <span className="scene-tag">3D INTERACTIVE</span></div>
            <p>Intersection à 4 branches · caméra orbitale · signaux synchronisés</p></div>
          <div className="view-info"><span className="view-dot" /> LIVE VIEW <span className="view-divider" /> <span>{sim.vehicles.length} véhicule{sim.vehicles.length > 1 ? 's' : ''}</span></div>
        </div>
        <div className="scene-surface">
          <IntersectionScene simulation={sim} onPedestrian={cross} />
          <div className="scene-overlay top-left"><div className="overlay-title"><Radar size={15} /> SYSTÈME DE DÉTECTION</div>
            <div className="overlay-sub">{Object.values(detectors).reduce((a, b) => a + b, 0)} véhicule(s) détecté(s)</div></div>
          <div className="scene-compass"><span>N</span><i>↑</i></div>
          <div className="scene-bottom-left"><span className="orbit-circle">◉</span> Glisser pour tourner <span className="overlay-bullet">•</span> Molette pour zoomer <span className="overlay-bullet">•</span> Cliquer sur un feu piéton</div>
          <div className="scene-legend"><span><i className="legend-green" /> Vert : passage</span><span><i className="legend-red" /> Rouge : arrêt</span><span><i className="legend-blue" /> Capteur actif</span></div>
          {emergency && <div className="priority-overlay"><Siren size={16} /><span>PRIORITÉ {emergency.kind === 'ambulance' ? 'AMBULANCE' : 'CONVOI'} — {STREET_NAMES[emergency.direction].toUpperCase()}</span></div>}
        </div>
        <div className="stage-footer">
          <div><span className="stage-footer-icon"><Check size={16} /></span> <strong>Contrôleur actif</strong> <span className="stage-footer-separator">/</span> Aucune collision intentionnelle entre phases</div>
          <div className="stage-footer-right">Moteur autonome <span className="footer-code">V1.0</span></div>
        </div>
      </section>

      <aside className="right-panel panel-scroll">
        <div className="panel-eyebrow"><Activity size={13} /> MONITORING TEMPS RÉEL</div>
        <section className="section">
          <div className="section-title"><span>Feux & détecteurs</span><Radar size={17} className="muted-icon" /></div>
          <div className="lane-list">
            {DIRECTIONS.map(d => <div className="lane-card" key={d}>
              <div className="lane-upper"><div className="lane-label"><span className={`sensor-led ${detectors[d] ? 'active' : ''}`} /><strong>{STREET_NAMES[d]}</strong><small>AXE {d === 'N' || d === 'S' ? 'NS' : 'EW'}</small></div>
                <TrafficDot status={trafficLight(sim, d)} /></div>
              <div className="lane-bottom"><span><Radar size={13} /> {detectors[d]} détecté{detectors[d] > 1 ? 's' : ''}</span>
                <button className={`cross-btn ${isWalk ? 'allowed' : ''}`} disabled={sim.mode === 'pedestrian' || sim.pedestrianRequests[d]}
                  onClick={() => cross(d)}>{sim.mode === 'pedestrian' ? <><Check size={12} /> Passage</> : sim.mode === 'idle' ? <><Users size={12} /> Traverser</> : sim.pedestrianRequests[d] ? 'En attente' : <><Users size={12} /> Piéton</>}</button></div>
            </div>)}
          </div>
          <p className="helper-note"><span className="helper-dot" /> Les détecteurs deviennent bleus en présence d’un véhicule. {pending ? `${pending} demande(s) piétonnes en attente.` : ''}</p>
        </section>

        <section className="section metrics-section">
          <div className="section-title"><span>Statistiques</span><Gauge size={17} className="muted-icon" /></div>
          <div className="metrics-grid">
            <div className="metric"><div className="metric-icon cyan"><CarFront size={18} /></div><span>Véhicules passés</span><strong>{sim.stats.passed}</strong></div>
            <div className="metric"><div className="metric-icon purple"><Clock3 size={18} /></div><span>Attente moyenne</span><strong>{avgWait.toFixed(1)}<small> s</small></strong></div>
            <div className="metric"><div className="metric-icon green"><Users size={18} /></div><span>Phases piétonnes</span><strong>{sim.stats.crossingsCompleted}</strong></div>
            <div className="metric"><div className="metric-icon rose"><Siren size={18} /></div><span>Urgences passées</span><strong>{sim.stats.emergenciesPassed}</strong></div>
          </div>
        </section>

        <section className="section log-section">
          <div className="section-title"><span>Journal d’événements</span><span className="log-live"><span className="pulse-dot" />LIVE</span></div>
          <div className="event-list">
            {sim.events.map(item => <div className="event-item" key={item.id}>
              <span className={`event-mark ${item.kind}`} />
              <div><p>{item.message}</p><small>{formatTime(item.time)}</small></div>
            </div>)}
          </div>
        </section>
      </aside>
    </main>

    <footer className="app-footer"><span>© CIVITAS LAB · Simulation pédagogique, non homologuée pour pilotage de feux réels</span>
      <span><Zap size={14} /> Next.js + React Three Fiber + Three.js</span></footer>

    {showHelp && <div className="modal-backdrop" onClick={() => setShowHelp(false)} role="presentation">
      <div className="help-modal" role="dialog" aria-modal="true" aria-label="Guide d’utilisation" onClick={e => e.stopPropagation()}>
        <div className="help-title"><h2>Guide de simulation</h2><button onClick={() => setShowHelp(false)} aria-label="Fermer">×</button></div>
        <p>Le carrefour fonctionne en mode intelligent : sans voiture, tous les feux véhicules restent rouges et les passages piétons sont libres.</p>
        <ol>
          <li>Activez le trafic automatique ou injectez des voitures depuis le panneau gauche.</li>
          <li>Observez les quatre capteurs et les feux dans la vue 3D.</li>
          <li>Demandez la traversée : une phase piétonne de 15 secondes sera déclenchée après la sécurisation des voitures.</li>
          <li>Envoyez une ambulance ou un convoi pour tester la priorité, après orange et dégagement de la zone.</li>
          <li>Modifiez la vitesse et l’intensité pour comparer les scénarios. Cliquez et glissez dans la scène pour changer d’angle.</li>
        </ol>
        <div className="help-warning">Prototype pédagogique : les capteurs sont simulés et le modèle ne doit pas commander un carrefour réel.</div>
        <button className="button-main help-close" onClick={() => setShowHelp(false)}>Compris</button>
      </div>
    </div>}
  </div>;
}
