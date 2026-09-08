import React, { useState, useEffect, useMemo } from 'react';
import { X, CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { lockBodyScroll, unlockBodyScroll } from './scrollLock';

const MESES_NOMBRE = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const numFmt = (n) => n == null ? '-' : n.toLocaleString('es-PY');

const construirGrillaMes = (anio, mesIndex) => {
  const primerDia = new Date(anio, mesIndex, 1);
  const diasEnMes = new Date(anio, mesIndex + 1, 0).getDate();
  const offset = (primerDia.getDay() + 6) % 7; // Lunes = 0

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);
  while (celdas.length % 7 !== 0) celdas.push(null);
  return celdas;
};

export default function CalendarioCargasModal({ isOpen, onClose, token, showToast, institucionId, nombreInstitucion }) {
  const [loading, setLoading] = useState(false);
  const [eventos, setEventos] = useState([]);
  const [mesActivo, setMesActivo] = useState(null); // { anio, mesIndex }

  const cargarHistorial = async () => {
    if (!institucionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/kpi-cargas/institucion/${institucionId}/historial`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setEventos(json.eventos || []);
        if (json.eventos && json.eventos.length > 0) {
          const ultima = json.eventos[json.eventos.length - 1].fecha;
          const [anio, mes] = ultima.split('-').map(Number);
          setMesActivo({ anio, mesIndex: mes - 1 });
        } else {
          const hoy = new Date();
          setMesActivo({ anio: hoy.getFullYear(), mesIndex: hoy.getMonth() });
        }
      } else {
        showToast('Error al cargar el historial de cargas', 'error');
      }
    } catch (e) {
      showToast('Error al cargar el historial de cargas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && institucionId) {
      cargarHistorial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, institucionId]);

  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      return () => unlockBodyScroll();
    }
  }, [isOpen]);

  const eventosPorFecha = useMemo(() => {
    const mapa = {};
    eventos.forEach(e => { mapa[e.fecha] = e.valor; });
    return mapa;
  }, [eventos]);

  const celdas = useMemo(() => {
    if (!mesActivo) return [];
    return construirGrillaMes(mesActivo.anio, mesActivo.mesIndex);
  }, [mesActivo]);

  const cambiarMes = (delta) => {
    setMesActivo(prev => {
      const d = new Date(prev.anio, prev.mesIndex + delta, 1);
      return { anio: d.getFullYear(), mesIndex: d.getMonth() };
    });
  };

  if (!isOpen) return null;

  const claveMesActivo = mesActivo ? `${mesActivo.anio}-${String(mesActivo.mesIndex + 1).padStart(2, '0')}` : null;
  const eventosMesActivo = eventos.filter(e => e.fecha.startsWith(claveMesActivo));
  const cargasMesActivo = eventosMesActivo.length;
  const ultimoValorMesActivo = cargasMesActivo > 0 ? eventosMesActivo[eventosMesActivo.length - 1].valor : null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: '520px', width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={22} className="text-orange-500" />
            {nombreInstitucion || 'Historial de Cargas'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {loading || !mesActivo ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
            <div>Cargando historial...</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <button className="btn btn-sm btn-secondary" onClick={() => cambiarMes(-1)}>
                <ChevronLeft size={16} />
              </button>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                {MESES_NOMBRE[mesActivo.mesIndex]} {mesActivo.anio}
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => cambiarMes(1)}>
                <ChevronRight size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span><strong style={{ color: 'var(--text-primary)' }}>{cargasMesActivo}</strong> carga(s) este mes</span>
              {ultimoValorMesActivo != null && (
                <span>Último valor registrado: <strong style={{ color: 'var(--text-primary)' }}>{numFmt(ultimoValorMesActivo)}</strong></span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
              {DIAS_SEMANA.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {celdas.map((dia, idx) => {
                if (dia === null) return <div key={idx} />;
                const fechaStr = `${mesActivo.anio}-${String(mesActivo.mesIndex + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                const valor = eventosPorFecha[fechaStr];
                const tieneCarga = valor !== undefined;
                return (
                  <div
                    key={idx}
                    title={tieneCarga ? `Carga registrada: ${numFmt(valor)}` : 'Sin carga registrada'}
                    style={{
                      minHeight: '54px',
                      borderRadius: '8px',
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      background: tieneCarga ? 'rgba(249, 115, 22, 0.18)' : 'rgba(255,255,255,0.03)',
                      border: tieneCarga ? '1px solid rgba(249, 115, 22, 0.5)' : '1px solid var(--border-color)',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: tieneCarga ? '#F97316' : 'var(--text-muted)' }}>{dia}</span>
                    {tieneCarga && (
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px', textAlign: 'center', lineHeight: 1.1 }}>
                        {valor >= 1000 ? `${(valor / 1000).toFixed(0)}K` : valor}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '16px', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(249, 115, 22, 0.18)', border: '1px solid rgba(249, 115, 22, 0.5)', display: 'inline-block' }} />
              Día con carga real de XML registrada (valor ya dividido entre 2)
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              <strong>Obs:</strong> las fechas marcadas corresponden a la Fecha_Informe que contiene el XML procesado por BICSA, no necesariamente al día exacto en que la institución realizó la carga.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
