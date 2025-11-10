from flask import Blueprint, request, jsonify
from extensions import db
from models import Tecnico, Elevador, Historico, SensorLog, AnaliseDiaria
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from datetime import datetime
import random, string
import pandas as pd
from sklearn.ensemble import IsolationForest
import analysis_module

api_bp = Blueprint('api', __name__, url_prefix='/api')

def uid():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=10)) + str(int(datetime.now().timestamp() * 1000))

@api_bp.route('/registrar', methods=['POST'])
def registrar_tecnico():
    data = request.json
    existe = Tecnico.query.filter_by(username=data['username']).first()
    if existe:
        return jsonify({"sucesso": False, "mensagem": "Este nome de usuário já existe."}), 400
    
    novo_tecnico = Tecnico(
        id=uid(),
        username=data['username'],
        password=data['password']
    )
    db.session.add(novo_tecnico)
    db.session.commit()
    return jsonify({"sucesso": True, "mensagem": "Técnico registrado com sucesso!"})

@api_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    tecnico = Tecnico.query.filter_by(username=data['username']).first()
    
    if not tecnico or tecnico.password != data['password']:
        return jsonify({"sucesso": False, "mensagem": "Usuário ou senha inválidos."}), 401
        
    access_token = create_access_token(identity={"id": tecnico.id, "username": tecnico.username})
    return jsonify({
        "sucesso": True,
        "token": access_token,
        "tecnico": {
            "id": tecnico.id,
            "username": tecnico.username
        }
    })

@api_bp.route('/elevadores', methods=['GET'])
@jwt_required()
def get_elevadores():
    identidade_tecnico = get_jwt_identity()
    tecnico_id = identidade_tecnico['id']
        
    elevadores_db = Elevador.query.filter_by(tecnico_id=tecnico_id).all()
    
    lista_elevadores = []
    for e in elevadores_db:
        lista_elevadores.append({
            "id": e.id, "nome": e.nome, "predio": e.predio, "capacidade": e.capacidade,
            "status": e.status, "manutencao": e.manutencao, "observacoes": e.observacoes,
            "tecnicoId": e.tecnico_id
        })
    return jsonify(lista_elevadores)

@api_bp.route('/elevadores', methods=['POST'])
@jwt_required()
def add_elevador():
    identidade_tecnico = get_jwt_identity()
    tecnico_id = identidade_tecnico['id']
    tecnico_username = identidade_tecnico['username']
    data = request.json
    
    novo_elevador = Elevador(
        id=uid(),
        nome=data['nome'],
        predio=data.get('predio'),
        capacidade=data.get('capacidade'),
        status=data.get('status', 'Operacional'),
        manutencao=data.get('manutencao'),
        observacoes=data.get('observacoes'),
        tecnico_id=tecnico_id
    )
    db.session.add(novo_elevador)
    db.session.commit()
    
    primeiro_log = Historico(
        id=uid(),
        mensagem=f"Elevador \"{novo_elevador.nome}\" cadastrado.",
        tecnico_username=tecnico_username,
        elevador_id=novo_elevador.id
    )
    db.session.add(primeiro_log)
    db.session.commit()
    
    return jsonify({"id": novo_elevador.id, "nome": novo_elevador.nome, "historico": []}), 201

@api_bp.route('/elevadores/<id>', methods=['GET'])
@jwt_required()
def get_elevador_detalhe(id):
    identidade_tecnico = get_jwt_identity()
    elevador = Elevador.query.get(id)
    
    if not elevador:
        return jsonify({"mensagem": "Elevador não encontrado"}), 404
    if elevador.tecnico_id != identidade_tecnico['id']:
        return jsonify({"mensagem": "Acesso não autorizado"}), 403
        
    logs_db = Historico.query.filter_by(elevador_id=id).order_by(Historico.ts.desc()).all()
    logs_lista = [{
        "id": log.id,
        "ts": log.ts.isoformat(),
        "mensagem": log.mensagem,
        "tecnico": log.tecnico_username
    } for log in logs_db]
    
    return jsonify({
        "id": elevador.id, "nome": elevador.nome, "predio": elevador.predio, 
        "capacidade": elevador.capacidade, "status": elevador.status, 
        "manutencao": elevador.manutencao, "observacoes": elevador.observacoes,
        "tecnicoId": elevador.tecnico_id,
        "historico": logs_lista
    })

