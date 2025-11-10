import React, { useEffect, useMemo, useState, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation, NavLink as RouterNavLink, Navigate, Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import logo from "./assets/logo.svg";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import LiveDashboard from "./LiveDashboard";

import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";

// --- Utilitários ---

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const classNames = (...c) => c.filter(Boolean).join(" ");

const API_URL = "http://127.0.0.1:5001";

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue];
}

// --- Store (Contexto Global) ---

const StoreCtx = createContext(null);

function StoreProvider({ children }) {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const [theme, setTheme] = useLocalStorage("ascensus_tema", prefersDark ? "dark" : "light");
  const [tecnicoLogado, setTecnicoLogado] = useLocalStorage("ascensus_tecnico_logado", null); 
  
  const [elevadores, setElevadores] = useState([]);
  
  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  const fetchElevadores = async (tecnicoId) => {
    if (!tecnicoId) return;
    try {
      const response = await fetch(`${API_URL}/api/elevadores?tecnico_id=${tecnicoId}`);
      const data = await response.json();
      if (response.ok) {
        setElevadores(data);
      } else {
        console.error("Erro ao buscar elevadores:", data.mensagem);
      }
    } catch (error) {
      console.error("Erro de conexão ao buscar elevadores:", error);
    }
  };

  const registrarTecnico = async (username, password) => {
    try {
      const response = await fetch(`${API_URL}/api/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(`Erro: ${data.mensagem}`);
        return false;
      }
      alert("Técnico registrado com sucesso!");
      return true;
    } catch (error) {
      console.error("Erro ao registrar:", error);
      alert("Erro de conexão. O servidor API está rodando?");
      return false;
    }
  };

  const login = async (username, password) => {
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(`Erro: ${data.mensagem}`);
        return false;
      }
      setTecnicoLogado(data.tecnico); 
      return true;
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      alert("Erro de conexão. O servidor API está rodando?");
      return false;
    }
  };

  const logout = () => {
    setTecnicoLogado(null);
    setElevadores([]);
  };

  const addElevador = async (e) => {
    try {
      const response = await fetch(`${API_URL}/api/elevadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e),
      });
      if (!response.ok) throw new Error("Falha ao criar elevador.");
      
      await fetchElevadores(tecnicoLogado.id);
    } catch (error) {
      console.error("Erro ao adicionar elevador:", error);
      alert("Não foi possível adicionar o elevador.");
    }
  };

  const removeElevador = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/elevadores/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error("Falha ao excluir elevador.");
      
      setElevadores((old) => old.filter((e) => e.id !== id));
    } catch (error) {
      console.error("Erro ao excluir elevador:", error);
      alert("Não foi possível excluir o elevador.");
    }
  };

  const updateElevador = async (id, patch) => {
    try {
      const response = await fetch(`${API_URL}/api/elevadores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...patch,
          tecnicoUsername: tecnicoLogado.username 
        }),
      });
      if (!response.ok) throw new Error("Falha ao atualizar elevador.");
      
      await fetchElevadores(tecnicoLogado.id);
    } catch (error) {
      console.error("Erro ao atualizar elevador:", error);
      alert("Não foi possível atualizar o elevador.");
    }
  };

  useEffect(() => {
    if (tecnicoLogado && tecnicoLogado.id) {
      fetchElevadores(tecnicoLogado.id);
    } else {
      setElevadores([]);
    }
  }, [tecnicoLogado]); 

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    const meta = document.querySelector('meta[name=\"theme-color\"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#121212' : '#ffffff');
  }, [theme]);

  const value = useMemo(() => ({
    elevadores,
    tecnicoLogado,
    theme,
    toggleTheme,
    registrarTecnico,
    login,
    logout,
    addElevador,
    removeElevador,
    updateElevador
  }), [elevadores, theme, tecnicoLogado]); 

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function Card({ className = "", children }) { 
  return (
    <div className={classNames("rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121212] shadow-sm transition hover:shadow-md", className)}>
      {children}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...rest }) { 
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition";
  const styles = {
    primary: "bg-gradient-to-r from-indigo-500 to-sky-500 text-white hover:from-indigo-600 hover:to-sky-600",
    ghost: "hover:bg-zinc-100 dark:hover:bg-[#1a1a1a]",
    outline: "border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-[#1a1a1a]",
    danger: "bg-red-600 text-white hover:bg-red-500"
  };
  return (
    <button {...rest} className={classNames(base, styles[variant], className)}>
      {children}
    </button>
  );
}

export function Field({ label, children }) { 
  return (
    <label className="block">
      <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">{label}</div>
      {children}
    </label>
  );
}

export function Input(props) { 
  return (
    <input
      {...props}
      className={classNames("w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#121212] text-zinc-900 dark:text-zinc-100 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500/40", props.className)}
    />
  );
}

export function Textarea(props) { 
  return (
    <textarea
      {...props}
      className={classNames("w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#121212] text-zinc-900 dark:text-zinc-100 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500/40", props.className)}
    />
  );
}

function Badge({ children, variant = "solid" }) { 
  const s = variant === "solid"
    ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
    : "bg-zinc-100 text-zinc-700 dark:bg-[#1a1a1a] dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700";
  return (
    <span className={classNames("px-2 py-0.5 rounded-lg text-xs", s)}>
      {children}
    </span>
  );
}

export function Section({ title, subtitle, right, children }) { 
  return (
    <section className="mb-8">
      <div className="flex items-end justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Empty({ title, children, action }) { 
  return (
    <Card className="p-10 text-center">
      <div className="text-4xl">🛗</div>
      <h3 className="text-lg font-semibold mt-2">{title}</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

// --- Componentes de Layout e Navegação ---

function Shell({ children }) {
  const location = useLocation();
  const { theme, toggleTheme, tecnicoLogado, logout } = useStore(); 
  const isHomePage = location.pathname === '/';

  return (
    <div className={classNames("min-h-screen font-[Poppins] transition-colors duration-500 flex flex-col", theme === "light" ? "bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 text-zinc-900" : "bg-[#0e0e0e] text-zinc-100")}>
      <header className={classNames("sticky top-0 z-40 backdrop-blur border-b transition-colors duration-500", theme === "light" ? "bg-white/80 border-zinc-200" : "bg-[#121212]/80 border-[#1f1f1f]")}>
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Ascensus Logo" className="h-8 w-8 rounded-xl shadow-sm" />
            <div className="leading-tight">
              <div className="text-xl font-semibold tracking-tight">ASCENSUS</div>
              <div className="text-xs opacity-60 -mt-0.5">Monitoramento de Elevadores</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-2 text-sm">
            <NavLink to="/opcoes">Opções</NavLink>
            <NavLink to="/elevadores">Elevadores</NavLink>
            <NavCTA to="/dashboard">Dashboard</NavCTA>

            <div className="ml-4 pl-4 border-l border-zinc-200 dark:border-zinc-700 flex items-center gap-3">
              <span className="text-xs text-zinc-500">Olá, <b>{tecnicoLogado?.username}</b></span>
              <Button variant="outline" onClick={logout} className="!py-1 !px-2 text-xs">Sair</Button>
            </div>

            <button
              onClick={toggleTheme}
              className="ml-2 p-2 rounded-lg border border-zinc-300/40 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-[#1a1a1a] transition"
              aria-label="Alternar tema"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </nav>
          <div className="md:hidden">
            <MobileMenu />
          </div>
        </div>
      </header>
      
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={classNames("mx-auto max-w-5xl w-full px-4 py-6 flex-1", isHomePage && "flex flex-col justify-center")}
        >
          {children}
        </motion.main>
      </AnimatePresence>

      <footer className="py-8 text-center text-xs opacity-70">
        © {new Date().getFullYear()} Ascensus
      </footer>
   </div>
  );
}

function NavLink({ to, children }) {
  const base = "px-3 py-1.5 rounded-lg transition";
  const active = "bg-zinc-200 dark:bg-[#222] font-medium text-sky-500";
  const inactive = "hover:bg-zinc-100 dark:hover:bg-[#1a1a1a]";
  return (
    <RouterNavLink
      to={to}
      className={({ isActive }) => classNames(base, isActive ? active : inactive)}
    >
      {children}
    </RouterNavLink>
  );
}

function NavCTA({ to, children }) { 
  const base = "px-3 py-1.5 rounded-lg transition text-white"; 
  const active = "bg-gradient-to-r from-indigo-500 to-sky-500 ring-2 ring-sky-400 ring-offset-2 ring-offset-white dark:ring-offset-[#121212]"; 
  const inactive = "bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600"; 
  return (<RouterNavLink to={to} className={({ isActive }) => classNames(base, isActive ? active : inactive)}>{children}</RouterNavLink>); 
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { tecnicoLogado, logout } = useStore();

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
        ☰
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#121212] shadow">
          <div className="p-2 text-sm flex flex-col">
            <Link className="px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-[#1a1a1a]" to="/opcoes" onClick={() => setOpen(false)}>Opções</Link>
            <Link className="px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-[#1a1a1a]" to="/elevadores" onClick={() => setOpen(false)}>Elevadores</Link>
            <Link className="px-3 py-2 rounded bg-gradient-to-r from-indigo-500 to-sky-500 text-white" to="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
            <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
            <div className="px-3 py-2 text-zinc-500">Logado como <b>{tecnicoLogado?.username}</b></div>
            <button className="px-3 py-2 rounded text-red-500 text-left hover:bg-red-500/10" onClick={() => { logout(); setOpen(false); }}>Sair</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Páginas (Views) ---
function Home() {
  const { elevadores, tecnicoLogado } = useStore(); 
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight mb-4">
        Bem-vindo(a), <span className="text-sky-500">{tecnicoLogado?.username}</span>
      </h1>
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold tracking-tight">Sobre o Ascensus</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
            Aplicativo para cadastro e consulta de elevadores. Gerencie unidades, visualize detalhes e mantenha tudo organizado. 
          </p>
          <div className="mt-4 flex gap-2">
            <Link to="/cadastro">
              <Button>+ Cadastrar Elevador</Button>
            </Link>
            <Link to="/elevadores">
              <Button variant="outline">Ver Lista</Button>
            </Link>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold">Resumo rápido</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Você possui <b>{elevadores.length}</b> elevador(es) cadastrados.
          </p>
          <div className="mt-4">
            <Link to="/buscar">
              <Button>🔎 Buscar elevador</Button>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}

function Opcoes() {
  return (
    <Section title="Opções" subtitle="Acesso rápido às principais ações.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ActionTile to="/cadastro" icon="📝" title="Cadastrar" desc="Adicionar novo elevador" />
        <ActionTile to="/elevadores" icon="📚" title="Lista" desc="Ver todos os elevadores" />
        <ActionTile to="/buscar" icon="🔎" title="Buscar" desc="Localizar por nome ou prédio" />
        <ActionTile to="/dashboard" icon="📊" title="Dashboard" desc="Área reservada (backend)" />
      </div>
    </Section>
  );
}

function ActionTile({ to, icon, title, desc }) {
  return (
    <Link to={to} className="block">
      <Card className="p-5 hover:shadow-md transition">
        <div className="text-2xl">{icon}</div>
        <div className="mt-2 font-medium">{title}</div>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">{desc}</div>
      </Card>
    </Link>
  );
}

function CadastroElevador() {
  const { addElevador, tecnicoLogado } = useStore(); 
  const nav = useNavigate();
  const [form, setForm] = useState({ nome: "", predio: "", capacidade: "", status: "Operacional", manutencao: "", observacoes: "" });

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    
    await addElevador({ 
      ...form,
      nome: form.nome.trim(),
      predio: form.predio.trim(),
      capacidade: form.capacidade.trim(),
      observacoes: form.observacoes.trim(),
      tecnicoId: tecnicoLogado.id, 
      tecnicoUsername: tecnicoLogado.username,
      criadoEm: new Date().toISOString()
    });
    
    nav("/elevadores");
  };

  return (
    <Section title="Cadastro de Elevadores" subtitle="Preencha os campos para adicionar um novo elevador.">
      <Card className="p-6">
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={onSubmit}>
          <Field label="Nome do Elevador">
            <Input name="nome" value={form.nome} onChange={onChange} placeholder="Ex.: Bloco A - Social" required />
          </Field>
          <Field label="Prédio / Local">
            <Input name="predio" value={form.predio} onChange={onChange} placeholder="Ex.: Torre Norte" required />
          </Field>
          <Field label="Capacidade (pessoas ou kg)">
            <Input name="capacidade" value={form.capacidade} onChange={onChange} placeholder="Ex.: 8 pessoas" required />
          </Field>
          <Field label="Status">
            <select name="status" value={form.status} onChange={onChange} className="w-full rounded-xl border border-zinc-300 bg-white dark:bg-[#121212] dark:border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500/40">
              <option>Operacional</option>
              <option>Em manutenção</option>
              <option>Inativo</option>
            </select>
          </Field>
          <Field label="Última Manutenção (data)">
            <Input name="manutencao" value={form.manutencao} onChange={onChange} type="date" required />
          </Field>
          <Field label="Observações">
            <Textarea name="observacoes" value={form.observacoes} onChange={onChange} rows={4} placeholder="Detalhes relevantes" className="md:col-span-2" />
          </Field>
          <div className="md:col-span-2 flex items-center gap-2">
            <Button type="submit">Salvar</Button>
            <Link to="/elevadores">
              <Button variant="outline" type="button">Cancelar</Button>
            </Link>
          </div>
        </form>
      </Card>
    </Section>
  );
}

function ListaElevadores() {
  const { elevadores } = useStore(); 
  const nav = useNavigate();

  return (
    <Section
      title="Meus Elevadores"
      subtitle={`Você tem ${elevadores.length} elevador(es) cadastrados.`}
      right={<Link to="/cadastro"><Button>+ Novo</Button></Link>}
    >
      {elevadores.length === 0 ? ( 
        <Empty title="Nenhum elevador cadastrado">
          Cadastre seu primeiro elevador para começar.
          <div className="mt-4">
            <Link to="/cadastro"><Button>+ Cadastrar</Button></Link>
          </div>
        </Empty>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {elevadores.map(e => ( 
            <Card key={e.id} className="p-5 flex flex-col">
              <div className="flex-1">
                <div className="text-sm text-zinc-500 dark:text-zinc-400">{e.predio || "(sem prédio)"}</div>
                <div className="text-lg font-semibold">{e.nome}</div>
                <div className="text-sm mt-1 flex flex-wrap gap-2">
                  <Badge>{e.status || "—"}</Badge>
                  {e.capacidade && <Badge variant="subtle">Cap.: {e.capacidade}</Badge>}
                  {e.manutencao && <Badge variant="subtle">Últ. man.: {e.manutencao}</Badge>}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => nav(`/elevadores/${e.id}`)}>Abrir</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}

function BuscarElevador() {
  const { elevadores } = useStore();
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [];
    return elevadores.filter(e => 
      [e.nome, e.predio].some(v => (v || "").toLowerCase().includes(qq))
    );
  }, [q, elevadores]);

  return (
    <>
      <Section title="Buscar Elevador" subtitle="Procure por nome ou prédio nos seus elevadores.">
        <Card className="p-5">
          <div className="flex gap-2">
            <Input placeholder="Ex.: Social, Torre Norte…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </Card>
      </Section>
      
      {q && (
        <Section title={`Resultados (${results.length})`}>
          {results.length === 0 ? (
            <Empty title="Nada encontrado">Tente outro termo ou verifique a ortografia.</Empty>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {results.map(e => (
                <ElevadorCard key={e.id} e={e} />
              ))}
            </div>
          )}
        </Section>
      )}
    </>
  );
}

function ElevadorCard({ e }) {
  const nav = useNavigate();
  return (
    <Card className="p-5">
      <div className="text-sm text-zinc-500 dark:text-zinc-400">{e.predio || "(sem prédio)"}</div>
      <div className="text-lg font-semibold">{e.nome}</div>
      <div className="text-sm mt-1 flex flex-wrap gap-2">
        <Badge>{e.status || "—"}</Badge>
        {e.capacidade && <Badge variant="subtle">Cap.: {e.capacidade}</Badge>}
      </div>
      <div className="mt-3">
        <Button onClick={() => nav(`/elevadores/${e.id}`)}>Abrir</Button>
      </div>
    </Card>
  );
}

function ElevadorDetalhe() {
  const { removeElevador, updateElevador, theme, tecnicoLogado } = useStore();
  const { id } = useParams();
  const nav = useNavigate();
  
  const [dados, setDados] = useState(null);
  const [edit, setEdit] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const PYTHON_SERVER_URL = `http://192.168.1.169:5000?theme=${theme}`; 

  useEffect(() => {
    setLoading(true);
    const fetchDetalhe = async () => {
      try {
        const response = await fetch(`${API_URL}/api/elevadores/${id}`);
        if (!response.ok) throw new Error("Elevador não encontrado");
        const data = await response.json();
        
        if (data.tecnicoId !== tecnicoLogado.id) {
          throw new Error("Permissão negada");
        }
        
        setDados(data);
        setEdit(data);
        setLoading(false);
      } catch (error) {
        console.error("Erro ao buscar detalhe:", error);
        setLoading(false);
        setDados(null);
      }
    };
    
    fetchDetalhe();
  }, [id, tecnicoLogado.id]);

  const save = async () => {
    await updateElevador(id, edit); 
    alert("Alterações salvas.");
    const response = await fetch(`${API_URL}/api/elevadores/${id}`);
    const data = await response.json();
    setDados(data);
    setEdit(data);
  };

  const excluir = async () => {
    if (confirm("Confirmar exclusão deste elevador?")) {
      await removeElevador(id);
      nav("/elevadores");
    }
  };

  if (loading) {
    return (
      <Section title="Carregando...">
        <p>Buscando dados do elevador...</p>
      </Section>
    );
  }
  
  if (!dados) {
    return (
      <Empty title="Elevador não encontrado" action={<Link to="/elevadores"><Button>Voltar à lista</Button></Link>}>
        Você não tem permissão para ver este elevador.
      </Empty>
    );
  }

  const primeiroLog = dados.historico?.[dados.historico.length - 1];

  return (
    <>
      <Section
        title={dados.nome}
        subtitle={dados.predio || "(sem prédio)"}
        right={<Button variant="danger" onClick={excluir}>Excluir</Button>}
      >
        <div className="grid md:grid-cols-2 gap-6">
          
          <Card className="p-6">
            <h3 className="font-semibold">Informações</h3>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <Field label="Nome">
                <Input value={edit?.nome || ""} onChange={e => setEdit(o => ({ ...o, nome: e.target.value }))} />
              </Field>
              <Field label="Prédio">
                <Input value={edit?.predio || ""} onChange={e => setEdit(o => ({ ...o, predio: e.target.value }))} />
              </Field>
              <Field label="Capacidade">
                <Input value={edit?.capacidade || ""} onChange={e => setEdit(o => ({ ...o, capacidade: e.target.value }))} />
              </Field>
              <Field label="Status">
                <select value={edit?.status || ""} onChange={e => setEdit(o => ({ ...o, status: e.target.value }))} className="w-full rounded-xl border border-zinc-300 bg-white dark:bg-[#121212] dark:border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500/40">
                  <option>Operacional</option>
                  <option>Em manutenção</option>
                  <option>Inativo</option>
                </select>
              </Field>
              <Field label="Última Manutenção (data)">
                <Input type="date" value={edit?.manutencao || ""} onChange={e => setEdit(o => ({ ...o, manutencao: e.target.value }))} />
              </Field>
              <Field label="Observações">
                <Textarea rows={4} value={edit?.observacoes || ""} onChange={e => setEdit(o => ({ ...o, observacoes: e.target.value }))} />
              </Field>
              <div className="flex gap-2">
                <Button onClick={save}>Salvar alterações</Button>
                <Link to="/elevadores"><Button variant="outline">Voltar</Button></Link>
              </div>
            </div>
          </Card>
          
          <Card className="p-6 flex flex-col">
            <h3 className="font-semibold">Histórico & Status</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
              Informações de registro e manutenção deste elevador.
            </p>
            
            <ul className="mt-3 text-sm list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
              <li>Cadastrado por: <b>{primeiroLog?.tecnico || 'N/A'}</b></li>
              <li>Última manutenção: {dados.manutencao || "—"}</li>
              <li>Status atual: {dados.status}</li>
              <li>Capacidade: {dados.capacidade || "—"}</li>
            </ul>

            <div className="my-4 h-px bg-zinc-200 dark:bg-zinc-800" />
            <h4 className="font-semibold text-sm mb-3">Log de Alterações</h4>

            {(!dados.historico || dados.historico.length === 0) ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nenhum histórico encontrado.
              </p>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-60"> 
                {dados.historico.map(log => (
                  <div key={log.id} className="text-sm pb-2 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 block">
                      {new Date(log.ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      {" por "}
                      <b>{log.tecnico}</b>
                    </span>
                    <p className="text-zinc-700 dark:text-zinc-300 mt-0.5">
                      {log.mensagem}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
          
        </div>
      </Section>
      
      <Section title="Dashboard ao Vivo" subtitle="Dados em tempo real dos sensores (Bunny & Buddy)">
        <Card className="p-10 grid place-items-center">
          <div className="text-center">
            <div className="text-5xl">📊</div>
            <div className="mt-2 font-medium">O painel de visualização está online.</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Acesse o dashboard em tela cheia para ver os dados.
            </div>
            <div className="mt-4">
              <Link to="/dashboard">
                <Button>Abrir Dashboard</Button>
              </Link>
            </div>
          </div>
        </Card>
      </Section>
    </>
  );
}

function ProtectedRoutes() {
  const { tecnicoLogado } = useStore();
  if (!tecnicoLogado) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registrar" element={<RegisterPage />} />
      <Route element={<ProtectedRoutes />}>
        <Route path="/" element={<Shell><Home /></Shell>} />
        <Route path="/opcoes" element={<Shell><Opcoes /></Shell>} />
        <Route path="/cadastro" element={<Shell><CadastroElevador /></Shell>} />
        <Route path="/elevadores" element={<Shell><ListaElevadores /></Shell>} />
        <Route path="/elevadores/:id" element={<Shell><ElevadorDetalhe /></Shell>} />
        <Route path="/buscar" element={<Shell><BuscarElevador /></Shell>} />
        <Route path="/dashboard" element={<LiveDashboard />} />
      </Route>
    </Routes>
  );
}

export default function AscensusApp() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <AppRoutes />
      </StoreProvider>
    </BrowserRouter>
  );
}