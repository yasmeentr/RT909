
document.addEventListener("DOMContentLoaded", async function () {
    // Valeurs manuelles
    const MANUEL_LAT = 43.615000;   
    const MANUEL_LON = 7.055000;   
    let initLat = MANUEL_LAT;
    let initLon = MANUEL_LON;
    try {
        // Lecture du fichier gpstrack.txt
        const res = await fetch("./static/gpstrack.txt");
        if (res.ok) {
            const text = await res.text();
            if (text.trim().length > 0) {
                const lines = text.trim().split("\n");
                const last = lines[lines.length - 1].trim();
                // On parse le JSON
                if (last.startsWith("{") && last.endsWith("}")) {
                    const obj = JSON.parse(last);

                    // On recup latitude + longitude
                    if (typeof obj.latitude === "number" &&
                        typeof obj.longitude === "number") {
                        initLat = obj.latitude;
                        initLon = obj.longitude;
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Impossible de lire gpstrack.txt, utilisation des valeurs manuelles.");
    }

    // --- Initialisation de la carte et du marker ---
    let map = L.map("map").setView([initLat, initLon], 20);
    let marker = L.marker([initLat, initLon]).addTo(map);
    let predictedMarker = null;     //marker orange pour la predicition de la localisation    

    L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
        minZoom: 1,
        maxZoom: 20,
        attribution: 'données © OpenStreetMap / ODbL - rendu OSM France'
    }).addTo(map);

    // Variables pour suivre la dernière position et le temps
    let lastUpdate = Date.now();
    let lat = window.gpsData.latitude, lon = window.gpsData.longitude, heading = window.gpsData.heading, speed = window.gpsData.speed;

    // Fonction de prédiction
    function predictPosition(seconds) {
        let headingRad = heading * Math.PI / 180;
        let distance = speed * seconds; // en mètres
        let deltaLat = (distance * Math.cos(headingRad)) / 111320;
        let deltaLon = (distance * Math.sin(headingRad)) / (111320 * Math.cos(lat * Math.PI / 180));
        return { latitude: lat + deltaLat, longitude: lon + deltaLon };
    }

    // Mise à jour de l UI avec les données réelles
    async function updateUI(data) {
        if (data.latitude && data.longitude) {
            lat = data.latitude;
            lon = data.longitude;
            heading = data.heading || 0;
            speed = data.speed || 0;
            lastUpdate = Date.now();
		
            marker.setLatLng([lat, lon]);
            map.setView([lat, lon]);
            //si on recoit nouvelles données alors map est de nouveau centree sur le marker et le predictedmarker est supp 
            if (predictedMarker) {
                map.removeLayer(predictedMarker);
                predictedMarker = null;
            }

            // 5 cm en degrés de latitude (≈ 0.05 m / 111320 m/°)
            const FIVE_CM_LAT = 0.05 / 111320; // ≈ 4.49e-7°
            const predicted = predictPosition(2); // prédiction à 2 s 
            // La sortie de route attendue : lat + 5 cm
            const ecartLat = lat + FIVE_CM_LAT;

            if (ecartLat>predicted.latitude) {
                document.getElementById('gps-message').textContent =
                `<!> Ecart de route !!!!  <!>: lat predite (${predicted.latitude.toFixed(8)}) vs lat + 5cm (${ecartLat.toFixed(8)})`;
                // on ecrit l'écart de route dans le fichier gpstract.txt (on l'envoie dans une route)
                try {
                    const res = await fetch("/append-alerteEcart", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ecarte_de_latitude_reel: ecartLat, ecart_de_latitude_predit : predicted.latitude })
                    });
                    if (!res.ok) {
                        console.warn("append-prediction non OK:", res.status, res.statusText);
                    }
                } catch (e) {
                console.warn("Impossible d'ecrire la position predite:", e);
                }
            } 
            else {
                document.getElementById('gps-message').textContent = `Position reelle: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
            }
            

            document.getElementById('Latitude').value = lat;
            document.getElementById('Longitude').value = lon;
            document.getElementById('Heading').value = heading;
            document.getElementById('Speed').value = speed;
        }
    }

    // Fetch les donnees GPS toutes les 3 secondes
    setInterval(() => {
        fetch(`/gps?ts=${Date.now()}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                if (Object.keys(data).length > 0) {
                    updateUI(data);
                }
            })
            .catch(err => console.error("Erreur Fetch:", err));
    }, 3000);

    // Si pas de nouvelles donnees depuis 10s alors prédiction
    setInterval(async () => {
        if (Date.now() - lastUpdate > 10000) {
            let predicted = predictPosition(5);
            lat = predicted.latitude;
            lon = predicted.longitude;
            if (!predictedMarker) {
                predictedMarker = L.circleMarker([lat, lon], {
                    radius: 8,
                    color: 'orange',
                    fillColor: 'orange',
                    fillOpacity: 1
                }).addTo(map);
            } else {
                predictedMarker.setLatLng([lat, lon]);
            }
            map.setView([lat, lon]);
            document.getElementById('gps-message').textContent = `Position predite: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
            // on ecrit la position predicte dans le fichier gpstract.txt (on l'envoie dans une route)
            try {
                const res = await fetch("/append-prediction", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ latitude: lat, longitude: lon })
                });
                if (!res.ok) {
                    console.warn("append-prediction non OK:", res.status, res.statusText);
                }
            } catch (e) {
            console.warn("Impossible d'ecrire la position predite:", e);
            }
        }
    }, 5000);
});
