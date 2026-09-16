import React, { useState, useEffect, useMemo } from 'react';
import { X, UserMinus, Search, RefreshCw, FileSpreadsheet, Info } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList
} from 'recharts';
import { lockBodyScroll, unlockBodyScroll } from './scrollLock';

const MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const formatMesCorto = (mesStr) => {
  const [anio, mes] = mesStr.split('-');
  return `${MESES_ABREV[parseInt(mes, 10) - 1]} ${anio}`;
};

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
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const thStickyStyle = { position: 'sticky', top: 0, zIndex: 2, background: 'var(--sticky-header-bg)', color: 'var(--sticky-header-text)' };

export default function DesvinculadasMensualesModal({ isOpen, onClose, token, showToast }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [descargandoExcel, setDescargandoExcel] = useState(false);

  const cargarDatos = async (anio) => {
    setLoading(true);
    try {
      const url = anio ? `/api/v1/kpi-desvinculadas/anual?anio=${anio}` : '/api/v1/kpi-desvinculadas/anual';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setSelectedYear(json.anio);
      } else {
        showToast('Error al cargar el reporte de desvinculadas', 'error');
      }
    } catch (e) {
      showToast('Error al cargar el reporte de desvinculadas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      cargarDatos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      return () => unlockBodyScroll();
    }
  }, [isOpen]);

  const handleChangeYear = (anio) => {
    setSelectedYear(anio);
    cargarDatos(anio);
  };

  const handleDescargarExcel = async () => {
    if (!selectedYear) return;
    setDescargandoExcel(true);
    showToast('Generando reporte Excel...', 'info');
    try {
      const res = await fetch(`/api/v1/kpi-desvinculadas/exportar-excel?anio=${selectedYear}`, {
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
      link.setAttribute('download', `Desvinculadas_${selectedYear}.xlsx`);
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

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.meses.map(m => ({ mes: m.nombre_mes.slice(0, 3), cantidad: m.cantidad }));
  }, [data]);

  const filas = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.detalle.filter(f => !q || f.nombre.toLowerCase().includes(q));
  }, [data, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: '1180px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserMinus size={24} className="text-orange-500" />
              Instituciones Desvinculadas por Mes
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Instituciones que pasaron a estado "Desvinculada" (desde cualquier estado anterior), agrupadas por mes.
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'flex-start', gap: '5px', maxWidth: '760px' }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span><strong>Obs:</strong> "Última Carga XML" muestra la fecha vigente al momento de consultar; si la institución nunca llegó a registrar una carga real, se indica "Sin Datos".</span>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {loading && !data ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={28} className="spin" style={{ marginBottom: '10px' }} />
            <div>Cargando datos...</div>
          </div>
        ) : !data ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No se pudo cargar el reporte.
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>

            {/* Selector de año y acciones */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Año:</label>
                <select
                  className="form-input"
                  style={{ padding: '8px 12px', background: 'var(--bg-card)', color: 'var(--text-primary)', minWidth: '140px' }}
                  value={selectedYear || ''}
                  onChange={(e) => handleChangeYear(e.target.value)}
                >
                  {data.anios_disponibles.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '18px' }}>
                <strong>{data.total_anio}</strong> institución(es) desvinculada(s) en {selectedYear}
              </div>

              <button
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', marginTop: '18px' }}
                onClick={() => cargarDatos(selectedYear)}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar
              </button>
            </div>

            {/* Gráfico de 12 meses */}
            <div className="glass-panel" style={{ padding: '18px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px' }}>
                Desvinculaciones por Mes — {selectedYear}
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ left: 0, right: 10, top: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis allowDecimals={false} width={40} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="cantidad" name="Desvinculadas" fill="#F97316" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="cantidad" position="top" style={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla detallada */}
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Detalle de Instituciones Desvinculadas</h3>
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
                    className="btn btn-sm btn-excel"
                    onClick={handleDescargarExcel}
                    disabled={descargandoExcel || data.total_anio === 0}
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
                      <th style={{ ...thStickyStyle, textAlign: 'center' }}>Mes</th>
                      <th style={{ ...thStickyStyle, textAlign: 'center' }}>Fecha de Desvinculación</th>
                      <th style={{ ...thStickyStyle, textAlign: 'center' }}>Estado Anterior</th>
                      <th style={{ ...thStickyStyle, textAlign: 'center' }}>Última Carga XML</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.length === 0 ? (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Sin instituciones desvinculadas registradas para este año.</td></tr>
                    ) : filas.map((f, idx) => (
                      <tr key={`${f.institucion_id}-${f.fecha_desvinculacion}-${idx}`}>
                        <td style={{ fontWeight: 600 }}>{f.nombre}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{formatMesCorto(f.fecha_desvinculacion.slice(0, 7))}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(f.fecha_desvinculacion + 'T00:00:00').toLocaleDateString('es-PY')}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{f.estado_anterior}</td>
                        <td style={{ textAlign: 'center' }}>
                          {f.ultima_carga_xml ? (
                            <span style={{ fontFamily: 'monospace' }}>{f.ultima_carga_xml}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin Datos</span>
                          )}
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
    </div>
  );
}
