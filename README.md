# GPS Tether Server

Système de géolocalisation embarqué permettant de partager, suivre et prédire la position GPS d'un véhicule en temps réel, via une application mobile (**GPS Tether Server**) couplée à un serveur Flask et une interface web cartographique.

## Objectif du projet

- Garantir le suivi de la position même en cas de perte du signal GNSS (ex. tunnel), grâce à un système de **prédiction de trajectoire**.
- Conserver un **historique** des données GPS reçues, des positions prédites et des alertes de sortie de route.
- Détecter les **écarts de trajectoire** à l'aide d'une cartographie (OpenStreetMap).

## Architecture

L'application mobile **GPS Tether Server** (disponible sous Android et iOS) joue le rôle de serveur : elle récupère les données GPS du smartphone (position, vitesse, cap, altitude, satellites GNSS...) via ses capteurs, puis les diffuse en JSON sur le réseau WiFi local via le port `8080`.

Le projet contient le **client** qui se connecte à ce serveur :

```
.
├── gpsclient.py          # Serveur Flask : connexion au téléphone, routes web, écriture du log
├── templates/
│   └── index.html        # Page web affichant les données GPS et la carte
└── static/
    ├── js/
    │   └── app.js         # Mise à jour de la carte, prédiction de position, détection d'écart
    ├── style.css           # Feuille de style (décorative)
    └── gpstrack.txt        # Log des positions réelles, prédites et alertes
```

### gpsclient.py (serveur Flask)

- Se connecte en TCP (socket) au téléphone faisant tourner GPS Tether Server (IP + port `8080`).
- Reçoit en continu les données GPS au format JSON et les stocke en mémoire (`gps_data`) ainsi que dans `static/gpstrack.txt`.
- Expose 3 routes :
  - `GET /` : affiche la page principale (`index.html`).
  - `GET /gps` : renvoie les dernières données GPS au format JSON (interrogée toutes les 3 secondes par `app.js`).
  - `POST /append-prediction` : enregistre dans le log une position prédite (latitude/longitude) lorsque le client n'a pas reçu de données depuis 10 secondes.
  - `POST /append-alerteEcart` : enregistre dans le log une alerte lorsqu'un écart de trajectoire (> 5 cm) est détecté entre la position réelle et la position prédite.

### index.html

Page affichant :
- Un formulaire en lecture avec les dernières données GPS reçues (longitude, latitude, timestamp, altitude, heading, speed, nombre de satellites GNSS, satellites utilisés pour le fix).
- Une carte OpenStreetMap (via Leaflet) avec la position en temps réel de l'utilisateur.

### app.js

- Initialise la carte avec la dernière position connue (lue dans `gpstrack.txt`, sinon valeurs par défaut codées en dur).
- Récupère les nouvelles données GPS toutes les 3 secondes (`/gps`) et met à jour le marqueur sur la carte.
- Calcule une **prédiction de position** à partir de la vitesse et du cap (heading), si aucune nouvelle donnée n'est reçue depuis 10 secondes (marqueur orange sur la carte).
- Détecte un **écart de trajectoire** (> 5 cm) entre la position réelle et la position prédite, affiche une alerte à l'écran, et envoie cette alerte au serveur pour qu'elle soit historisée.

## Prérequis

- Python 3 avec Flask (`pip install flask`)
- Smartphone (Android ou iOS) avec l'application **GPS Tether Server** installée
- Le smartphone et la machine exécutant le serveur Flask doivent être sur le **même réseau WiFi**

## Configuration

Dans `gpsclient.py`, renseigner l'adresse IP du téléphone et le port utilisé par l'application mobile :

```python
SERVER_IP = "192.168.0.14"   # IP de votre téléphone
SERVER_PORT = 8080           # Port choisi dans GPS Tether Server
```

## Démarrage de l'application

1. **Lancer le serveur Flask** :
   ```bash
   python gpsclient.py
   ```
   Le serveur démarre sur `http://0.0.0.0:5000` et tente de se connecter au téléphone.

2. **Activer le partage GPS** : sur le téléphone, ouvrir l'application **GPS Tether Server** et appuyer sur le bouton **Start** pour démarrer la diffusion des données GPS.

3. Ouvrir un navigateur à l'adresse `http://<IP_machine>:5000` pour visualiser la position en temps réel sur la carte.

## Notes

- L'essai gratuit de l'application mobile coupe automatiquement la connexion après 5 minutes ; le serveur Flask continue alors de fonctionner en mode prédiction grâce aux dernières données reçues.
- L'historique complet (positions réelles, prédictions, alertes d'écart) est conservé dans `static/gpstrack.txt`.
