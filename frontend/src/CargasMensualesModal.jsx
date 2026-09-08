import React, { useState, useEffect, useMemo } from 'react';
import {
  X, TrendingUp, TrendingDown, Minus, ArrowUpDown, Search, RefreshCw, BarChart3,
  CalendarDays, FileSpreadsheet, Table2, Info
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, Cell, LabelList
} from 'recharts';
import CalendarioCargasModal from './CalendarioCargasModal';
import PanoramaAnualView from './PanoramaAnualView';
import { lockBodyScroll, unlockBodyScroll } from './scrollLock';

const MESES_NOMBRE = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const formatMes = (mesStr) => {
  if (!mesStr) return '';
  const [anio, mes] = mesStr.split('-');
  return `${MESES_NOMBRE[parseInt(mes, 10) - 1]} ${anio}`;
};

const mesAnteriorDe = (mesStr) => {
  const [anio, mes] = mesStr.split('-').map(Number);
  const d = new Date(anio, mes - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const numFmt = (n) => n == null ? '-' : n.toLocaleString('es-PY');

const thStickyStyle = { position: 'sticky', top: 0, zIndex: 2, background: 'var(--sticky-header-bg)', color: 'var(--sticky-header-text)' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-color)',
      borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', boxShadow: '0 10px 25px rgba(0,0,0,0.4)'
    }}>
      <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--text-secondary)' }}>
          {p.name}: <strong>{numFmt(p.value)}</strong>
        </div>
      ))}
    </div>
  );
};

