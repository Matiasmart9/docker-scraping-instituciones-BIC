import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, RefreshCw, Check, Clock } from 'lucide-react';

const MESES_NOMBRE = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const formatMes = (mesStr) => {
  if (!mesStr) return '';
  const [anio, mes] = mesStr.split('-');
  return `${MESES_NOMBRE[parseInt(mes, 10) - 1]} ${anio}`;
};

const numFmt = (n) => n == null ? '-' : n.toLocaleString('es-PY');

export default function LimiteConsultasView({ token, showToast, onDataChanged }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [inputs, setInputs] = useState({}); // "institucionId|mes" -> valor en edición
  const [guardando, setGuardando] = useState({}); // "institucionId|mes" -> bool

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/kpi-cargas/limite-consultas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setData(await res.json());
      } else {
        showToast('Error al cargar instituciones con límite de consultas', 'error');
      }
    } catch (e) {
      showToast('Error al cargar instituciones con límite de consultas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const handleGuardar = async (institucionId, mes) => {
    const clave = `${institucionId}|${mes}`;
    const valorStr = inputs[clave];
    if (valorStr === undefined || valorStr === '') {
      showToast('Ingresá un valor antes de guardar', 'error');
      return;
    }
    const valor = parseInt(valorStr, 10);
    if (isNaN(valor) || valor < 0) {
      showToast('El valor debe ser un número mayor o igual a 0', 'error');
      return;
    }

    setGuardando(prev => ({ ...prev, [clave]: true }));
    try {
      const res = await fetch('/api/v1/kpi-cargas/limite-consultas/cargar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ institucion_id: institucionId, mes, valor })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al guardar');
      }
      showToast(`Cierre de ${formatMes(mes)} guardado correctamente`, 'success');
      setInputs(prev => {
        const next = { ...prev };
        delete next[clave];
        return next;
      });
      await cargarDatos();
      if (onDataChanged) onDataChanged();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setGuardando(prev => ({ ...prev, [clave]: false }));
    }
  };

  const totalPendientes = data?.total_pendientes ?? 0;

  if (loading && !data) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RefreshCw size={28} className="spin" style={{ marginBottom: '10px' }} />
        <div>Cargando...</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
      <div className="alert-banner" style={{ marginBottom: '18px', alignItems: 'flex-start' }}>
        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>Instituciones en "Activa (límite de consultas)"</div>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
            En este estado, "Búsquedas Máx." es un <strong>límite de consultas asignado a mano</strong> por BICSA
            (a veces 0 para bloquear el servicio por falta de pago u otro motivo, a veces ajustado hacia arriba o
            abajo) y <strong>no refleja la carga real</strong> de la institución. Por eso su cierre mensual se
            carga manualmente acá, con el valor final tal cual — <strong>sin dividir entre 2</strong>.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <strong>{data?.instituciones?.length ?? 0}</strong> institución(es) en este estado —{' '}
          {totalPendientes > 0 ? (
            <span style={{ color: '#F87171', fontWeight: 600 }}>{totalPendientes} cierre(s) mensual(es) pendiente(s) de cargar</span>
          ) : (
            <span style={{ color: '#34D399', fontWeight: 600 }}>todos los cierres están al día</span>
          )}
        </div>
        <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }} onClick={cargarDatos} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar
        </button>
      </div>

      {(!data || data.instituciones.length === 0) ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No hay instituciones en estado "Activa (límite de consultas)" actualmente.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {data.instituciones.map(inst => (
            <div key={inst.institucion_id} className="glass-panel" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{inst.nombre}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Valor actual en el sistema (límite asignado): <strong>{numFmt(inst.valor_sistema_actual)}</strong>
                  </div>
                </div>
                {inst.meses_pendientes.length === 0 ? (
                  <span className="badge badge-activa"><Check size={12} /> Al día</span>
                ) : (
                  <span className="badge badge-suspendida"><Clock size={12} /> {inst.meses_pendientes.length} pendiente(s)</span>
                )}
              </div>

              {inst.cierres_cargados.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: inst.meses_pendientes.length > 0 ? '12px' : 0 }}>
                  {inst.cierres_cargados.map(c => (
                    <div key={c.mes} style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '8px', padding: '6px 10px', fontSize: '0.78rem' }}>
                      <strong>{formatMes(c.mes)}:</strong> {numFmt(c.valor)}
                      <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({c.fecha_carga})</span>
                    </div>
                  ))}
                </div>
              )}

              {inst.meses_pendientes.map(mes => {
                const clave = `${inst.institucion_id}|${mes}`;
                return (
                  <div key={mes} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, minWidth: '140px' }}>Cierre {formatMes(mes)}:</span>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ maxWidth: '160px', padding: '6px 10px' }}
                      placeholder="Cantidad real"
                      value={inputs[clave] ?? ''}
                      onChange={(e) => setInputs(prev => ({ ...prev, [clave]: e.target.value }))}
                    />
                    <button
                      className="btn btn-sm btn-orange"
                      onClick={() => handleGuardar(inst.institucion_id, mes)}
                      disabled={guardando[clave]}
                    >
                      {guardando[clave] ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