@api_bp.route('/elevadores/<id>', methods=['PUT'])
@jwt_required()
def update_elevador(id):
    identidade_tecnico = get_jwt_identity()
    tecnico_username = identidade_tecnico['username']
    elevador = Elevador.query.get(id)

    if not elevador:
        return jsonify({"mensagem": "Elevador não encontrado"}), 404
    if elevador.tecnico_id != identidade_tecnico['id']:
        return jsonify({"mensagem": "Acesso não autorizado"}), 403
    
    data = request.json
    logs_para_criar = []
    
    if elevador.nome != data['nome']:
        logs_para_criar.append(Historico(id=uid(), mensagem=f"Nome alterado de \"{elevador.nome}\" para \"{data['nome']}\".", tecnico_username=tecnico_username, elevador_id=id))
        elevador.nome = data['nome']
        
    if elevador.status != data['status']:
        logs_para_criar.append(Historico(id=uid(), mensagem=f"Status alterado de \"{elevador.status}\" para \"{data['status']}\".", tecnico_username=tecnico_username, elevador_id=id))
        elevador.status = data['status']
    
    elevador.predio = data['predio']
    elevador.capacidade = data['capacidade']
    elevador.manutencao = data['manutencao']
    elevador.observacoes = data['observacoes']

    for log in logs_para_criar:
        db.session.add(log)
        
    db.session.commit()
    return jsonify({"mensagem": "Elevador atualizado com sucesso!"})

@api_bp.route('/elevadores/<id>', methods=['DELETE'])
@jwt_required()
def delete_elevador(id):
    identidade_tecnico = get_jwt_identity()
    elevador = Elevador.query.get(id)
    
    if not elevador:
        return jsonify({"mensagem": "Elevador não encontrado"}), 404
    if elevador.tecnico_id != identidade_tecnico['id']:
        return jsonify({"mensagem": "Acesso não autorizado"}), 403
        
    db.session.delete(elevador)
    db.session.commit()
    return jsonify({"mensagem": "Elevador excluído com sucesso!"})

@api_bp.route('/log_sensor/<elevador_id>', methods=['POST'])
def log_sensor_data(elevador_id):
    elevador = Elevador.query.get(elevador_id)
    if not elevador:
        return jsonify({"status": "erro", "mensagem": "ID do elevador não encontrado"}), 404
        
    data = request.json
    
    novo_log = SensorLog(
        ts=datetime.fromtimestamp(data.get('t', 0) / 1000.0),
        ia=data.get('ia'),
        temp_c=data.get('temp_c'),
        vib_s1_ms2=data.get('vib_s1_ms2'),
        tensao=data.get('tensao'),
        velocidade=data.get('velocidade'),
        elevador_id=elevador_id
    )
    
    db.session.add(novo_log)
    db.session.commit()
    
    return jsonify({"status": "sucesso"}), 201

@api_bp.route('/analise/<elevador_id>', methods=['GET'])
@jwt_required()
def get_analise_elevador(elevador_id):
    identidade_tecnico = get_jwt_identity()
    elevador = Elevador.query.get(elevador_id)
    
    if not elevador:
        return jsonify({"status": "erro", "mensagem": "ID do elevador não encontrado"}), 404
    if elevador.tecnico_id != identidade_tecnico['id']:
        return jsonify({"mensagem": "Acesso não autorizado"}), 403

    db_uri = db.engine.url
    report = analysis_module.gerar_analise_elevador(db_uri, elevador_id)
    
    if report['status'] == 'erro':
        return jsonify(report), 500
    
    return jsonify(report), 200

@api_bp.route('/analise_diaria/<elevador_id>', methods=['GET'])
@jwt_required()
def get_analise_diaria(elevador_id):
    identidade_tecnico = get_jwt_identity()
    elevador = Elevador.query.get(elevador_id)
    
    if not elevador:
        return jsonify({"status": "erro", "mensagem": "ID do elevador não encontrado"}), 404
    if elevador.tecnico_id != identidade_tecnico['id']:
        return jsonify({"mensagem": "Acesso não autorizado"}), 403
        
    analises = AnaliseDiaria.query.filter_by(elevador_id=elevador_id).order_by(AnaliseDiaria.data_referencia.desc()).all()
    
    if not analises:
        return jsonify({"status": "vazio", "mensagem": "Nenhum dado de análise diária encontrado."})
        
    lista_analises = []
    for a in analises:
        lista_analises.append({
            "data": a.data_referencia.strftime('%Y-%m-%d'),
            "temp_media": a.temp_media, "temp_max": a.temp_max,
            "vib_max": a.vib_max, "corrente_max": a.corrente_max,
            "picos_corrente_alta": a.picos_corrente_alta,
            "leituras_totais": a.leituras_totais
        })
    
    df = pd.DataFrame(lista_analises)
    
    features = ['temp_media', 'temp_max', 'vib_max', 'corrente_max', 'picos_corrente_alta']
    df_features = df[features].fillna(0)

    if len(df_features) < 2:
         df['anomalia'] = False
         report_final = df.to_dict('records')
         return jsonify({"status": "sucesso", "analise": report_final, "info": "Dados insuficientes para detecção de anomalia."})

    model = IsolationForest(contamination=0.1, random_state=42)
    model.fit(df_features)
    
    df['anomalia'] = model.predict(df_features)
    df['anomalia'] = df['anomalia'].apply(lambda x: True if x == -1 else False)
    
    report_final = df.to_dict('records')
        
    return jsonify({"status": "sucesso", "analise": report_final})
