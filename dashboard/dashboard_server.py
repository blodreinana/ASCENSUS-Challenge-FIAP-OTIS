import json
import requests
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_sock import Sock
from datetime import datetime

app = Flask(__name__)
sock = Sock(app)
connected_clients = set()

@app.route('/')
def index():
    return render_template('index.html')

@sock.route('/ws/Bunny&Buddy')
def ws_bunny_buddy(ws):
    print("Dashboard conectado!")
    connected_clients.add(ws) 
    try:
        while True:
            ws.receive(timeout=10) 
    except Exception:
        print("Dashboard desconectado.")
        connected_clients.discard(ws)

@app.route('/api/sensor', methods=['POST'])
def receive_sensor_data():
    dados_brutos = request.json 
    if not dados_brutos:
        return jsonify({"status": "error", "message": "Nenhum dado recebido"}), 400

    print(f"Dados brutos recebidos: {dados_brutos}")

    def get_float(key, default=0.0):
        val = dados_brutos.get(key, default)
        try:
            return float(val)
        except (ValueError, TypeError):
            return default
    
    def get_int(key, default=0):
        val = dados_brutos.get(key, default)
        try:
            return int(val)
        except (ValueError, TypeError):
            return default

    dados_limpos = {
        't': int(datetime.now().timestamp() * 1000),
        'ia': get_float('ia'),
        'temp_c': get_float('temp_c'),
        'vib_s1_ms2': get_float('vib_s1_ms2'),
        'velocidade': get_float('velocidade'),
        'estado': get_int('estado'),
        'dist_l1': get_float('dist_l1', 200),
        'dist_l2': get_float('dist_l2', 200),
        'dist_o1': get_float('dist_o1', 200),
        'dist_o2': get_float('dist_o2', 200),
        'altura': dados_brutos.get('altura')
    }

    tensao_bruta = dados_brutos.get('tensao')
    
    if isinstance(tensao_bruta, (int, float)):
        dados_limpos['tensao'] = float(tensao_bruta)
    else:
        tensao_calculada = dados_limpos['ia'] * 2.0 
        dados_limpos['tensao'] = max(0.0, min(20.0, tensao_calculada))

    id_elevador_vindo_do_hardware = dados_brutos.get('id_elevador')
    
    if id_elevador_vindo_do_hardware:
        try:
            requests.post(
                f"http://127.0.0.1:5001/api/log_sensor/{id_elevador_vindo_do_hardware}",
                json=dados_limpos,
                timeout=0.5
            )
        except requests.exceptions.RequestException as e:
            print(f"Erro ao logar dados para API: {e}")
    
    json_data_string = json.dumps(dados_limpos)
    
    for client_ws in list(connected_clients):
        try:
            client_ws.send(json_data_string)
        except Exception as e:
            print(f"Erro ao enviar, removendo cliente: {e}")
            connected_clients.discard(client_ws)

    return jsonify({"status": "success", "message": "Dados tratados e retransmitidos"}), 200

@app.route('/brand/<path:filename>')
def custom_static(filename):
    return send_from_directory('static/brand/bunnybuddy-logo.png.png', filename)

if __name__ == '__main__':
    print("Iniciando Servidor do Dashboard (WebSocket) em http://0.0.0.0:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
