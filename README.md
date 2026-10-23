# CIVITAS 3D — Carrefour intelligent

Prototype interactif de simulation d'une intersection à **quatre branches**. Interface et scène 3D en français.

## Démarrer sous Windows (PowerShell)

Pré-requis : Node.js 20.9+ (recommandé : Node 22 LTS) et un navigateur avec WebGL.

```powershell
cd smart-traffic-3d
npm install
npm run dev
```

Ouvrir <http://localhost:3000>.

Tester le moteur indépendant du rendu :

```powershell
npm test
npm run typecheck
npm run build
```

## Fonctionnement

- **Quatre approches** : Nord, Est, Sud, Ouest. Deux phases incompatibles NS / EW ; le vert n'est jamais donné aux deux axes en même temps.
- **Capteur par approche** : détection virtuelle si un véhicule est présent avant le feu. Les capteurs et les véhicules sont simulés, sans caméra ou matériel réel.
- **À vide** : tous les feux destinés aux voitures sont au rouge. Les signaux piétons autorisent la traversée.
- **Trafic détecté** : l'axe demandeur reçoit le vert ; un autre axe doit attendre. Vert minimum 10 s, maximum 24 s, puis orange 3 s, puis dégagement rouge d'au moins 2 s **et** attente de la libération du centre de l'intersection. Alternance NS/EW si les deux sont demandés.
- **Piétons** : bouton pour chacune des quatre traversées. Une demande en cours de circulation est prise en compte après sécurisation. Les quatre passages sont autorisés simultanément pour une **phase protégée de 15 s** (« scramble » piéton) : toutes les voitures restent au rouge. Plusieurs demandes sont regroupées dans cette phase.
- **Ambulance / convoi** : injection sur une branche. L'axe emprunté est mis au vert **après phase orange et dégagement**, les voies transversales sont rouges jusqu'à ce que le véhicule prioritaire ait franchi la zone de conflit. Une traversée piétonne déjà commencée n'est jamais interrompue avant ses 15 s.
- **Visualisation et test** : simulation en pause, vitesses ×1/×2/×4, intensité faible/moyenne/élevée, injection de voitures individuelles, tableau de bord avec statistiques et journal.

> **Interprétation de la priorité :** une ambulance doit normalement obtenir le **vert** sur sa trajectoire, et les **axes qu'elle croise** sont au rouge. Ce modèle applique cette règle, contrairement à une interprétation où le feu de l'ambulance serait lui-même rouge.

## Structure

```
app/
  layout.tsx             Métadonnées / mise en page
  page.tsx               Entrée dashboard
  globals.css            Interface responsive
components/
  Dashboard.tsx          Pilotage, états et statistiques
  IntersectionScene.tsx  WebGL / React Three Fiber / 3D
lib/
  traffic.ts             Automate de circulation + simulation déterministe
 tests/
  traffic.test.ts        Tests unitaires de sécurité et de priorité
```

## Comment améliorer pour une V2

1. **Modélisation des piétons présents** : détection de présence sur les quatre traversées (actuellement aucune occupation piétonne n'est détectée lors du passage libre au repos) et délai de dégagement avant toute remise au vert des voitures.
2. **Virages et voies distinctes** : tourne-à-gauche, voies bus, entrées multiples, géométrie plus fine, logique d'anti-collision pour les virages.
3. **Contrôle adaptatif** : délais minimums de service, anti-affamement des piétons et comptage des arrivées, niveaux de service.
4. **Capteurs réels** : MQTT/WebSocket, API d'ingestion capteurs, monitoring panne, données historiques en PostgreSQL.
5. **Sécurité** : watchdog, mode clignotant sécurisé, simulation avec contraintes formelles, essais et homologation selon les règles locales.

## À propos de la sécurité

Il s'agit d'une **simulation pédagogique**, pas d'un contrôleur de feux certifié. Les temps et distances en 3D sont arbitraires, sans prise en compte des dimensions réelles, de l'approche de l'ambulance, de la détection matérielle, des vitesses réglementaires ou d'une sécurité fonctionnelle homologuée. En particulier, le passage piéton « libre » à vide exige en vrai un détecteur de présence et une temporisation de dégagement avant qu'un feu véhicule passe au vert. Ne jamais connecter ce prototype directement à des feux en voirie.

## Technologies

- Next.js (App Router), React 19, TypeScript
- Three.js / @react-three/fiber / @react-three/drei
- Lucide pour les pictogrammes
- Vitest pour les tests unitaires

Code autonome : pas de service cloud, clé API ni asset externe requis.