export default function CargasMensualesModal({ isOpen, onClose, token, showToast }) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState(null);
  const [selectedMes, setSelectedMes] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc'); // desc = mayor a menor aporte
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarioInstitucion, setCalendarioInstitucion] = useState(null); // { id, nombre }
  const [vista, setVista] = useState('mensual'); // 'mensual' | 'anual'
  const [descargandoExcel, setDescargandoExcel] = useState(false);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/kpi-cargas/mensual', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setSelectedMes(prev => {
          if (prev && json.meses.includes(prev)) return prev;
          return json.meses.length ? json.meses[json.meses.length - 1] : null;
        });
      } else {
        showToast('Error al cargar el KPI de cargas mensuales', 'error');
      }
    } catch (e) {
      showToast('Error al cargar el KPI de cargas mensuales', 'error');
    } finally {
      setLoading(false);
    }
  };

  const sincronizarYCargar = async () => {
    setSyncing(true);
    try {
      await fetch('/api/v1/kpi-cargas/backfill-historico', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      // Best-effort: si falla la sincronización histórica, igual mostramos lo que haya
    } finally {
      setSyncing(false);
      cargarDatos();
    }
  };

  useEffect(() => {
    if (isOpen) {
      sincronizarYCargar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      return () => unlockBodyScroll();
    }
  }, [isOpen]);

  const handleDescargarExcel = async () => {
    if (!selectedMes) return;
    setDescargandoExcel(true);
    showToast('Generando reporte Excel...', 'info');
    try {
      const res = await fetch(`/api/v1/kpi-cargas/mensual/exportar-excel?mes=${selectedMes}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falló la generación del Excel');

      const rawBlob = await res.blob();
      const excelBlob = new Blob([rawBlob], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(excelBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cierre_Carga_Mensual_${selectedMes}.xlsx`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 500);
      showToast('Excel descargado correctamente', 'success');
    } catch (e) {
      showToast('Error al descargar el Excel', 'error');
    } finally {
      setDescargandoExcel(false);
    }
  };

  const mesAnterior = selectedMes ? mesAnteriorDe(selectedMes) : null;

  const filas = useMemo(() => {
    if (!data || !selectedMes) return [];
    const q = searchQuery.trim().toLowerCase();
    const rows = data.instituciones
      .map(inst => {
        const actualEntry = inst.cierres.find(c => c.mes === selectedMes);
        if (!actualEntry) return null;
        const anteriorEntry = inst.cierres.find(c => c.mes === mesAnterior);
        const valorActual = actualEntry.valor;
        const valorAnterior = anteriorEntry ? anteriorEntry.valor : null;
        const variacionAbs = valorAnterior != null ? valorActual - valorAnterior : null;
        const variacionPct = (variacionAbs != null && valorAnterior) ? (variacionAbs / valorAnterior) * 100 : null;
        return {
          institucion_id: inst.institucion_id,
          nombre: inst.nombre,
          valorActual,
          fechaCierre: actualEntry.fecha_cierre,
          valorAnterior,
          variacionAbs,
          variacionPct
        };
      })
      .filter(Boolean)
      .filter(r => !q || r.nombre.toLowerCase().includes(q));

    rows.sort((a, b) => sortOrder === 'desc' ? b.valorActual - a.valorActual : a.valorActual - b.valorActual);
    return rows;
  }, [data, selectedMes, mesAnterior, searchQuery, sortOrder]);

  const resumen = useMemo(() => {
    if (!filas.length) return null;
    const totalActual = filas.reduce((acc, r) => acc + r.valorActual, 0);
    const conAnterior = filas.filter(r => r.valorAnterior != null);
    const totalAnterior = conAnterior.reduce((acc, r) => acc + r.valorAnterior, 0);
    const variacionTotalAbs = conAnterior.length ? totalActual - (filas.reduce((acc, r) => acc + (r.valorAnterior || 0), 0)) : null;
    const variacionTotalPct = (totalAnterior > 0) ? ((totalActual - totalAnterior) / totalAnterior) * 100 : null;
    const suben = filas.filter(r => r.variacionAbs != null && r.variacionAbs > 0).length;
    const bajan = filas.filter(r => r.variacionAbs != null && r.variacionAbs < 0).length;
    const igual = filas.filter(r => r.variacionAbs === 0).length;
    const top = filas.reduce((max, r) => (!max || r.valorActual > max.valorActual) ? r : max, null);
    const mayorSubida = filas.reduce((max, r) => (r.variacionAbs != null && (!max || r.variacionAbs > max.variacionAbs)) ? r : max, null);
    const mayorCaida = filas.reduce((min, r) => (r.variacionAbs != null && (!min || r.variacionAbs < min.variacionAbs)) ? r : min, null);
    return { totalActual, totalAnterior, variacionTotalPct, suben, bajan, igual, top, mayorSubida, mayorCaida, totalInstituciones: filas.length };
  }, [filas]);

  const trendData = useMemo(() => {
    if (!data) return [];
    return data.totales_mensuales.map(t => ({ mes: formatMes(t.mes), total: t.total, instituciones: t.cantidad_instituciones }));
  }, [data]);

  const chartRanking = useMemo(() => {
    return filas.slice(0, 15).map(r => ({
      nombre: r.nombre.length > 28 ? r.nombre.slice(0, 26) + '…' : r.nombre,
      nombreCompleto: r.nombre,
      valor: r.valorActual,
      subiendo: r.variacionAbs == null ? null : r.variacionAbs >= 0
    }));
  }, [filas]);

  if (!isOpen) return null;

  const esEnCurso = data && selectedMes === data.mes_en_curso;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: '1180px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={24} className="text-orange-500" />
              Cierre de Carga Mensual por Institución
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Cantidad real aportada (Búsquedas Máx. ÷ 2) según la carga de XML de cada institución.
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'flex-start', gap: '5px', maxWidth: '760px' }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span><strong>Obs:</strong> las fechas marcadas corresponden a la Fecha_Informe que contiene el XML procesado por BICSA, no necesariamente al día exacto en que la institución realizó la carga — ambas fechas pueden coincidir o no.</span>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Selector de vista */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <button
            className={`btn btn-sm ${vista === 'mensual' ? 'btn-orange' : 'btn-secondary'}`}
            onClick={() => setVista('mensual')}
          >
            <BarChart3 size={14} /> Cierre Mensual
          </button>
          <button
            className={`btn btn-sm ${vista === 'anual' ? 'btn-orange' : 'btn-secondary'}`}
            onClick={() => setVista('anual')}
          >
            <Table2 size={14} /> Vista Anual
          </button>
        </div>

        {(loading || syncing) && !data ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={28} className="spin" style={{ marginBottom: '10px' }} />
            <div>{syncing ? 'Sincronizando histórico de backups...' : 'Cargando datos...'}</div>
          </div>
        ) : !data || data.meses.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No hay instituciones con carga de XML registrada todavía para generar este KPI.
          </div>
        ) : vista === 'anual' ? (
          <PanoramaAnualView
            data={data}
            token={token}
            showToast={showToast}
            onSelectInstitucion={(inst) => setCalendarioInstitucion(inst)}
          />
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>

            {/* Selector de mes y acciones */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Mes de cierre a visualizar:</label>
                <select
                  className="form-input"
                  style={{ padding: '8px 12px', background: 'var(--bg-card)', color: 'var(--text-primary)', minWidth: '220px' }}
                  value={selectedMes || ''}
                  onChange={(e) => setSelectedMes(e.target.value)}
                >
                  {[...data.meses].reverse().map(m => (
                    <option key={m} value={m}>{formatMes(m)}{m === data.mes_en_curso ? ' (en curso)' : ''}</option>
                  ))}
                </select>
              </div>

              {esEnCurso && (
                <span className="badge badge-suspendida" style={{ marginTop: '18px' }}>MES EN CURSO — cifras parciales</span>
              )}

              <button
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', marginTop: '18px' }}
                onClick={sincronizarYCargar}
                disabled={syncing}
                title="Reprocesar histórico de backups y refrescar datos"
              >
                <RefreshCw size={14} className={syncing ? 'spin' : ''} /> Actualizar
              </button>
            </div>

            {/* Tarjetas resumen */}
            {resumen && (
              <div className="kpi-grid" style={{ marginBottom: '20px' }}>
                <div className="glass-panel kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Total Aportado ({formatMes(selectedMes)})</span>
                  </div>
                  <div className="kpi-value">{numFmt(resumen.totalActual)}</div>
                  {resumen.variacionTotalPct != null ? (
                    <div className="kpi-subtext" style={{ color: resumen.variacionTotalPct >= 0 ? '#34D399' : '#F87171', fontWeight: 600 }}>
                      {resumen.variacionTotalPct >= 0 ? '▲' : '▼'} {Math.abs(resumen.variacionTotalPct).toFixed(2)}% vs {formatMes(mesAnterior)}
                    </div>
                  ) : (
                    <div className="kpi-subtext">Sin datos comparables del mes anterior</div>
                  )}
                </div>

                <div className="glass-panel kpi-card">
                  <div className="kpi-header"><span className="kpi-title">Instituciones con Carga</span></div>
                  <div className="kpi-value text-cyan">{resumen.totalInstituciones}</div>
                  <div className="kpi-subtext">Consideradas en el cierre de {formatMes(selectedMes)}</div>
                </div>

                <div className="glass-panel kpi-card">
                  <div className="kpi-header"><span className="kpi-title">Subieron / Bajaron</span></div>
                  <div className="kpi-value">
                    <span className="text-emerald">{resumen.suben}</span> / <span className="text-rose">{resumen.bajan}</span>
                  </div>
                  <div className="kpi-subtext">{resumen.igual} sin variación respecto al mes anterior</div>
                </div>

                <div className="glass-panel kpi-card">
                  <div className="kpi-header"><span className="kpi-title">Mayor Aportante</span></div>
                  <div className="kpi-value" style={{ fontSize: '1rem', lineHeight: 1.3 }}>{resumen.top?.nombre || '-'}</div>
                </div>
              </div>
            )}

            {/* Gráficos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: '16px', marginBottom: '24px' }}>
              <div className="glass-panel" style={{ padding: '18px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px' }}>
                  Top 15 Instituciones — {formatMes(selectedMes)}
                </h3>
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={chartRanking} layout="vertical" margin={{ left: 10, right: 24, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={numFmt} />
                    <YAxis type="category" dataKey="nombre" width={170} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="valor" name="Cierre" radius={[0, 6, 6, 0]}>
                      {chartRanking.map((entry, idx) => (
                        <Cell key={idx} fill={entry.subiendo === false ? '#F87171' : entry.subiendo === true ? '#34D399' : '#F97316'} />
                      ))}
                      <LabelList dataKey="valor" position="right" formatter={numFmt} style={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-panel" style={{ padding: '18px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px' }}>
                  Tendencia Total Aportado (Todas las Instituciones)
                </h3>
                <ResponsiveContainer width="100%" height={380}>
                  <AreaChart data={trendData} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F97316" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#F97316" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={numFmt} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="total" name="Total Aportado" stroke="#F97316" strokeWidth={2.5} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabla detallada */}
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Detalle por Institución</h3>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div className="search-box">
                    <Search size={14} style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Buscar institución..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    title="Alternar orden de mayor a menor aporte"
                  >
                    <ArrowUpDown size={14} /> {sortOrder === 'desc' ? 'Mayor a menor' : 'Menor a mayor'}
                  </button>
                  <button
                    className="btn btn-sm btn-excel"
                    onClick={handleDescargarExcel}
                    disabled={descargandoExcel || filas.length === 0}
                    title="Descargar este detalle en Excel"
                  >
                    <FileSpreadsheet size={14} /> {descargandoExcel ? 'Generando...' : 'Descargar Excel'}
                  </button>
                </div>
              </div>

              <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={thStickyStyle}>Institución</th>
                      <th style={{ ...thStickyStyle, textAlign: 'center' }}>Cierre {formatMes(selectedMes)}</th>
                      <th style={{ ...thStickyStyle, textAlign: 'center' }}>Fecha de Cierre</th>
                      <th style={{ ...thStickyStyle, textAlign: 'center' }}>Cierre {formatMes(mesAnterior)}</th>
                      <th style={{ ...thStickyStyle, textAlign: 'center' }}>Variación</th>
                      <th style={{ ...thStickyStyle, textAlign: 'center' }}>% Variación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Sin instituciones con carga registrada para este mes.</td></tr>
                    ) : filas.map(r => (
                      <tr key={r.institucion_id}>
                        <td>
                          <button
                            onClick={() => setCalendarioInstitucion({ id: r.institucion_id, nombre: r.nombre })}
                            title="Ver calendario de cargas de esta institución"
                            style={{
                              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                              fontWeight: 600, color: 'var(--text-primary)', textAlign: 'left',
                              display: 'inline-flex', alignItems: 'center', gap: '6px'
                            }}
                          >
                            <CalendarDays size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px' }}>{r.nombre}</span>
                          </button>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{numFmt(r.valorActual)}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.fechaCierre}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{numFmt(r.valorAnterior)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {r.variacionAbs == null ? (
                            <span style={{ color: 'var(--text-muted)' }}>Sin datos</span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: r.variacionAbs > 0 ? '#34D399' : r.variacionAbs < 0 ? '#F87171' : 'var(--text-muted)', fontWeight: 600 }}>
                              {r.variacionAbs > 0 ? <TrendingUp size={14} /> : r.variacionAbs < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                              {r.variacionAbs > 0 ? '+' : ''}{numFmt(r.variacionAbs)}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: r.variacionPct == null ? 'var(--text-muted)' : r.variacionPct > 0 ? '#34D399' : r.variacionPct < 0 ? '#F87171' : 'var(--text-muted)' }}>
                          {r.variacionPct == null ? '-' : `${r.variacionPct > 0 ? '+' : ''}${r.variacionPct.toFixed(2)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <CalendarioCargasModal
        isOpen={!!calendarioInstitucion}
        onClose={() => setCalendarioInstitucion(null)}
        token={token}
        showToast={showToast}
        institucionId={calendarioInstitucion?.id}
        nombreInstitucion={calendarioInstitucion?.nombre}
      />
    </div>
  );
}
