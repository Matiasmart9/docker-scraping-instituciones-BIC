import React, { useState, useEffect, useMemo } from 'react';
import { X, Settings, RefreshCw, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { lockBodyScroll, unlockBodyScroll } from './scrollLock';

const DIAS = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
];

export default function ConfiguracionModal({ isOpen, onClose, token, showToast }) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [dias, setDias] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargarConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/configuracion/scraper', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setConfig(json);
        setDias(Object.fromEntries(DIAS.map(d => [d.key, !!json[d.key]])));
      } else {
        showToast('Error al cargar la configuración', 'error');
      }
    } catch (e) {
      showToast('Error al cargar la configuración', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) cargarConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      return () => unlockBodyScroll();
    }
  }, [isOpen]);

  const toggleDia = (key) => {
    setDias(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activo = useMemo(() => dias && Object.values(dias).some(Boolean), [dias]);
  const cantidadDias = useMemo(() => dias ? Object.values(dias).filter(Boolean).length : 0, [dias]);

  const hayCambios = useMemo(() => {
    if (!dias || !config) return false;
    return DIAS.some(d => !!dias[d.key] !== !!config[d.key]);
  }, [dias, config]);

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch('/api/v1/configuracion/scraper', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(dias)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al guardar la configuración');
      }
      const json = await res.json();
      setConfig(json);
      setDias(Object.fromEntries(DIAS.map(d => [d.key, !!json[d.key]])));
      setShowConfirm(false);
      showToast('Configuración actualizada correctamente', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: '620px', width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={22} className="text-orange-500" />
              Configuración del Scraping
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Elegí qué días de la semana corre la sincronización intradía (16hs).
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {loading || !dias ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={26} className="spin" style={{ marginBottom: '10px' }} />
            <div>Cargando configuración...</div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '5px', marginBottom: '16px' }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>
                La corrida principal de las 07hs (la que alimenta los KPI de Cierre de Carga Mensual) sigue
                corriendo todos los días sin excepción. Esto solo controla la corrida liviana de las 16hs,
                pensada para detectar cambios durante el día.
              </span>
            </p>

            <div
              className="alert-banner"
              style={{
                marginBottom: '18px',
                background: activo ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${activo ? 'rgba(52, 211, 153, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              {activo ? <CheckCircle2 size={20} color="#34D399" /> : <AlertTriangle size={20} color="#EF4444" />}
              <div>
                <div style={{ fontWeight: 700, color: activo ? '#34D399' : '#EF4444' }}>
                  {activo ? `Proceso activo — corre ${cantidadDias} de 7 días` : 'Proceso detenido — no hay ningún día seleccionado'}
                </div>
                {config?.actualizado_el && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Último cambio: {new Date(config.actualizado_el).toLocaleString('es-PY')}
                    {config.actualizado_por ? ` — ${config.actualizado_por}` : ''}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px', marginBottom: '22px' }}>
              {DIAS.map(d => (
                <button
                  key={d.key}
                  onClick={() => toggleDia(d.key)}
                  className={`btn btn-sm ${dias[d.key] ? 'btn-orange' : 'btn-secondary'}`}
                  style={{ justifyContent: 'center' }}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-sm btn-orange"
                onClick={() => setShowConfirm(true)}
                disabled={!hayCambios}
              >
                Guardar Cambios
              </button>
            </div>
          </>
        )}
      </div>

      {showConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => !guardando && setShowConfirm(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            {activo ? <CheckCircle2 size={40} color="#34D399" /> : <AlertTriangle size={40} color="#EF4444" />}
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '14px', marginBottom: '8px' }}>Confirmar Cambios</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.85rem' }}>
              {activo
                ? <>La sincronización de las 16hs va a correr <strong>{cantidadDias} de 7 días</strong> a la semana. ¿Aplicar estos cambios?</>
                : <>No queda ningún día seleccionado: la sincronización de las 16hs va a quedar <strong>detenida</strong> hasta que actives al menos un día. ¿Confirmás?</>
              }
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)} disabled={guardando}>Cancelar</button>
              <button className="btn btn-orange" onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Aplicando...' : 'Sí, Aplicar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
