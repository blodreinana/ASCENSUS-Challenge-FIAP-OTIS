import pandas as pd
from sqlalchemy import create_engine
from datetime import datetime

def format_stats(series, unit=""):
    stats = series.describe()
    return {
        'mean': f"{stats.get('mean', 0):.2f}{unit}",
        'std': f"{stats.get('std', 0):.2f}{unit}",
        'min': f"{stats.get('min', 0):.2f}{unit}",
        'max': f"{stats.get('max', 0):.2f}{unit}",
        'median': f"{stats.get('50%', 0):.2f}{unit}"
    }

def get_peak_time(series):
    if series.empty:
        return None
    peak_index = series.idxmax()
    return peak_index.strftime('%Y-%m-%d %H:%M:%S')

def gerar_analise_elevador(db_uri, elevador_id):
    engine = create_engine(db_uri)
    
    query = f"""
        SELECT ts, ia, temp_c, vib_s1_ms2, tensao 
        FROM sensor_log
        WHERE elevador_id = '{elevador_id}'
        ORDER BY ts ASC
    """
    
    try:
        df = pd.read_sql_query(query, engine, index_col='ts', parse_dates=['ts'])
        
        if df.empty:
            return {"status": "vazio", "mensagem": "Nenhum dado de sensor encontrado para este elevador."}

        analise = {
            'status': 'sucesso',
            'periodo_inicio': df.index.min().isoformat(),
            'periodo_fim': df.index.max().isoformat(),
            'total_leituras': len(df),
            'estatisticas': {
                'corrente_A': format_stats(df['ia'], ' A'),
                'temperatura_C': format_stats(df['temp_c'], ' °C'),
                'vibracao_ms2': format_stats(df['vib_s1_ms2'], ' m/s²'),
                'tensao_V': format_stats(df['tensao'], ' V'),
            },
            'picos_registrados': {
                'pico_corrente_A': f"{df['ia'].max():.2f} A (em {get_peak_time(df['ia'])})",
                'pico_temperatura_C': f"{df['temp_c'].max():.2f} °C (em {get_peak_time(df['temp_c'])})",
                'pico_vibracao_ms2': f"{df['vib_s1_ms2'].max():.2f} m/s² (em {get_peak_time(df['vib_s1_ms2'])}",
            }
        }
        
        return analise

    except Exception as e:
        print(f"Erro na análise com Pandas: {e}")
        return {"status": "erro", "mensagem": f"Erro ao gerar análise: {e}"}
