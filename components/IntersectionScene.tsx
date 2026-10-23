'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';
import {
  type Direction, type Vehicle, type TrafficState, DIRECTIONS, trafficLight,
  pedestrianLight, sensors, PEDESTRIAN_TIME
} from '@/lib/traffic';

type Props = { simulation: TrafficState; onPedestrian: (dir: Direction) => void };
const road = '#242c3b';
const asphalt = '#303a49';
const grass = '#142c30';
const footpath = '#a7adb1';
const coordinates: Record<Direction, [number, number]> = {
  N: [-12.5, -26], E: [26, -12.5], S: [12.5, 26], W: [-26, 12.5]
};

function Block({ position, size, color, emissive }: {
  position: [number, number, number]; size: [number, number, number]; color: string; emissive?: string;
}) {
  return <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 0.18 : 0} roughness={0.86} />
  </mesh>;
}

function Crosswalk({ direction }: { direction: Direction }) {
  const horizontal = direction === 'N' || direction === 'S';
  const center = direction === 'N' || direction === 'W' ? -18 : 18;
  return <group>
    {Array.from({ length: 11 }, (_, i) => {
      const offset = (i - 5) * 2.05;
      return <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}
        position={horizontal ? [offset, 0.11, center] : [center, 0.11, offset]}>
        <planeGeometry args={horizontal ? [1.25, 4.5] : [4.5, 1.25]} />
        <meshBasicMaterial color="#e7eff1" />
      </mesh>;
    })}
  </group>;
}

function Roads() {
  return <group>
    <Block position={[0, -0.41, 0]} size={[172, 0.8, 172]} color={grass} />
    <Block position={[0, 0, 0]} size={[27, 0.2, 170]} color={road} />
    <Block position={[0, 0.003, 0]} size={[170, 0.2, 27]} color={road} />
    <Block position={[0, 0.008, 0]} size={[27, 0.2, 27]} color={asphalt} />
    {[-1, 1].map(sign => <group key={sign}>
      <Block position={[sign * 14.3, 0.055, 0]} size={[1.7, 0.16, 170]} color={footpath} />
      <Block position={[0, 0.055, sign * 14.3]} size={[170, 0.16, 1.7]} color={footpath} />
    </group>)}
    {Array.from({ length: 14 }, (_, index) => {
      const pos = (index - 7) * 11 + 5.5;
      if (Math.abs(pos) < 30) return null;
      return <group key={index}>
        <Block position={[0, 0.122, pos]} size={[0.24, 0.015, 5.1]} color="#b0bdc7" />
        <Block position={[pos, 0.122, 0]} size={[5.1, 0.015, 0.24]} color="#b0bdc7" />
      </group>;
    })}
    {DIRECTIONS.map(d => <Crosswalk key={d} direction={d} />)}
    {DIRECTIONS.map(d => {
      const isVertical = d === 'N' || d === 'S';
      const c = d === 'N' || d === 'W' ? -23 : 23;
      return <group key={d}>
        <Block position={isVertical ? [0, 0.123, c] : [c, 0.123, 0]}
          size={isVertical ? [24, 0.01, 0.44] : [0.44, 0.01, 24]} color="#f4e3a5" />
      </group>;
    })}
  </group>;
}

function Tree({ x, z, height = 1 }: { x: number; z: number; height?: number }) {
  return <group position={[x, 0.1, z]}>
    <mesh position={[0, 2.0 * height, 0]} castShadow>
      <cylinderGeometry args={[0.25, 0.38, 4 * height, 7]} />
      <meshStandardMaterial color="#775846" />
    </mesh>
    <mesh position={[0, 4.8 * height, 0]} castShadow>
      <icosahedronGeometry args={[2.3 * height, 0]} />
      <meshStandardMaterial color="#328370" flatShading roughness={0.95} />
    </mesh>
    <mesh position={[1 * height, 3.8 * height, -0.4]} castShadow>
      <icosahedronGeometry args={[1.4 * height, 0]} />
      <meshStandardMaterial color="#276a60" flatShading />
    </mesh>
  </group>;
}

