import os
from flask import Flask
from extensions import db, jwt, cors
from routes import api_bp
import etl_job
from apscheduler.schedulers.background import BackgroundScheduler

basedir = os.path.abspath(os.path.dirname(__file__))
DB_URI = 'sqlite:///' + os.path.join(basedir, 'ascensus.db')

def create_app():
    app = Flask(__name__)
    
    app.config["JWT_SECRET_KEY"] = "chave-secreta-muito-forte-mude-isso-depois"
    app.config['SQLALCHEMY_DATABASE_URI'] = DB_URI
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(app)

    app.register_blueprint(api_bp)
    
    return app

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        db.create_all() 
    
    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(etl_job.rodar_job_agregacao_diaria, 'trigger', 'cron', hour=1, minute=0)
    scheduler.start()
    
    print("Iniciando Servidor API (Banco de Dados) em http://0.0.0.0:5001")
    app.run(host='0.0.0.0', port=5001, debug=True, use_reloader=False)
