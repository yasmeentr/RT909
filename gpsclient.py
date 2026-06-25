

from flask import Flask, render_template, jsonify, request
import socket
import threading
import json, os,time

app = Flask(__name__)


# Initialisation de la variable globale pour stocker les données GPS
gps_data = None
logfile = "./static/gpstrack.txt"  

# Configuration d serveur gps
SERVER_IP = "192.168.0.14"   # IP de mon téléphone
SERVER_PORT = 8080           # Port choisi dans GPS Tether Server

def fetch_gps_data():
    global gps_data
    print(f"Connexion au telephone qui sert de serveur GPS {SERVER_IP}:{SERVER_PORT} ...")

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((SERVER_IP, SERVER_PORT))

    print("Connection etablie. En attente de donnees GPS...\n")

    try:
        while True:
            data = sock.recv(1024)
            if not data:
                break
            gps_data = data.decode("utf-8", errors="ignore").strip()
            if gps_data.startswith("{") and gps_data.endswith("}"):
                print("\n----------------------------------\nDonnees recues :", gps_data)
                # on ajoute les donnees gps dans le logfile
                with open(logfile, "a", encoding="utf-8") as f:
                    f.write("\n" + gps_data + "\n\n")
                # Si les données sont en JSON => converties en dictionnaire Python
                try:
                    obj = json.loads(gps_data)  # Parse le JSON reçu en dictionnaire Python
                    gps_data = obj
                except json.JSONDecodeError:
                    print("Erreur de décodage JSON.")
                    continue

            else:
                continue
                
    except KeyboardInterrupt:
        print("\nFermeture de la connexion...")
    finally:
        sock.close()


# Lancer la récupération des données GPS dans un thread séparé
thread = threading.Thread(target=fetch_gps_data)
thread.daemon = True
thread.start()


@app.route('/')
def index():
    return render_template('index.html', gps_data=gps_data or {})

@app.route('/gps')
def get_gps():
    return jsonify(gps_data if gps_data else {})


@app.post("/append-prediction") #route qui recupere les donnees predictes et les ecrit dans le fichier gpstract.txt 
def append_prediction():
    data = request.get_json(silent=True) or {}
    lat = data.get("latitude")
    lon = data.get("longitude")
    # Validation simple
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return jsonify({"ok": False, "error": "missing or invalid latitude/longitude"}), 400
    # on ajoute ces valeurs predictes dans le fichier gpstrack.txt
    entry = {"type": "POSITION PREDITE !! : ","latitude": float(lat), "longitude": float(lon), "timestamp": int(time.time() * 1000)}
    with open("./static/gpstrack.txt", "a", encoding="utf-8") as f:
        f.write("\n---------------------------------------\n")
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return jsonify({"ok": True}), 200
    
    
    

@app.post("/append-alerteEcart") #route qui recupere les alertes decart de route et les ecrit dans le fichier gpstract.txt 
def append_alerteEcart():
    data = request.get_json(silent=True) or {}
    ecarte_de_latitude_reel = data.get("ecarte_de_latitude_reel")
    ecart_de_latitude_predit = data.get("ecart_de_latitude_predit")
    # Validation simple
    if not isinstance(ecarte_de_latitude_reel, (int, float)) or not isinstance(ecart_de_latitude_predit, (int, float)):
        return jsonify({"ok": False, "error": "missing or invalid latitude/longitude"}), 400
    # on ajoute ces valeurs predictes dans le fichier gpstrack.txt
    entry = {"type": "ALERTE SORTIE DE ROUTE !! : ","ecarte de latitude reel": float(ecarte_de_latitude_reel), "ecart de latitude predit": float(ecart_de_latitude_predit), "timestamp": int(time.time() * 1000)}
    with open("./static/gpstrack.txt", "a", encoding="utf-8") as f:
        f.write("\n---------------------------------------\n")
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return jsonify({"ok": True}), 200





if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
    
    
    
    
    
    
    
    
    