function City() {
  const buildings = [
    { x: -43, z: -43, sx: 19, sy: 16, sz: 20, c: '#3c586c' },
    { x: -64, z: -43, sx: 14, sy: 11, sz: 20, c: '#3b465c' },
    { x: 44, z: -42, sx: 23, sy: 21, sz: 18, c: '#426a70' },
    { x: 64, z: -46, sx: 13, sy: 13, sz: 19, c: '#49566c' },
    { x: 43, z: 45, sx: 23, sy: 14, sz: 20, c: '#4f526d' },
    { x: 65, z: 43, sx: 14, sy: 23, sz: 16, c: '#3e6b6e' },
    { x: -43, z: 45, sx: 19, sy: 22, sz: 18, c: '#5b516f' },
    { x: -64, z: 42, sx: 14, sy: 12, sz: 18, c: '#4b6171' }
  ];
  const trees = [
    [-22, -38], [-22, -56], [-40, -23], [-56, -23],
    [24, -38], [24, -57], [39, -24], [57, -24],
    [-23, 37], [-23, 58], [-38, 24], [-58, 24],
    [23, 39], [24, 58], [40, 24], [58, 24]
  ];
  return <group>
    {buildings.map((b, i) => <group key={i}>
      <Block position={[b.x, b.sy / 2, b.z]} size={[b.sx, b.sy, b.sz]} color={b.c} />
      <Block position={[b.x, b.sy + 0.2, b.z]} size={[b.sx + 1, 0.4, b.sz + 1]} color="#78909b" />
      {[-1, 0, 1].map(level => <group key={level}>
        {[-1, 1].map(side => <Block key={side}
          position={[b.x + side * (b.sx / 2 + 0.02), b.sy * (0.35 + level * 0.18), b.z]}
          size={[0.05, 1.35, b.sz * 0.52]} color="#71a6b3" emissive="#203f55" />)}
      </group>)}
    </group>)}
    {trees.map(([x, z], i) => <Tree key={i} x={x} z={z} height={i % 3 === 0 ? 1.15 : 0.92} />)}
  </group>;
}

function Sensor({ direction, count, time }: { direction: Direction; count: number; time: number }) {
  const [x, z] = direction === 'N' ? [-3, -36] : direction === 'S' ? [3, 36] :
    direction === 'E' ? [36, -3] : [-36, 3];
  const active = count > 0;
  const radius = active ? 2.1 + 0.23 * Math.sin(time * 5) : 1.65;
  return <group position={[x, 0.14, z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.2, radius, 40]} />
      <meshBasicMaterial color={active ? '#50d9ed' : '#506578'} transparent opacity={active ? 0.9 : 0.46} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.43, 20]} />
      <meshBasicMaterial color={active ? '#55ddf1' : '#55677b'} />
    </mesh>
  </group>;
}

