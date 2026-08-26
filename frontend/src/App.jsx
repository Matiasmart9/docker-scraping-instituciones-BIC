import React, { useState, useEffect } from 'react';
import { 
  Building2, ShieldAlert, RefreshCw, FileSpreadsheet, Search, LogOut, 
  CheckCircle2, AlertTriangle, XCircle, Clock, Info, ShieldCheck, History, User,
  Sun, Moon, Phone, MessageCircle, ChevronDown, Trash2, Plus, Settings, Menu
} from 'lucide-react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

const API_BASE = '/api/v1';

const WhatsappIcon = ({ size = 18, className = "", style = {} }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill="currentColor" 
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

const TABS_CATEGORIAS = [
  "Todas",
  "Activa",
  "Suspendida",
  "Bloqueada",
  "Con excepción de carga",
  "Desvinculada",
  "Validación de XML",
  "Activa (límite de consultas)",
  "Suspendida Carga"
];

const TelefonoInput = ({ value, onChange, onValidChange }) => {
  const PAISES = [
    { code: '+595', name: 'Paraguay', digits: 9, flag: '🇵🇾' },
    { code: '+54', name: 'Argentina', digits: 10, flag: '🇦🇷' },
    { code: '+55', name: 'Brasil', digits: 11, flag: '🇧🇷' },
    { code: '+591', name: 'Bolivia', digits: 8, flag: '🇧🇴' },
    { code: '+598', name: 'Uruguay', digits: 8, flag: '🇺🇾' },
    { code: '+56', name: 'Chile', digits: 9, flag: '🇨🇱' }
  ];

  // Extraer prefijo y número actual si existe
  const [valNumber, valName] = value ? value.split('|') : ['', ''];
  const initialCountry = valNumber ? PAISES.find(p => valNumber.startsWith(p.code)) || PAISES[0] : PAISES[0];
  const initialNumber = valNumber ? valNumber.replace(initialCountry.code, '') : '';

  const [country, setCountry] = useState(initialCountry);
  const [number, setNumber] = useState(initialNumber);
  const [name, setName] = useState(valName);
  const [error, setError] = useState('');

  useEffect(() => {
    const fullNumber = number.trim() ? country.code + number.trim() : '';
    
    // Brasil puede ser 10 u 11 dígitos
    let isValid = false;
    if (country.name === 'Brasil') {
      isValid = number.length === 10 || number.length === 11;
    } else {
      isValid = number.length === country.digits;
    }

    if (number.length > 0 && !isValid) {
      setError(`Debe tener ${country.name === 'Brasil' ? '10 u 11' : country.digits} dígitos`);
      onValidChange(false);
    } else {
      setError('');
      onValidChange(isValid);
    }

    onChange(fullNumber ? `${fullNumber}|${name.trim()}` : '');
  }, [country, number, name]);

  const handleNumberChange = (e) => {
    const val = e.target.value.replace(/\D/g, ''); // solo dígitos
    setNumber(val);
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select 
          className="form-input" 
          style={{ width: 'auto', flexShrink: 0, paddingRight: '20px' }}
          value={country.code}
          onChange={(e) => {
            setCountry(PAISES.find(p => p.code === e.target.value));
            setNumber('');
          }}
        >
          {PAISES.map(p => (
            <option key={p.code} value={p.code}>{p.flag} {p.code}</option>
          ))}
        </select>
        <input
          type="text"
          className="form-input"
          placeholder="Ej: 981234567"
          value={number}
          onChange={handleNumberChange}
          style={{ flexGrow: 1 }}
        />
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Nombre del Contacto (Opcional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flexGrow: 1 }}
        />
      </div>
      {error && <div style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px' }}>{error}</div>}
    </div>
  );
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('bicsa_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('bicsa_user') || 'null'));
  
  // Tema Claro / Oscuro
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('bicsa_theme') !== 'light';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove('light-theme');
      localStorage.setItem('bicsa_theme', 'dark');
    } else {
      document.body.classList.add('light-theme');
      localStorage.setItem('bicsa_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const formatOnlyDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A' || dateStr === 'N.A') return 'N/A';
    return dateStr.trim().split(' ')[0];
  };

  // Formulario Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Estados de datos
  const [kpis, setKpis] = useState(null);
  const [instituciones, setInstituciones] = useState([]);
  const [selectedTab, setSelectedTab] = useState('Todas');
  const [filterAlerta, setFilterAlerta] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modales y UI
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  // Historial y Backups
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [backupsList, setBackupsList] = useState([]);
  const [searchBackupQuery, setSearchBackupQuery] = useState('');
  const [filterBackupYear, setFilterBackupYear] = useState('Todos');
  const [filterBackupMonth, setFilterBackupMonth] = useState('Todos');
  const [backupCurrentPage, setBackupCurrentPage] = useState(1);

  // Modales de Confirmación
  const [showScrapeConfirmModal, setShowScrapeConfirmModal] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState(null);

  // WhatsApp Contactos Modals
  const [showContactosDropdown, setShowContactosDropdown] = useState(false);
  const [showPendientesModal, setShowPendientesModal] = useState(false);
  const [showContactosModal, setShowContactosModal] = useState(false);
  const [contactosPendientes, setContactosPendientes] = useState([]);
  const [contactosCargados, setContactosCargados] = useState([]);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState({});
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [searchContactosQuery, setSearchContactosQuery] = useState('');
  const [searchPendientesQuery, setSearchPendientesQuery] = useState('');

  const DEFAULT_TEMPLATES = [
    "⚠️ Recordatorio de carga XML\n\nHola {nombre},\nInstitución: {institucion}\nNivel de alerta: {alerta}\nFecha última carga: {fecha}\n\nPor favor realizar la carga a la brevedad.",
    "Hola {nombre}, te escribimos desde BICSA.\nLa institución {institucion} tiene un nivel de alerta {alerta}.\nSu última carga fue el {fecha}.\nPor favor regularizar su carga.",
    "Aviso Urgente: {institucion}\nSu estado es {alerta}. Su última carga de datos se registra el {fecha}.\nCumpla con la carga de datos para evitar sanciones."
  ];

  const [whatsappTemplates, setWhatsappTemplates] = useState(() => {
    const saved = localStorage.getItem('bicsa_wa_templates');
    return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES;
  });
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(() => {
    const saved = localStorage.getItem('bicsa_wa_active_index');
    return saved ? parseInt(saved) : 0;
  });
  const [showPlantillasModal, setShowPlantillasModal] = useState(false);
  const [tempTemplates, setTempTemplates] = useState([...whatsappTemplates]);
  const [tempActiveIndex, setTempActiveIndex] = useState(activeTemplateIndex);
  
  // Confirm modal state
  const [confirmWaModal, setConfirmWaModal] = useState({ show: false, institucionId: null, nombre: "" });

  useEffect(() => {
    if (token) {
      fetchDashboardData();
      fetchWhatsappStatus();
      const interval = setInterval(() => {
        fetchDashboardData();
        fetchWhatsappStatus();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [token, filterAlerta, selectedTab, searchQuery]);

  const fetchWhatsappStatus = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/notificaciones/status`, { headers });
      if (res.status === 401) {
        confirmLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setWhatsappStatus(data.conectado);
      }
    } catch (e) {
      setWhatsappStatus(false);
    }
  };

  const showToast = (msg, type = 'info') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      const firebaseToken = await userCredential.user.getIdToken();
      
      localStorage.setItem('bicsa_token', firebaseToken);
      localStorage.setItem('bicsa_user', JSON.stringify({ email: loginEmail }));
      setToken(firebaseToken);
      setUser({ email: loginEmail });
      showToast('Sesión iniciada correctamente', 'success');
    } catch (err) {
      setLoginError('Credenciales inválidas o error de red');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const confirmLogout = () => {
    localStorage.removeItem('bicsa_token');
    localStorage.removeItem('bicsa_user');
    setToken('');
    setUser(null);
    setShowLogoutConfirmModal(false);
    showToast('Sesión cerrada exitosamente', 'info');
  };

  // Auto-logout por inactividad (15 minutos)
  useEffect(() => {
    if (!token) return;

    let inactivityTimer;
    const timeout_ms = 15 * 60 * 1000; // 15 minutos

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        localStorage.removeItem('bicsa_token');
        localStorage.removeItem('bicsa_user');
        setToken('');
        setUser(null);
        showToast('Sesión cerrada automáticamente por inactividad (15 min)', 'info');
      }, timeout_ms);
    };

    // Eventos que reinician el temporizador
    const events = ['mousemove', 'mousedown', 'keypress', 'touchmove', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Inicializar temporizador al montar
    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [token]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Cargar KPIs
      const resKpis = await fetch(`${API_BASE}/instituciones/kpis`, { headers });
      if (resKpis.status === 401) {
        confirmLogout();
        return;
      }
      if (resKpis.ok) {
        const dataKpis = await resKpis.json();
        setKpis(dataKpis);
      }

      // 2. Cargar Estado Actual con filtros
      let url = `${API_BASE}/instituciones/estado-actual?`;
      if (selectedTab !== 'Todas') url += `categoria=${encodeURIComponent(selectedTab)}&`;
      if (filterAlerta) url += `alerta=${encodeURIComponent(filterAlerta)}&`;

      const resInst = await fetch(url, { headers });
      if (resInst.ok) {
        const dataInst = await resInst.json();
        setInstituciones(dataInst);
      }
    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBackupsList = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/instituciones/backups`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBackupsList(data);
        setShowHistorialModal(true);
      }
    } catch (err) {
      showToast('Error al cargar historial de backups', 'error');
    }
  };

  const fetchContactosPendientes = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/contactos/pendientes`, { headers });
      if (res.ok) {
        const data = await res.json();
        setContactosPendientes(data);
      }
    } catch (err) {
      showToast('Error al cargar contactos pendientes', 'error');
    }
  };

  const fetchContactosCargados = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/contactos/cargados`, { headers });
      if (res.ok) {
        const data = await res.json();
        setContactosCargados(data);
      }
    } catch (err) {
      showToast('Error al cargar contactos cargados', 'error');
    }
  };

  const openPendientesModal = () => {
    setShowContactosDropdown(false);
    fetchContactosPendientes();
    setShowPendientesModal(true);
  };

  const openContactosModal = () => {
    setShowContactosDropdown(false);
    fetchContactosCargados();
    setShowContactosModal(true);
  };

  const enviarRecordatorioWhatsApp = async (id) => {
    setIsSendingWhatsApp(prev => ({ ...prev, [id]: true }));
    try {
      const payload = {
        mensaje_custom: whatsappTemplates[activeTemplateIndex]
      };
      const res = await fetch(`${API_BASE}/notificaciones/instituciones/${id}/enviar-recordatorio`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error al enviar WhatsApp');
      }
      showToast(`Recordatorio de WhatsApp enviado correctamente a ${confirmWaModal.nombre}`, 'success');
      setConfirmWaModal({ show: false, institucionId: null, nombre: "" });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSendingWhatsApp(prev => ({ ...prev, [id]: false }));
    }
  };

  const confirmarEnvioWhatsApp = (id, nombre) => {
    setConfirmWaModal({ show: true, institucionId: id, nombre });
  };

  const handleDownloadBackupFile = async (filename) => {
    showToast(`Descargando ${filename}...`, 'info');
    try {
      const res = await fetch(`${API_BASE}/instituciones/backups/download/${filename}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falló la descarga del backup');

      const rawBlob = await res.blob();
      const excelBlob = new Blob([rawBlob], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      const url = window.URL.createObjectURL(excelBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 500);
    } catch (err) {
      showToast('Error al descargar archivo de backup', 'error');
    }
  };

  const confirmDeleteBackupFile = async () => {
    if (!backupToDelete) return;
    try {
      const res = await fetch(`${API_BASE}/instituciones/backups/${backupToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`Archivo ${backupToDelete} eliminado correctamente`, 'success');
        setBackupsList(prev => prev.filter(b => b.filename !== backupToDelete));
      } else {
        throw new Error('No se pudo eliminar el archivo');
      }
    } catch (err) {
      showToast('Error al eliminar backup', 'error');
    } finally {
      setBackupToDelete(null);
    }
  };

  const handleExportExcel = async () => {
    showToast('Generando reporte Excel...', 'info');
    try {
      const res = await fetch(`${API_BASE}/instituciones/exportar-excel`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falló la generación del Excel');

      const nowStr = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
      let filename = `BICSA_Estado_Instituciones_${nowStr}.xlsx`;

      const disposition = res.headers.get('Content-Disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const rawBlob = await res.blob();
      const excelBlob = new Blob([rawBlob], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      const url = window.URL.createObjectURL(excelBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 500);

      showToast('Reporte Excel descargado y guardado en Backup_Scraping', 'success');
    } catch (err) {
      console.error('Error al exportar Excel:', err);
      showToast('Error al exportar Excel', 'error');
    }
  };

  const confirmTriggerScrape = async () => {
    setShowScrapeConfirmModal(false);
    setIsScraping(true);
    showToast('Iniciando corrida manual de scraping...', 'info');
    try {
      const res = await fetch(`${API_BASE}/instituciones/trigger-scrape`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      showToast(data.message || 'Scraping en proceso (los datos se actualizarán solos)', 'success');
      // Hacer polling para actualizar los datos mientras termina en background
      setTimeout(fetchDashboardData, 3000);
      setTimeout(fetchDashboardData, 10000);
      setTimeout(fetchDashboardData, 25000);
    } catch (err) {
      showToast('Error al disparar scraping', 'error');
    } finally {
      setIsScraping(false);
    }
  };

  const handleAlertFilterClick = (alertaType) => {
    setFilterAlerta(prev => prev === alertaType ? null : alertaType);
    setTimeout(() => {
      document.querySelector('.main-content')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Filtrado en vivo por texto
  const filteredInstituciones = instituciones.filter(inst => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return inst.nombre_institucion.toLowerCase().includes(q) || 
           inst.estado.toLowerCase().includes(q) ||
           (inst.motivo_suspension && inst.motivo_suspension.toLowerCase().includes(q));
  });

  // Filtrado de Backups por nombre, año y mes
  const filteredBackups = backupsList.filter(b => {
    if (searchBackupQuery && !b.filename.toLowerCase().includes(searchBackupQuery.toLowerCase())) return false;
    if (filterBackupYear !== 'Todos' && b.year !== filterBackupYear) return false;
    if (filterBackupMonth !== 'Todos' && b.month !== filterBackupMonth) return false;
    return true;
  });

  const availableYears = Array.from(new Set(backupsList.map(b => b.year)));
  const availableMonths = Array.from(new Set(backupsList.map(b => b.month))).sort();

  if (!token) {
    return (
      <div className="modal-overlay">
        <div className="glass-panel login-card">
          <div className="brand" style={{ marginBottom: '24px', justifyContent: 'center' }}>
            <img src="/icono_Bicsa.ico" alt="BICSA" className="brand-logo-img" />
            <div>
              <div className="brand-title">BICSA Web Satélite V1.5</div>
              <div className="brand-subtitle">Monitoreo de Estado de Instituciones</div>
            </div>
          </div>

          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, textAlign: 'center', marginBottom: '20px' }}>
            Iniciar Sesión
          </h2>

          {loginError && (
            <div className="alert-banner" style={{ marginBottom: '16px', padding: '10px 14px' }}>
              <AlertTriangle size={16} />
              <span style={{ fontSize: '0.8rem' }}>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <input 
                type="email" 
                className="form-input" 
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input 
                type="password" 
                className="form-input" 
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-orange" 
              style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Iniciando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          background: toastMessage.type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          fontWeight: 600,
          fontSize: '0.875rem'
        }}>
          {toastMessage.msg}
        </div>
      )}

      {/* Navbar Superior */}
      <header className="glass-panel navbar" style={{ position: 'relative', zIndex: 100 }}>
        <div className="brand">
          <img src="/icono_Bicsa.ico" alt="BICSA" className="brand-logo-img" />
          <div>
            <div className="brand-title">BICSA Web Satélite V1.5</div>
            <div className="brand-subtitle">Monitoreo de Estado de Instituciones</div>
          </div>
        </div>

        <div className="nav-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '12px' }}>
            <span className="pulse-dot"></span>
            <span>Sistema en Línea</span>
          </div>

          {whatsappStatus !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: whatsappStatus ? '#10B981' : '#EF4444', marginRight: '12px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '20px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: whatsappStatus ? '#10B981' : '#EF4444' }}></div>
              <span>WhatsApp: {whatsappStatus ? 'Conectado' : 'Desconectado'}</span>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <button className="btn btn-secondary" onClick={() => setShowContactosDropdown(!showContactosDropdown)} title="Menu Principal">
              <Menu size={16} />
              <span>Menú</span>
              <ChevronDown size={14} />
            </button>
            
            {showContactosDropdown && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', zIndex: 100, minWidth: '220px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '4px', border: 'none' }}
                  onClick={openPendientesModal}
                >
                  <AlertTriangle size={16} className="text-orange-500" /> Pendiente Carga
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none', marginBottom: '4px' }}
                  onClick={openContactosModal}
                >
                  <CheckCircle2 size={16} className="text-green-500" /> Contacto Instituciones
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none', marginBottom: '4px' }}
                  onClick={() => {
                    setShowContactosDropdown(false);
                    setTempTemplates([...whatsappTemplates]);
                    setTempActiveIndex(activeTemplateIndex);
                    setShowPlantillasModal(true);
                  }}
                >
                  <Settings size={16} className="text-blue-500" /> Plantillas de Mensaje
                </button>
                <a 
                  href="/qr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none', textDecoration: 'none', marginBottom: '4px' }}
                >
                  <WhatsappIcon size={16} style={{ color: '#10B981' }} /> Lector QR WhatsApp
                </a>
                <button 
                  className="btn btn-secondary" 
                  onClick={toggleTheme} 
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
                >
                  {isDarkMode ? <Sun size={16} className="text-yellow-500" /> : <Moon size={16} className="text-indigo-500" />} 
                  <span>{isDarkMode ? 'Tema Claro' : 'Tema Oscuro'}</span>
                </button>
              </div>
            )}
          </div>

          <button className="btn btn-secondary" onClick={fetchBackupsList} title="Ver Historial de Backups Excel">
            <History size={16} />
            Historial
          </button>

          <button className="btn btn-excel" onClick={handleExportExcel} title="Exportar Excel Actual">
            <FileSpreadsheet size={16} />
            Exportar Excel
          </button>

          <button className="btn btn-orange" onClick={() => setShowScrapeConfirmModal(true)} disabled={isScraping}>
            <RefreshCw size={16} className={isScraping ? 'spin' : ''} />
            {isScraping ? 'Scraping...' : 'Ejecutar Scraping'}
          </button>

          <button className="btn btn-secondary" onClick={() => setShowLogoutConfirmModal(true)} title="Cerrar Sesión">
            <LogOut size={16} />
          </button>

        </div>
      </header>

      {/* Banner de Alertas (Multilínea) */}
      {kpis && (kpis.en_alerta_critica > 0 || kpis.en_alerta_advertencia > 0) && (
        <div className="alert-banner" style={{ 
          background: kpis.en_alerta_critica > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)', 
          borderColor: kpis.en_alerta_critica > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)', 
          color: kpis.en_alerta_critica > 0 ? '#FCA5A5' : '#FDE68A' 
        }}>
          <div className="alert-banner-content">
            <ShieldAlert size={20} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>¡Atención Requerida en Carga de XML!</div>
              {kpis.en_alerta_critica > 0 && (
                <div style={{ fontSize: '0.875rem' }}>
                  Hay <strong>{kpis.en_alerta_critica}</strong> institución(es) en <strong style={{ color: '#F87171' }}>Estado Crítico ( &gt;72h sin carga).</strong>
                </div>
              )}
              {kpis.en_alerta_advertencia > 0 && (
                <div style={{ fontSize: '0.875rem', marginTop: '2px' }}>
                  Hay <strong>{kpis.en_alerta_advertencia}</strong> institución(es) en <strong style={{ color: '#FBBF24' }}>Advertencia ( 48h-72h sin carga).</strong>
                </div>
              )}
            </div>
          </div>
          <div className="alert-banner-actions">
            {kpis.en_alerta_critica > 0 && (
              <button 
                className={`btn btn-sm ${filterAlerta === 'CRITICO' ? 'active' : ''}`}
                style={{ background: '#EF4444', color: 'white' }}
                onClick={() => handleAlertFilterClick('CRITICO')}
              >
                Ver Críticas
              </button>
            )}
            {kpis.en_alerta_advertencia > 0 && (
              <button 
                className={`btn btn-sm ${filterAlerta === 'ADVERTENCIA' ? 'active' : ''}`}
                style={{ background: '#F59E0B', color: 'white' }}
                onClick={() => handleAlertFilterClick('ADVERTENCIA')}
              >
                Ver Advertencias
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tarjetas KPI */}
      <div className="kpi-grid">
        <div className="glass-panel kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Registradas</span>
            <div className="kpi-icon icon-cyan">
              <Building2 size={20} />
            </div>
          </div>
          <div className="kpi-value">{kpis ? kpis.total_instituciones : '-'}</div>
          <div className="kpi-subtext">Última actualización: {kpis ? kpis.ultima_actualizacion || 'N/A' : 'Cargando...'}</div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Activas</span>
            <div className="kpi-icon icon-emerald">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="kpi-value text-emerald">{kpis ? kpis.activas : '-'}</div>
          <div className="kpi-subtext">Operativas y al día</div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Bloqueadas</span>
            <div className="kpi-icon icon-rose">
              <XCircle size={20} />
            </div>
          </div>
          <div className="kpi-value text-rose">{kpis ? kpis.bloqueadas : '-'}</div>
          <div className="kpi-subtext">Carga XML omitida (+72h hábiles)</div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Suspendidas</span>
            <div className="kpi-icon icon-amber">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="kpi-value text-amber">{kpis ? kpis.suspendidas : '-'}</div>
          <div className="kpi-subtext">Inconsistencias administrativas</div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Validación XML</span>
            <div className="kpi-icon icon-cyan">
              <Clock size={20} />
            </div>
          </div>
          <div className="kpi-value text-cyan">{kpis ? kpis.validacion_xml : '-'}</div>
          <div className="kpi-subtext">Estado Validación XML</div>
        </div>
      </div>

      {/* Panel Principal de Filtros y Tabla */}
      <main className="glass-panel main-content" style={{ padding: '24px' }}>
        <div className="table-header-toolbar">
          <div className="tab-group">
            {TABS_CATEGORIAS.map(cat => {
              const count = kpis?.conteo_categorias?.[cat];
              return (
                <button 
                  key={cat}
                  className={`tab-btn ${selectedTab === cat ? 'active' : ''}`}
                  onClick={() => { setSelectedTab(cat); setFilterAlerta(null); }}
                >
                  {cat} {count !== undefined && <span className="tab-badge">({count})</span>}
                </button>
              );
            })}
          </div>

          <div className="table-sub-toolbar">
            <div className="table-result-count">
              Mostrando <strong>{filteredInstituciones.length}</strong> de <strong>{kpis?.conteo_categorias?.[selectedTab] || instituciones.length}</strong> instituciones ({selectedTab})
            </div>

            <div className="search-box">
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Buscar por institución..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tabla de Datos */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Institución</th>
                <th>Estado Actual</th>
                <th style={{ textAlign: 'center' }}>Búsquedas Máx.</th>
                <th style={{ textAlign: 'center' }}>Última Carga XML</th>
                <th style={{ textAlign: 'center' }}>Calidad Datos</th>
                <th style={{ textAlign: 'center' }}>Detalles / Motivo / Vencimiento</th>
                <th style={{ textAlign: 'center', lineHeight: '1.2' }}>Tiempo Hábil<br/>Restante (Límite 72h)</th>
                <th style={{ textAlign: 'center', lineHeight: '1.2' }}>Nivel de Alerta<br/>Carga XML</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstituciones.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No se encontraron registros de instituciones para el criterio seleccionado.
                  </td>
                </tr>
              ) : (
                filteredInstituciones.map(item => {
                  const hrsRestantes = item.horas_habiles_restantes;
                  const pct = Math.max(0, Math.min(100, (hrsRestantes / 72.0) * 100));
                  
                  let badgeClass = 'badge-activa';
                  if (item.estado.toLowerCase().includes('desvinculad')) badgeClass = 'badge-desvinculada';
                  else if (item.estado.toLowerCase().includes('bloquea')) badgeClass = 'badge-bloqueada';
                  else if (item.estado.toLowerCase().includes('suspend')) badgeClass = 'badge-suspendida';
                  else if (item.estado.toLowerCase().includes('excepci')) badgeClass = 'badge-excepcion';
                  else if (item.estado.toLowerCase().includes('validaci')) badgeClass = 'badge-validacion';

                  let barClass = 'normal';
                  if (item.nivel_alerta === 'CRITICO') barClass = 'critical';
                  else if (item.nivel_alerta === 'ADVERTENCIA') barClass = 'warning';

                  const esDesvinculada = item.nivel_alerta === 'DESVINCULADA' || item.estado.toLowerCase().includes('desvinculad');
                  const esBloqueadaOSuspendida = item.nivel_alerta === 'BLOQUEADO' || item.nivel_alerta === 'SUSPENDIDA' || item.estado.toLowerCase().includes('bloquea') || item.estado.toLowerCase().includes('suspend');

                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.nombre_institucion}</td>
                      <td><span className={`badge ${badgeClass}`}>{item.estado}</span></td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{item.cant_max_busquedas.toLocaleString()}</td>
                      <td style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatOnlyDate(item.fecha_ultima_carga)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: item.calidad_datos === 'Alta' ? '#34D399' : item.calidad_datos === 'Baja' ? '#F87171' : 'var(--text-muted)' }}>
                          {item.calidad_datos || 'N.A'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.8rem', maxWidth: '220px', color: 'var(--text-muted)' }}>
                        {item.motivo_suspension || item.vencimiento_validacion || '-'}
                      </td>
                      <td>
                        {esDesvinculada || esBloqueadaOSuspendida ? (
                          <span style={{ textAlign: 'center', display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>-</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{hrsRestantes.toFixed(1)} hs restantes</span>
                            <div className="progress-bar-container">
                              <div className={`progress-bar-fill ${barClass}`} style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div>
                            {item.nivel_alerta === 'CRITICO' && <span className="badge badge-bloqueada">CRÍTICO (&gt;72h)</span>}
                            {item.nivel_alerta === 'ADVERTENCIA' && <span className="badge badge-suspendida">ADVERTENCIA (48h-72h)</span>}
                            {item.nivel_alerta === 'NORMAL' && <span className="badge badge-activa">NORMAL (&lt;48h)</span>}
                            {item.nivel_alerta === 'DESVINCULADA' && <span className="badge badge-desvinculada">DESVINCULADA</span>}
                            {item.nivel_alerta === 'BLOQUEADO' && <span className="badge badge-bloqueada">BLOQUEADA</span>}
                            {item.nivel_alerta === 'SUSPENDIDA' && <span className="badge badge-suspendida">SUSPENDIDA</span>}
                          </div>
                          
                          {/* Botón WhatsApp */}
                          <button
                            onClick={() => confirmarEnvioWhatsApp(item.id, item.nombre_institucion)}
                            title={item.telefonos_contacto?.length ? "Enviar recordatorio por WhatsApp" : "Sin contacto cargado"}
                            disabled={!item.telefonos_contacto?.length || isSendingWhatsApp[item.id]}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              padding: 0, 
                              cursor: (!item.telefonos_contacto?.length || isSendingWhatsApp[item.id]) ? 'not-allowed' : 'pointer',
                              opacity: (!item.telefonos_contacto?.length || isSendingWhatsApp[item.id]) ? 0.4 : 1,
                              transition: 'transform 0.1s'
                            }}
                            onMouseOver={(e) => { if (item.telefonos_contacto?.length && !isSendingWhatsApp[item.id]) e.currentTarget.style.transform = 'scale(1.1)' }}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          >
                            {isSendingWhatsApp[item.id] ? 
                              <RefreshCw size={18} className="spin" style={{ color: '#10B981' }} /> : 
                              <WhatsappIcon size={20} style={{ color: (!item.telefonos_contacto?.length || isSendingWhatsApp[item.id]) ? '#64748B' : '#10B981' }} />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal Historial de Backups Excel (Backup_Scraping) */}
      {showHistorialModal && (
        <div className="modal-overlay" onClick={() => setShowHistorialModal(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '920px', padding: '24px', maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Historial de Reportes y Backups de Scraping</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Archivos Excel (.xlsx) generados automáticamente por día y almacenados en <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Backup_Scraping</code></p>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowHistorialModal(false)}>Cerrar ✕</button>
            </div>

            {/* Filtros de Historial (Año, Mes, Búsqueda) */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Buscar por nombre de archivo:</label>
                <input 
                  type="text" 
                  className="search-input" 
                  style={{ width: '100%', padding: '6px 12px' }} 
                  placeholder="Filtrar reporte..."
                  value={searchBackupQuery}
                  onChange={e => setSearchBackupQuery(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Año:</label>
                <select 
                  className="form-input" 
                  style={{ padding: '6px 12px', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
                  value={filterBackupYear}
                  onChange={e => setFilterBackupYear(e.target.value)}
                >
                  <option value="Todos">Todos los Años</option>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Mes:</label>
                <select 
                  className="form-input" 
                  style={{ padding: '6px 12px', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
                  value={filterBackupMonth}
                  onChange={e => setFilterBackupMonth(e.target.value)}
                >
                  <option value="Todos">Todos los Meses</option>
                  {availableMonths.map(m => <option key={m} value={m}>Mes {m}</option>)}
                </select>
              </div>
            </div>

            {/* Tabla de Backups con Scroll y Paginación (31 filas por página) */}
            <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre de Archivo Excel</th>
                    <th style={{ textAlign: 'center' }}>Fecha de Creación</th>
                    <th style={{ textAlign: 'center' }}>Tamaño</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBackups.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No se encontraron archivos de backup en la carpeta Backup_Scraping.
                      </td>
                    </tr>
                  ) : (
                    filteredBackups.slice((backupCurrentPage - 1) * 31, backupCurrentPage * 31).map(b => (
                      <tr key={b.filename}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>📄 {b.filename}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{b.fecha_modificacion}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{b.size_str}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button 
                              className="btn btn-excel" 
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleDownloadBackupFile(b.filename)}
                            >
                              Descargar 📥
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: '#F87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                              onClick={() => setBackupToDelete(b.filename)}
                            >
                              Eliminar 🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginador (Página X de Y, 31 por página) */}
            {filteredBackups.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Mostrando {Math.min(filteredBackups.length, (backupCurrentPage - 1) * 31 + 1)} - {Math.min(filteredBackups.length, backupCurrentPage * 31)} de {filteredBackups.length} archivos (Máx 31 por página)
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    disabled={backupCurrentPage <= 1}
                    onClick={() => setBackupCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    ◄ Anterior
                  </button>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    Página {backupCurrentPage} de {Math.ceil(filteredBackups.length / 31) || 1}
                  </span>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    disabled={backupCurrentPage >= Math.ceil(filteredBackups.length / 31)}
                    onClick={() => setBackupCurrentPage(prev => Math.min(Math.ceil(filteredBackups.length / 31), prev + 1))}
                  >
                    Siguiente ►
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Confirmación Ejecutar Scraping */}
      {showScrapeConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowScrapeConfirmModal(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <RefreshCw size={36} color="#F97316" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}>¿Ejecutar Scraping Manual?</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Esta acción disparará la recolección en vivo del portal de BICSA y guardará automáticamente un backup Excel en <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px' }}>Backup_Scraping</code>.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowScrapeConfirmModal(false)}>Cancelar</button>
              <button className="btn btn-orange" onClick={confirmTriggerScrape}>Sí, Ejecutar Ahora</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Cerrar Sesión */}
      {showLogoutConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirmModal(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <LogOut size={36} color="#EF4444" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}>¿Cerrar Sesión?</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Saldrás del Dashboard del Portal Satélite de BICSA.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowLogoutConfirmModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: '#EF4444' }} onClick={confirmLogout}>Sí, Cerrar Sesión</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminar Backup File */}
      {backupToDelete && (
        <div className="modal-overlay" onClick={() => setBackupToDelete(null)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <XCircle size={36} color="#EF4444" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}>¿Eliminar Backup de Excel?</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Estás a punto de eliminar permanentemente el archivo:
            </p>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', color: '#F87171', padding: '8px', borderRadius: '6px', marginBottom: '24px', wordBreak: 'break-all' }}>
              {backupToDelete}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setBackupToDelete(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: '#EF4444' }} onClick={confirmDeleteBackupFile}>Sí, Eliminar de Carpeta</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PENDIENTES CARGA CONTACTO */}
      {showPendientesModal && (
        <div className="modal-overlay" onClick={() => setShowPendientesModal(false)}>
          <div className="glass-panel modal-lg" style={{ width: '100%', maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div className="kpi-header" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={20} className="text-orange-500" />
                Instituciones Pendientes de Carga de Contacto
              </h2>
              <button className="btn-close" onClick={() => setShowPendientesModal(false)}><XCircle size={20} /></button>
            </div>
            
            {contactosPendientes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p>¡Excelente! Todas las instituciones activas tienen un contacto cargado.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Buscar por nombre de institución..."
                    value={searchPendientesQuery}
                    onChange={(e) => setSearchPendientesQuery(e.target.value)}
                    style={{ width: '100%', maxWidth: '400px' }}
                  />
                </div>
                <div className="table-responsive" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  <table className="bicsa-table">
                  <thead>
                    <tr>
                      <th>Institución</th>
                      <th>Estado</th>
                      <th>Teléfono de Contacto (WhatsApp)</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactosPendientes.map((inst, idx) => {
                      if (searchPendientesQuery && !inst.nombre.toLowerCase().includes(searchPendientesQuery.toLowerCase())) {
                        return null;
                      }
                      return (
                      <tr key={inst.id}>
                        <td style={{ fontWeight: 600 }}>{inst.nombre}</td>
                        <td>{inst.estado_actual}</td>
                        <td style={{ minWidth: '220px' }}>
                          <TelefonoInput 
                            value={inst.tempPhone || ''} 
                            onChange={(val) => {
                              const newArr = [...contactosPendientes];
                              newArr[idx].tempPhone = val;
                              setContactosPendientes(newArr);
                            }}
                            onValidChange={(isValid) => {
                              const newArr = [...contactosPendientes];
                              newArr[idx].isValid = isValid;
                              setContactosPendientes(newArr);
                            }}
                          />
                        </td>
                        <td>
                              <button 
                                className="btn btn-blue btn-sm" 
                                disabled={!inst.isValid}
                                onClick={async () => {
                              try {
                                const res = await fetch(`${API_BASE}/contactos/${inst.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                  body: JSON.stringify({ telefonos: [inst.tempPhone], usuario: user?.email })
                                });
                                if (res.ok) {
                                  showToast('Contacto cargado exitosamente', 'success');
                                  setContactosPendientes(prev => prev.filter(p => p.id !== inst.id));
                                } else {
                                  throw new Error('Error al guardar contacto');
                                }
                              } catch (err) {
                                showToast(err.message, 'error');
                              }
                            }}
                          >
                            Guardar
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CONTACTO INSTITUCIONES CARGADAS */}
      {showContactosModal && (
        <div className="modal-overlay" onClick={() => setShowContactosModal(false)}>
          <div className="glass-panel modal-lg" style={{ width: '100%', maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div className="kpi-header" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={20} className="text-green-500" />
                Contactos de Instituciones
              </h2>
              <button className="btn-close" onClick={() => setShowContactosModal(false)}><XCircle size={20} /></button>
            </div>
            
            {contactosCargados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                <p>No hay instituciones con contactos cargados.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Buscar por nombre de institución..."
                    value={searchContactosQuery}
                    onChange={(e) => setSearchContactosQuery(e.target.value)}
                    style={{ width: '100%', maxWidth: '400px' }}
                  />
                </div>
                <div className="table-responsive" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  <table className="bicsa-table">
                    <thead>
                      <tr>
                        <th>Institución</th>
                        <th>Teléfonos</th>
                        <th>Última Act.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contactosCargados.map((inst, idx) => {
                        if (searchContactosQuery && !inst.nombre.toLowerCase().includes(searchContactosQuery.toLowerCase())) {
                          return null;
                        }
                        return (
                      <tr key={inst.id}>
                        <td style={{ fontWeight: 600 }}>{inst.nombre}</td>
                        <td>
                          {inst.telefonos_contacto.map((telStr, tIdx) => {
                            const [telNumber, telName] = telStr.split('|');
                            return (
                            <div key={tIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                {telName ? `${telName} - ${telNumber}` : telNumber}
                              </span>
                              <button 
                                className="text-red-500 hover:text-red-600" 
                                title="Eliminar teléfono"
                                onClick={async () => {
                                  if (!window.confirm(`¿Estás seguro que deseas eliminar el contacto ${telName || telNumber}?`)) return;
                                  const newTels = inst.telefonos_contacto.filter((_, i) => i !== tIdx);
                                  try {
                                    const res = await fetch(`${API_BASE}/contactos/${inst.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                      body: JSON.stringify({ telefonos: newTels, usuario: user?.email })
                                    });
                                    if (res.ok) {
                                      showToast('Teléfono eliminado', 'info');
                                      const newCargados = [...contactosCargados];
                                      newCargados[idx].telefonos_contacto = newTels;
                                      if (newTels.length === 0) {
                                        newCargados.splice(idx, 1);
                                      }
                                      setContactosCargados(newCargados);
                                    }
                                  } catch (e) { showToast('Error al eliminar', 'error'); }
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            );
                          })}
                          {inst.telefonos_contacto.length < 2 && !inst.isAdding && (
                            <button className="btn btn-sm btn-secondary" style={{ marginTop: '4px', padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => {
                              const newCargados = [...contactosCargados];
                              newCargados[idx].isAdding = true;
                              setContactosCargados(newCargados);
                            }}>
                              <Plus size={12} /> Agregar otro
                            </button>
                          )}
                          {inst.isAdding && (
                            <div style={{ marginTop: '8px', background: 'var(--card-bg)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <TelefonoInput 
                                value={inst.tempPhone || ''} 
                                onChange={(val) => {
                                  const newArr = [...contactosCargados];
                                  newArr[idx].tempPhone = val;
                                  setContactosCargados(newArr);
                                }}
                                onValidChange={(isValid) => {
                                  const newArr = [...contactosCargados];
                                  newArr[idx].isValid = isValid;
                                  setContactosCargados(newArr);
                                }}
                              />
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => {
                                  const newCargados = [...contactosCargados];
                                  newCargados[idx].isAdding = false;
                                  setContactosCargados(newCargados);
                                }}>Cancelar</button>
                                <button className="btn btn-blue btn-sm" disabled={!inst.isValid} onClick={async () => {
                                  const newTels = [...inst.telefonos_contacto, inst.tempPhone];
                                  try {
                                    const res = await fetch(`${API_BASE}/contactos/${inst.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                      body: JSON.stringify({ telefonos: newTels, usuario: user?.email })
                                    });
                                    if (res.ok) {
                                      showToast('Teléfono agregado', 'success');
                                      const newCargados = [...contactosCargados];
                                      newCargados[idx].telefonos_contacto = newTels;
                                      newCargados[idx].isAdding = false;
                                      newCargados[idx].tempPhone = '';
                                      setContactosCargados(newCargados);
                                    }
                                  } catch (e) { showToast('Error al agregar', 'error'); }
                                }}>Guardar</button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <div>{inst.contacto_actualizado_por}</div>
                          <div>{inst.contacto_actualizado_en ? new Date(inst.contacto_actualizado_en).toLocaleDateString() : ''}</div>
                        </td>
                      </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de Plantillas WhatsApp */}
      {showPlantillasModal && (
        <div className="modal-overlay" onClick={() => setShowPlantillasModal(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={20} className="text-green-500" />
                Configurar Textos de WhatsApp
              </h2>
              <button className="btn-close" onClick={() => setShowPlantillasModal(false)}><XCircle size={20} /></button>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Puedes usar las siguientes variables: {'{nombre}'}, {'{institucion}'}, {'{alerta}'}, {'{fecha}'}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
              {tempTemplates.map((text, idx) => (
                <div key={idx} style={{ 
                  border: tempActiveIndex === idx ? '2px solid #10B981' : '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  padding: '12px',
                  background: tempActiveIndex === idx ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                      <input 
                        type="radio" 
                        name="activeTemplate" 
                        checked={tempActiveIndex === idx} 
                        onChange={() => setTempActiveIndex(idx)}
                        style={{ cursor: 'pointer' }}
                      />
                      Plantilla {idx + 1} {tempActiveIndex === idx && <span className="badge badge-activa" style={{fontSize:'0.65rem'}}>Activa</span>}
                    </label>
                  </div>
                  <textarea
                    className="form-input"
                    style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
                    value={text}
                    onChange={(e) => {
                      const newT = [...tempTemplates];
                      newT[idx] = e.target.value;
                      setTempTemplates(newT);
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowPlantillasModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" style={{ backgroundColor: '#f97316', borderColor: '#f97316' }} onClick={() => {
                setWhatsappTemplates(tempTemplates);
                setActiveTemplateIndex(tempActiveIndex);
                localStorage.setItem('bicsa_wa_templates', JSON.stringify(tempTemplates));
                localStorage.setItem('bicsa_wa_active_index', tempActiveIndex.toString());
                setShowPlantillasModal(false);
                showToast('Plantillas guardadas correctamente', 'success');
              }}>
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación WhatsApp */}
      {confirmWaModal.show && (
        <div className="modal-overlay" onClick={() => setConfirmWaModal({ show: false, institucionId: null, nombre: "" })}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <WhatsappIcon size={48} style={{ color: '#10B981' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginTop: '16px', marginBottom: '8px' }}>Confirmar Envío</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              ¿Estás seguro que deseas enviar un recordatorio por WhatsApp a <strong>{confirmWaModal.nombre}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setConfirmWaModal({ show: false, institucionId: null, nombre: "" })}
                disabled={isSendingWhatsApp[confirmWaModal.institucionId]}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                style={{ backgroundColor: '#f97316', borderColor: '#f97316' }} 
                onClick={() => enviarRecordatorioWhatsApp(confirmWaModal.institucionId)}
                disabled={isSendingWhatsApp[confirmWaModal.institucionId]}
              >
                {isSendingWhatsApp[confirmWaModal.institucionId] ? 'Enviando...' : 'Sí, Enviar WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
