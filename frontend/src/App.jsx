import React, { useState, useEffect } from 'react';
import { 
  Building2, ShieldAlert, RefreshCw, FileSpreadsheet, Search, LogOut, 
  CheckCircle2, AlertTriangle, XCircle, Clock, Info, ShieldCheck, History, User,
  Sun, Moon
} from 'lucide-react';

const API_BASE = '/api/v1';

const TABS_CATEGORIAS = [
  "Todas",
  "Activa",
  "Suspendida",
  "Bloqueada",
  "Con excepción de carga",
  "Desvinculada",
  "Validación de XML",
  "Activa (límite de consultas)"
];

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
  const [loginEmail, setLoginEmail] = useState('admin@bicsasatelite.com');
  const [loginPass, setLoginPass] = useState('AdminPassword2026!');
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

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token, selectedTab, filterAlerta]);

  const showToast = (msg, type = 'info') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const formData = new FormData();
      formData.append('username', loginEmail);
      formData.append('password', loginPass);

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Credenciales inválidas');
      }

      const data = await res.json();
      localStorage.setItem('bicsa_token', data.access_token);
      localStorage.setItem('bicsa_user', JSON.stringify({ email: loginEmail }));
      setToken(data.access_token);
      setUser({ email: loginEmail });
      showToast('Sesión iniciada correctamente', 'success');
    } catch (err) {
      setLoginError(err.message || 'Error al iniciar sesión');
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

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Cargar KPIs
      const resKpis = await fetch(`${API_BASE}/instituciones/kpis`, { headers });
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
      showToast(data.message || 'Scraping en proceso', 'success');
      setTimeout(fetchDashboardData, 3000);
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
              <div className="brand-title">BICSA Web Satélite V1.0</div>
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
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Iniciando...' : 'Entrar al Dashboard'}
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
      <header className="glass-panel navbar">
        <div className="brand">
          <img src="/icono_Bicsa.ico" alt="BICSA" className="brand-logo-img" />
          <div>
            <div className="brand-title">BICSA Web Satélite V1.0</div>
            <div className="brand-subtitle">Monitoreo de Estado de Instituciones</div>
          </div>
        </div>

        <div className="nav-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '12px' }}>
            <span className="pulse-dot"></span>
            <span>Sistema en Línea</span>
          </div>

          <button className="btn btn-secondary" onClick={toggleTheme} title="Cambiar Tema (Claro / Oscuro)">
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            <span>{isDarkMode ? 'Tema Claro' : 'Tema Oscuro'}</span>
          </button>

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
                        {item.nivel_alerta === 'CRITICO' && <span className="badge badge-bloqueada">CRÍTICO (&gt;72h)</span>}
                        {item.nivel_alerta === 'ADVERTENCIA' && <span className="badge badge-suspendida">ADVERTENCIA (48h-72h)</span>}
                        {item.nivel_alerta === 'NORMAL' && <span className="badge badge-activa">NORMAL (&lt;48h)</span>}
                        {item.nivel_alerta === 'DESVINCULADA' && <span className="badge badge-desvinculada">DESVINCULADA</span>}
                        {item.nivel_alerta === 'BLOQUEADO' && <span className="badge badge-bloqueada">BLOQUEADA</span>}
                        {item.nivel_alerta === 'SUSPENDIDA' && <span className="badge badge-suspendida">SUSPENDIDA</span>}
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
    </div>
  );
}
