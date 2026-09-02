import React, { useState, useEffect } from 'react';
import { X, Search, Check, Link as LinkIcon, History, AlertTriangle } from 'lucide-react';

export default function UnificacionModal({ isOpen, onClose, token, showToast, institucionesActivas, fetchDashboardData }) {
  const [activeTab, setActiveTab] = useState('pendientes'); // 'pendientes' | 'historial'
  const [desaparecidas, setDesaparecidas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [selectedAntigua, setSelectedAntigua] = useState(null);
  const [selectedNueva, setSelectedNueva] = useState(null);
  const [searchNueva, setSearchNueva] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'pendientes') fetchDesaparecidas();
      if (activeTab === 'historial') fetchHistorial();
    }
  }, [isOpen, activeTab]);

  const fetchDesaparecidas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/instituciones/desaparecidas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDesaparecidas(await res.json());
      }
    } catch (e) {
      showToast('Error al cargar instituciones desaparecidas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorial = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/instituciones/unificaciones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setHistorial(await res.json());
      }
    } catch (e) {
      showToast('Error al cargar historial de unificaciones', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnificar = async () => {
    if (!selectedAntigua || !selectedNueva) return;
    try {
      const payload = {
        id_antigua: selectedAntigua.id,
        id_nueva: selectedNueva.institucion_id // de institucionesActivas (EstadoActual)
      };
      const res = await fetch('/api/v1/instituciones/unificar', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al unificar');
      }
      showToast(`Unificación exitosa`, 'success');
      setShowConfirm(false);
      setSelectedAntigua(null);
      setSelectedNueva(null);
      setSearchNueva('');
      fetchDesaparecidas();
      fetchDashboardData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  if (!isOpen) return null;

  // Autocompletar sugerencias simples (coincidencia de palabras)
  const getSuggestions = (antiguaName) => {
    if (!antiguaName) return [];
    const words = antiguaName.toLowerCase().split(' ').filter(w => w.length > 3 && w !== 'casa' && w !== 'eas' && w !== 's.a' && w !== 's.a.');
    if (words.length === 0) return [];
    
    return institucionesActivas.filter(inst => {
      const newName = inst.nombre_institucion.toLowerCase();
      return words.some(w => newName.includes(w));
    });
  };

  const filteredNuevas = institucionesActivas.filter(i => 
    i.nombre_institucion.toLowerCase().includes(searchNueva.toLowerCase())
  );

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LinkIcon size={24} className="text-indigo-500" />
            Resolución de Nombres
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <button 
            className={`btn ${activeTab === 'pendientes' ? 'btn-orange' : 'btn-secondary'}`}
            onClick={() => setActiveTab('pendientes')}
          >
            <AlertTriangle size={16} /> Pendientes de Fusión
          </button>
          <button 
            className={`btn ${activeTab === 'historial' ? 'btn-blue' : 'btn-secondary'}`}
            onClick={() => setActiveTab('historial')}
          >
            <History size={16} /> Historial
          </button>
        </div>

        {/* Contenido Pendientes */}
        {activeTab === 'pendientes' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!selectedAntigua ? (
              <>
                <p style={{ marginBottom: '15px', color: 'var(--text-secondary)' }}>
                  Seleccione una institución que ya no figure en el portal para fusionarla con su nuevo nombre.
                </p>
                {loading ? <p>Cargando...</p> : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Institución Antigua (Desaparecida)</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {desaparecidas.map(d => (
                          <tr key={d.id}>
                            <td style={{ fontWeight: 500 }}>{d.nombre}</td>
                            <td>
                              <button className="btn btn-sm btn-blue" onClick={() => setSelectedAntigua(d)}>
                                Resolver Fusión
                              </button>
                            </td>
                          </tr>
                        ))}
                        {desaparecidas.length === 0 && (
                          <tr><td colSpan="2" style={{ textAlign: 'center', padding: '20px' }}>No hay instituciones desaparecidas.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              // Vista de Fusión
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => { setSelectedAntigua(null); setSelectedNueva(null); }} style={{ marginBottom: '15px' }}>
                  Volver atrás
                </button>
                
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, padding: '15px', background: 'rgba(239, 68, 68, 0.1)', border: '1px dashed #EF4444', borderRadius: '8px' }}>
                    <h4 style={{ color: '#EF4444', marginBottom: '10px' }}>Institución Antigua</h4>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{selectedAntigua.nombre}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
                    <LinkIcon size={32} className="text-indigo-500" />
                  </div>

                  <div style={{ flex: 1, padding: '15px', background: 'rgba(16, 185, 129, 0.1)', border: '1px dashed #10B981', borderRadius: '8px' }}>
                    <h4 style={{ color: '#10B981', marginBottom: '10px' }}>Seleccionar Nuevo Nombre</h4>
                    
                    {!selectedNueva ? (
                      <>
                        <div className="search-bar" style={{ marginBottom: '10px' }}>
                          <Search size={16} />
                          <input 
                            type="text" 
                            placeholder="Buscar institución activa..." 
                            value={searchNueva}
                            onChange={(e) => setSearchNueva(e.target.value)}
                          />
                        </div>
                        
                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                          {searchNueva === '' && getSuggestions(selectedAntigua.nombre).length > 0 && (
                            <div style={{ padding: '8px', background: 'var(--glass-bg)', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                              Sugerencias
                            </div>
                          )}
                          
                          {(searchNueva === '' ? getSuggestions(selectedAntigua.nombre) : filteredNuevas).map(inst => (
                            <div 
                              key={inst.institucion_id}
                              style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                              onClick={() => setSelectedNueva(inst)}
                            >
                              {inst.nombre_institucion}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '15px' }}>{selectedNueva.nombre_institucion}</div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => setSelectedNueva(null)}>Cambiar</button>
                          <button className="btn btn-sm btn-orange" onClick={() => setShowConfirm(true)}>
                            Unificar Ahora
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contenido Historial */}
        {activeTab === 'historial' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? <p>Cargando...</p> : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Antigua</th>
                      <th>Nueva</th>
                      <th>Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map(h => (
                      <tr key={h.id}>
                        <td>{new Date(h.fecha_unificacion).toLocaleString()}</td>
                        <td style={{ color: '#EF4444', textDecoration: 'line-through' }}>{h.institucion_antigua_nombre}</td>
                        <td style={{ color: '#10B981', fontWeight: 500 }}>{h.institucion_nueva_nombre}</td>
                        <td style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>{h.usuario_email}</td>
                      </tr>
                    ))}
                    {historial.length === 0 && (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No hay unificaciones registradas.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Confirmación */}
      {showConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1100, background: 'rgba(0,0,0,0.8)' }}>
          <div className="glass-panel" style={{ width: '400px', padding: '25px', textAlign: 'center' }}>
            <AlertTriangle size={48} className="text-orange-500" style={{ margin: '0 auto 15px' }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Confirmar Unificación</h3>
            <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
              ¿Estás seguro de unificar <strong>{selectedAntigua.nombre}</strong> con <strong>{selectedNueva.nombre_institucion}</strong>?<br/><br/>
              Esta acción traspasará todo el historial, snapshots y números de contacto a la nueva institución y eliminará la antigua. <strong>Esta acción no se puede deshacer.</strong>
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancelar</button>
              <button className="btn btn-orange" onClick={handleUnificar}>Confirmar Fusión</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
