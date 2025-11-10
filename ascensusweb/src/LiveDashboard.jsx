import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from './App'; 

function LiveDashboard() {
  const { theme } = useStore(); 

// MUDA O IP AQUI INFERNO
const PYTHON_SERVER_URL = `http://192.168.1.169:5000?theme=${theme}`;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#eef5f8',
      position: 'relative'
    }}>

      {}
      <Link 
        to="/"
        style={{
          position: 'absolute',
          top: '10px',
          left: '20px',
          zIndex: 10,
          padding: '8px 16px',
          backgroundColor: 'transparent',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '12px',
          fontWeight: '600',
        }}
      >
        &larr; Voltar
      </Link>

      {}
      <iframe
        src={PYTHON_SERVER_URL} 
        title="Dashboard de Dados em Tempo Real"
        style={{
          width: '100%',
          height: '100%',
          border: 'none', 
          overflow: 'hidden'
        }}
      />
    </div>
  );
}

export default LiveDashboard;