function SignalPost({ direction, light, pedWalk, onPedestrian }: {
  direction: Direction;
  light: 'red' | 'yellow' | 'green';
  pedWalk: boolean;
  onPedestrian: () => void;
}) {
  const [x, z] = coordinates[direction];
  const lamps = [
    { type: 'red' as const, color: '#ff4f62', y: 5.5 },
    { type: 'yellow' as const, color: '#ffcd54', y: 4.8 },
    { type: 'green' as const, color: '#48e5a8', y: 4.1 }
  ];
  return <group position={[x, 0, z]}>
    <mesh position={[0, 2.5, 0]} castShadow>
      <cylinderGeometry args={[0.15, 0.19, 5, 10]} />
      <meshStandardMaterial color="#728a9b" metalness={0.7} roughness={0.4} />
    </mesh>
    <Block position={[0, 4.85, 0]} size={[1.2, 2.3, 1.0]} color="#111b27" />
    {lamps.map(lamp => <mesh key={lamp.type} position={[0, lamp.y, 0.56]}>
      <sphereGeometry args={[0.33, 20, 16]} />
      <meshStandardMaterial color={light === lamp.type ? lamp.color : '#25313b'}
        emissive={light === lamp.type ? lamp.color : '#000000'}
        emissiveIntensity={light === lamp.type ? 2.3 : 0} roughness={0.3} />
    </mesh>)}
    <group position={[1.28, 2.45, 0]} onClick={(e) => { e.stopPropagation(); onPedestrian(); }}>
      <mesh castShadow>
        <boxGeometry args={[0.82, 1.16, 0.5]} />
        <meshStandardMaterial color="#172330" />
      </mesh>
      <mesh position={[0, 0.06, 0.29]}>
        <planeGeometry args={[0.54, 0.7]} />
        <meshBasicMaterial color={pedWalk ? '#2beca9' : '#f56873'} />
      </mesh>
    </group>
  </group>;
}

function VehicleMesh({ vehicle, simTime }: { vehicle: Vehicle; simTime: number }) {
  const group = useRef<THREE.Group>(null!);
  const emergency = vehicle.kind !== 'car';
  const rotation = vehicle.direction === 'N' ? 0 : vehicle.direction === 'S' ? Math.PI :
    vehicle.direction === 'E' ? -Math.PI / 2 : Math.PI / 2;
  const point = (p: number): [number, number, number] => {
    switch (vehicle.direction) {
      case 'N': return [-3, 0.8, -76 + p];
      case 'S': return [3, 0.8, 76 - p];
      case 'E': return [76 - p, 0.8, -3];
      case 'W': return [-76 + p, 0.8, 3];
    }
  };
  const target = point(vehicle.progress);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.lerp(new THREE.Vector3(...target), 1 - Math.exp(-14 * delta));
  });
  const flashing = Math.floor(simTime * 5) % 2 === 0;
  return <group ref={group} position={target} rotation={[0, rotation, 0]}>
    <mesh castShadow position={[0, 0.25, 0]}>
      <boxGeometry args={[3.35, 1.13, emergency ? 6.4 : 5.6]} />
      <meshStandardMaterial color={emergency ? '#f3f7fb' : vehicle.color} metalness={0.23} roughness={0.48} />
    </mesh>
    <mesh castShadow position={[0, 1.05, emergency ? -0.15 : -0.3]}>
      <boxGeometry args={[2.85, emergency ? 1.2 : 1.0, emergency ? 3.7 : 2.9]} />
      <meshStandardMaterial color={emergency ? '#d7e2ed' : vehicle.color} metalness={0.1} roughness={0.65} />
    </mesh>
    <Block position={[0, 1.13, emergency ? 1.78 : 1.22]} size={[2.61, 0.77, 0.07]} color="#172e42" />
    <Block position={[0, 1.13, emergency ? -2.08 : -1.7]} size={[2.61, 0.76, 0.07]} color="#28435a" />
    {[-1, 1].flatMap(side => [-1, 1].map(back => <mesh key={`${side}:${back}`} position={[side * 1.72, -0.28, back * 1.7]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.64, 0.64, 0.38, 14]} />
      <meshStandardMaterial color="#121a24" roughness={0.95} />
    </mesh>))}
    {[-1, 1].map(side => <group key={side}>
      <Block position={[side * 1.04, 0.16, 2.83]} size={[0.75, 0.28, 0.09]} color="#f7f2d2" emissive="#ffeda0" />
      <Block position={[side * 1.04, 0.17, -2.83]} size={[0.72, 0.22, 0.09]} color="#fa5e6a" />
    </group>)}
    {emergency && <group>
      <Block position={[0, 0.55, 3.2]} size={[3.15, 0.45, 0.12]} color="#d63d55" />
      <Block position={[0, 0.55, -3.2]} size={[3.15, 0.45, 0.12]} color="#d63d55" />
      <Block position={[0, 1.76, 0]} size={[2.0, 0.26, 0.72]} color="#192c45" />
      <Block position={[-0.58, 1.97, 0]} size={[0.78, 0.25, 0.54]}
        color={flashing ? '#fd5361' : '#631d33'} emissive={flashing ? '#ff4559' : undefined} />
      <Block position={[0.58, 1.97, 0]} size={[0.78, 0.25, 0.54]}
        color={!flashing ? '#5badff' : '#22406c'} emissive={!flashing ? '#438dff' : undefined} />
      {vehicle.kind === 'convoy' && <Block position={[0, 2.14, -0.4]} size={[0.2, 0.65, 0.2]} color="#f5c66c" />}
    </group>}
  </group>;
}

