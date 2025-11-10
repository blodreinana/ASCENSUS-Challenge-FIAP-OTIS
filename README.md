# 🚀 Ascensus - Challenge FIAP/OTIS

> 🏆 **VENCEDOR DO CHALLENGE (TOP 2 - MEDALHA DE PRATA)** 🏆
>
> Este projeto foi um dos vencedores do **Challenge FIAP/OTIS**, alcançando o **Top 2** e recebendo a medalha de prata pela sua arquitetura full-stack, pipeline de engenharia de dados, funcionalidade e protótipos físicos funcionais.

**Ascensus** é uma aplicação web full-stack de monitoramento de elevadores. A plataforma permite que técnicos gerenciem elevadores e utiliza um pipeline de engenharia de dados com Machine Learning para analisar o desempenho dos sensores e detectar anomalias.

O diferencial técnico deste projeto é sua **arquitetura de backend híbrida**, composta por dois micro-serviços Python (Flask) que rodam independentemente:

1.  **Uma API RESTful (`api_server.py`):** Responsável pela autenticação dos técnicos (com JWT), gerenciamento (CRUD) dos elevadores e persistência de todo o histórico de manutenção em um banco de dados **SQLite** (utilizando SQLAlchemy).
2.  **Um Servidor de WebSocket (`dashboard_server.py`):** Atua como um "retransmissor" de dados. Ele recebe dados de hardware (via `POST`), trata (limpa e valida) os dados e os transmite instantaneamente via **WebSockets** para um painel de controle (dashboard) ao vivo.

O frontend em **React** consome ambas as partes: ele faz chamadas `fetch` para a API REST para gerenciar os dados e exibe o servidor WebSocket dentro de um `<iframe>` para o monitoramento em tempo real.

---

## ✨ Funcionalidades Principais

* **Backend Real com Banco de Dados:** A aplicação não usa `localStorage` para dados críticos. Todas as informações de técnicos e elevadores são persistidas em um banco de dados **SQLite** através do `api_server.py`.
* **Autenticação Segura (JWT):** A API RESTful é protegida. O login gera um **JSON Web Token (JWT)** que é usado para autenticar todas as requisições de dados subsequentes.
* **Gerenciamento de Elevadores (CRUD):** Técnicos podem cadastrar, editar, visualizar e excluir seus elevadores (rotas protegidas por JWT).
* **Histórico de Manutenção:** Cada alteração manual feita por um técnico é registrada no banco de dados.

### ⚙️ Pipeline de Engenharia de Dados

* **Ingestão de Dados em Tempo Real:** Um servidor **WebSocket** (`dashboard_server.py`) recebe dados de hardware (via `POST`), trata (limpa e valida) os dados e os retransmite para o dashboard ao vivo.
* **Log de Série Temporal:** O servidor WebSocket também encaminha os dados limpos para a API (`api_server.py`), que os armazena em uma tabela `SensorLog` no banco de dados.
* **Job de Agregação (ETL):** Um job (`etl_job.py`) agendado com **APScheduler** roda automaticamente (à 1h da manhã) para processar os dados brutos do dia anterior.
* **Análise de Dados (Pandas):** O job de ETL usa **Pandas** para agregar milhões de leituras diárias em um resumo estatístico (média, max, min, picos) e salva em uma tabela `AnaliseDiaria`.
* **Detecção de Anomalias (Machine Learning):** Uma rota da API (`/api/analise_diaria/...`) usa **Scikit-learn (IsolationForest)** para analisar os resumos diários e identificar dias com comportamento atípico, alertando sobre possíveis falhas.

---

## 🛠️ Arquitetura e Tecnologias

### 1. Frontend (`/ascensusapp`)

* **React (com Vite):** Para a construção da interface de usuário.
* **Tailwind CSS:** Para estilização rápida e responsiva.
* **React Router:** Para o roteamento das páginas.
* **Framer Motion:** Para as animações de transição de página.

### 2. Backend (`/dashboard`)

O backend é modularizado para máxima organização e separação de responsabilidades:

* **`api_server.py`:** O ponto de entrada da API (porta 5001). Utiliza o padrão *Application Factory* para montar o app, registrar as rotas e iniciar o agendador de tarefas (scheduler).
* **`models.py`:** Define todas as tabelas do banco de dados (`Tecnico`, `Elevador`, `SensorLog`, `AnaliseDiaria`) usando **SQLAlchemy**.
* **`routes.py`:** Define todas as rotas da API REST (`/api/login`, `/api/elevadores`, etc.) usando **Flask-JWT-Extended** para proteger as rotas que exigem autenticação.
* **`etl_job.py`:** Contém a lógica de agregação diária (o pipeline de ETL) que é agendada pelo **APScheduler**.
* **`analysis_module.py`:** Contém a lógica de análise de dados (usando **Pandas**) e detecção de anomalias (usando **Scikit-learn**).
* **`dashboard_server.py`:** Um micro-serviço independente (porta 5000) que lida apenas com a retransmissão de dados em tempo real usando **Flask-Sock (WebSockets)**.
* **`ascensus.db`:** O banco de dados **SQLite** que armazena todos os dados persistentes.

---

## ⚙️ Como Rodar o Projeto Localmente

Para rodar o projeto, você precisará de **3 terminais** abertos ao mesmo tempo.

### Pré-requisitos
* [Node.js](https://nodejs.org/) (para o frontend React)
* [Python](https://www.python.org/) (para o backend)

Primeiro, configure o ambiente virtual e instale todas as dependências do Python.

```bash
# 1. Navegue até a pasta do backend
cd dashboard

# 2. Crie um ambiente virtual
python -m venv venv

# 3. Ative o ambiente virtual
# No Windows (cmd):
.\venv\Scripts\activate
# No macOS/Linux:
# source venv/bin/activate

# 4. Instale TODAS as bibliotecas necessárias
pip install Flask Flask-SQLAlchemy Flask-CORS Flask-Sock Flask-JWT-Extended apscheduler pandas scikit-learn requests lxml

# 5. Navegue até a pasta do frontend
cd ascensusapp

# 6. Instale as dependências
npm install

# 7. (Certifique-se de que o 'venv' está ativo e você está na pasta 'dashboard')
python api_server.py

# 8. (Certifique-se de que o 'venv' está ativo e você está na pasta 'dashboard')
python dashboard_server.py

# 9. (Na pasta 'ascensusapp')
npm run dev

# 10. Acessar o App
Abra seu navegador e acesse: http://localhost:5173
