import pandas as pd
from sqlalchemy import create_engine
from datetime import datetime, timedelta

DB_URI = 'sqlite:///./dashboard/ascensus.db'
engine = create_engine(DB_URI)

def rodar_job_agregacao_diaria():
    print(f"Iniciando job de agregação diária - {datetime.now()}")
    
    ontem = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    
    query = f"""
        SELECT elevador_id, ts, ia, temp_c, vib_s1_ms2, tensao 
        FROM sensor_log 
        WHERE date(ts) = '{ontem}'
    """
    
    try:
        df_bruto = pd.read_sql_query(query, engine, parse_dates=['ts'])
        
        if df_bruto.empty:
            print("Job de agregação: Sem dados de ontem para processar.")
            return

        df_agregado = df_bruto.groupby('elevador_id').agg(
            temp_media=('temp_c', 'mean'),
            temp_max=('temp_c', 'max'),
            vib_media=('vib_s1_ms2', 'mean'),
            vib_max=('vib_s1_ms2', 'max'),
            corrente_media=('ia', 'mean'),
            corrente_max=('ia', 'max'),
            tensao_media=('tensao', 'mean'),
            picos_corrente_alta=('ia', lambda x: (x > 10).sum()),
            leituras_totais=('ts', 'count')
        )
        
        df_agregado['data_referencia'] = pd.to_datetime(ontem)
        
        df_agregado.reset_index(inplace=True)
        
        df_agregado.to_sql('analise_diaria', engine, if_exists='append', index=False)
        
        print(f"Job de agregação concluído. {len(df_agregado)} linhas processadas.")

    except Exception as e:
        print(f"Erro no job de agregação: {e}")

if __name__ == '__main__':
    rodar_job_agregacao_diaria()