function WalkingPerson({ direction, time }: { direction: Direction; time: number }) {
  const progress = (time % PEDESTRIAN_TIME) / PEDESTRIAN_TIME;
  const coord = (progress - 0.5) * 27;
  const pos: [number, number, number] = direction === 'N' ? [coord, 0.2, -18] :
    direction === 'S' ? [-coord, 0.2, 18] :
    direction === 'E' ? [18, 0.2, coord] : [-18, 0.2, -coord];
  return <group position={pos}>
    <mesh position={[0, 1.68, 0]} castShadow>
      <sphereGeometry args={[0.43, 12, 12]} />
      <meshStandardMaterial color="#ffcfac" />
    </mesh>
    <mesh position={[0, 0.88, 0]} castShadow>
      <capsuleGeometry args={[0.48, 0.55, 4, 10]} />
      <meshStandardMaterial color={direction === 'N' || direction === 'S' ? '#ffbe67' : '#66c8da'} />
    </mesh>
    {[-0.23, 0.23].map(x => <Block key={x} position={[x, 0.15, 0]} size={[0.17, 0.55, 0.2]} color="#202c41" />)}
  </group>;
}

function Intersection({ simulation, onPedestrian }: Props) {
  const counts = sensors(simulation);
  const walk = pedestrianLight(simulation) === 'walk';
  const walkingTime = simulation.mode === 'pedestrian' ? simulation.elapsed : simulation.simTime;
  return <>
    <color attach="background" args={['#12222a']} />
    <fog attach="fog" args={['#12222a', 125, 270]} />
    <ambientLight intensity={1.7} />
    <hemisphereLight args={['#8ec6e8', '#16362f', 1.8]} />
    <directionalLight position={[30, 90, 42]} castShadow intensity={2.5} shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-85} shadow-camera-right={85} shadow-camera-top={85} shadow-camera-bottom={-85} />
    <Roads />
    <City />
    {DIRECTIONS.map(d => <group key={d}>
      <SignalPost direction={d} light={trafficLight(simulation, d)} pedWalk={walk}
        onPedestrian={() => onPedestrian(d)} />
      <Sensor direction={d} count={counts[d]} time={simulation.simTime} />
    </group>)}
    {simulation.vehicles.map(v => <VehicleMesh key={v.id} vehicle={v} simTime={simulation.simTime} />)}
    {simulation.mode === 'pedestrian' && DIRECTIONS.map(d => <WalkingPerson key={d} direction={d} time={walkingTime} />)}
    <OrbitControls makeDefault target={[0, 0, 0]} enablePan minDistance={35} maxDistance={170}
      maxPolarAngle={Math.PI * 0.49} minPolarAngle={0.22} />
  </>;
}

export default function IntersectionScene(props: Props) {
  return <Canvas shadows dpr={[1, 1.75]} camera={{ position: [74, 94, 93], fov: 43, near: 0.1, far: 400 }}
    gl={{ antialias: true, powerPreference: 'high-performance' }}>
    <Intersection {...props} />
  </Canvas>;
}
