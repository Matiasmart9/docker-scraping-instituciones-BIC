import React, { useState, useMemo } from 'react';
import { Search, CalendarDays, FileSpreadsheet } from 'lucide-react';

const MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const numFmt = (n) => n == null ? '-' : n.toLocaleString('es-PY');
const formatMesCorto = (mesStr) => {
  const [anio, mes] = mesStr.split('-');
  return `${MESES_ABREV[parseInt(mes, 10) - 1]} ${anio}`;
};

const thBaseStyle = { position: 'sticky', top: 0, zIndex: 2, background: 'var(--sticky-header-bg)', color: 'var(--sticky-header-text)' };
const thCornerStyle = { ...thBaseStyle, left: 0, zIndex: 3, minWidth: '220px' };
const tdStickyStyle = { position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-card)' };

export default function PanoramaAnualView({ data, token, showToast, onSelectInstitucion }) {
  const aniosDisponibles = useMemo(() => {
    const set = new Set(data.meses.map(m => m.split('-')[0]));
    return Array.from(set).sort();
  }, [data.meses]);

  const [selectedYear, setSelectedYear] = useState(aniosDisponibles[aniosDisponibles.length - 1]);
  const [searchQuery, setSearchQuery] = useState('');
  const [descargandoExcel, setDescargandoExcel] = useState(false);

  const anioEnCurso = data.mes_en_curso.split('-')[0];

  const totalAnioInfo = useMemo(() => {
    const mesesDelAnio = data.totales_mensuales.filter(t => t.mes.startsWith(`${selectedYear}-`));
    if (mesesDelAnio.length === 0) return null;
    const ultimo = mesesDelAnio[mesesDelAnio.length - 1];
    const cerrado = selectedYear < anioEnCurso || ultimo.mes.endsWith('-12');
    return { ...ultimo, cerrado };
  }, [data.totales_mensuales, selectedYear, anioEnCurso]);

  const filas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.instituciones
      .filter(inst => !q || inst.nombre.toLowerCase().includes(q))
      .map(inst => {
        const porMes = {};
        inst.cierres.forEach(c => { porMes[c.mes] = c.valor; });
        const valores = MESES_ABREV.map((_, idx) => {
          const claveMes = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
          const claveMesAnterior = idx === 0
            ? `${parseInt(selectedYear, 10) - 1}-12`
            : `${selectedYear}-${String(idx).padStart(2, '0')}`;
          const valor = porMes[claveMes];
          const valorAnterior = porMes[claveMesAnterior];
          let tendencia = null;
          if (valor != null && valorAnterior != null) {
            tendencia = valor > valorAnterior ? 'sube' : valor < valorAnterior ? 'baja' : 'igual';
          }
          return { valor: valor ?? null, tendencia };
        });
        const tieneAlgunDato = valores.some(v => v.valor != null);
        return { institucion_id: inst.institucion_id, nombre: inst.nombre, valores, tieneAlgunDato, limiteConsultas: !!inst.limite_consultas };
      })
      .filter(f => f.tieneAlgunDato)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [data.instituciones, selectedYear, searchQuery]);

  const handleDescargarExcel = async () => {
    setDescargandoExcel(true);
    showToast('Generando reporte Excel...', 'info');
    try {
      const res = await fetch(`/api/v1/kpi-cargas/anual/exportar-excel?anio=${selectedYear}`, {
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
      link.setAttribute('download', `Vista_Anual_Cargas_${selectedYear}.xlsx`);
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

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Año:</label>
          <select
            className="form-input"
            style={{ padding: '8px 12px', background: 'var(--bg-card)', color: 'var(--text-primary)', minWidth: '140px' }}
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="search-box" style={{ marginTop: '18px' }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar institución..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '18px' }}>
          <strong>{filas.length}</strong> institución(es) con carga en {selectedYear}
        </div>

        <button
          className="btn btn-sm btn-excel"
          style={{ marginLeft: 'auto', marginTop: '18px' }}
          onClick={handleDescargarExcel}
          disabled={descargandoExcel || filas.length === 0}
          title="Descargar esta vista anual en Excel"
        >
          <FileSpreadsheet size={14} /> {descargandoExcel ? 'Generando...' : 'Descargar Excel'}
        </button>
      </div>

      {totalAnioInfo && (
        <div className="glass-panel kpi-card" style={{ marginBottom: '16px', maxWidth: '420px' }}>
          <div className="kpi-header">
            <span className="kpi-title">Total de Personas — Cierre {selectedYear}</span>
          </div>
          <div className="kpi-value">{numFmt(totalAnioInfo.total)}</div>
          <div className="kpi-subtext" style={{ color: totalAnioInfo.cerrado ? '#34D399' : undefined, fontWeight: totalAnioInfo.cerrado ? 600 : undefined }}>
            {totalAnioInfo.cerrado
              ? `Cierre definitivo del año (${formatMesCorto(totalAnioInfo.mes)}) — ${totalAnioInfo.cantidad_instituciones} instituciones`
              : `Parcial al ${formatMesCorto(totalAnioInfo.mes)} (año en curso) — ${totalAnioInfo.cantidad_instituciones} instituciones`}
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '4px' }}>
          Vista Anual de Cierres por Institución — {selectedYear}
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Cierre real aportado (Búsquedas Máx. ÷ 2) por mes calendario. Verde/rojo indican suba o baja respecto al mes anterior.
        </p>

        <div className="table-responsive" style={{ maxHeight: '520px', overflow: 'auto' }}>
          <table className="data-table" style={{ minWidth: '1000px' }}>
            <thead>
              <tr>
                <th style={thCornerStyle}>Institución</th>
                {MESES_ABREV.map(m => (
                  <th key={m} style={{ ...thBaseStyle, textAlign: 'center', minWidth: '78px' }}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr><td colSpan={13} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Sin instituciones con carga registrada en {selectedYear}.</td></tr>
              ) : filas.map(f => (
                <tr key={f.institucion_id}>
                  <td style={tdStickyStyle}>
                    <button
                      onClick={() => onSelectInstitucion({ id: f.institucion_id, nombre: f.nombre })}
                      title="Ver calendario de cargas de esta institución"
                      style={{
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        fontWeight: 600, color: 'var(--text-primary)', textAlign: 'left',
                        display: 'inline-flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      <CalendarDays size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px' }}>{f.nombre}</span>
                    </button>
                    {f.limiteConsultas && (
                      <span
                        title="Institución en 'Activa (límite de consultas)': valor cargado manualmente"
                        style={{ marginLeft: '6px', fontSize: '0.6rem', fontWeight: 700, color: '#F59E0B', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '5px', padding: '1px 4px' }}
                      >
                        M
                      </span>
                    )}
                  </td>
                  {f.valores.map((v, idx) => (
                    <td
                      key={idx}
                      style={{
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        color: v.valor == null ? 'var(--text-muted)' : v.tendencia === 'sube' ? '#34D399' : v.tendencia === 'baja' ? '#F87171' : 'var(--text-primary)'
                      }}
                    >
                      {numFmt(v.valor)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
