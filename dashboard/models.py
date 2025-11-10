from extensions import db
from datetime import datetime

class Tecnico(db.Model):
    id = db.Column(db.String(100), primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(80), nullable=False)
    elevadores = db.relationship('Elevador', backref='tecnico', lazy=True)

class Elevador(db.Model):
    id = db.Column(db.String(100), primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    predio = db.Column(db.String(100))
    capacidade = db.Column(db.String(50))
    status = db.Column(db.String(50), nullable=False, default='Operacional')
    manutencao = db.Column(db.String(50))
    observacoes = db.Column(db.Text)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    tecnico_id = db.Column(db.String(100), db.ForeignKey('tecnico.id'), nullable=False)
    historico = db.relationship('Historico', backref='elevador', lazy=True, cascade="all, delete-orphan")
    logs_sensores = db.relationship('SensorLog', backref='elevador', lazy=True, cascade="all, delete-orphan")
    analises_diarias = db.relationship('AnaliseDiaria', backref='elevador', lazy=True, cascade="all, delete-orphan")

class Historico(db.Model):
    id = db.Column(db.String(100), primary_key=True)
    ts = db.Column(db.DateTime, default=datetime.utcnow)
    mensagem = db.Column(db.String(255), nullable=False)
    tecnico_username = db.Column(db.String(80), nullable=False)
    elevador_id = db.Column(db.String(100), db.ForeignKey('elevador.id'), nullable=False)

class SensorLog(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ts = db.Column(db.DateTime, default=datetime.utcnow)
    ia = db.Column(db.Float)
    temp_c = db.Column(db.Float)
    vib_s1_ms2 = db.Column(db.Float)
    tensao = db.Column(db.Float)
    velocidade = db.Column(db.Float)
    elevador_id = db.Column(db.String(100), db.ForeignKey('elevador.id'), nullable=False)

class AnaliseDiaria(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    data_referencia = db.Column(db.DateTime, nullable=False)
    temp_media = db.Column(db.Float)
    temp_max = db.Column(db.Float)
    vib_media = db.Column(db.Float)
    vib_max = db.Column(db.Float)
    corrente_media = db.Column(db.Float)
    corrente_max = db.Column(db.Float)
    tensao_media = db.Column(db.Float)
    picos_corrente_alta = db.Column(db.Integer)
    leituras_totais = db.Column(db.Integer)
    elevador_id = db.Column(db.String(100), db.ForeignKey('elevador.id'), nullable=False)
