import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useStore } from "./App";
import { Button, Input, Field } from "./App";
import logo from "./assets/logo.svg"; 

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useStore(); 
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username || !password) {
      alert("Por favor, preencha todos os campos.");
      return; 
    }
    const sucesso = login(username, password);
    if (sucesso) {
      navigate("/"); 
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        
        <div className="flex flex-col items-center mb-6 text-center">
          <img
            src={logo} 
            alt="Ascensus Logo"
            className="w-20 h-20 mb-2" 
          />
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Bem-vindo(a) ao ASCENSUS
          </h1>
          <p className="text-zinc-600 text-sm mt-1">
            Pronto para ascender aos céus?
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">

          <Field label="Usuário">
            <Input
              type="text"
              placeholder="seu.usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>

          <Field label="Senha">
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <div className="flex flex-col items-stretch gap-3 pt-2">
            <Button
              type="submit"
              variant="primary" 
              className="w-full !font-medium shadow-lg shadow-indigo-500/30"
            >
              Entrar
            </Button>
          </div>
        </form>
        
        <div className="text-center mt-6">
            <span className="text-zinc-600 text-sm">Não tem uma conta? </span>
            <Link to="/registrar" className="text-sky-500 hover:text-sky-600 text-sm font-medium transition">
              Registre-se
            </Link>
        </div>
      </div>
    </div>
  );
}