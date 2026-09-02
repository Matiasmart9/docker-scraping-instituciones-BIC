import sys
import os

# Ensure app is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.institucion import Institucion, EstadoActual, HistorialCambios, SnapshotDiario

def main():
    db = SessionLocal()
    
    old_name = "CASA KILA"
    new_name = "KILA ELECTRODOMESTICOS EAS"
    
    old_inst = db.query(Institucion).filter(Institucion.nombre == old_name).first()
    new_inst = db.query(Institucion).filter(Institucion.nombre == new_name).first()
    
    if not old_inst:
        print(f"No se encontró la institución antigua: {old_name}")
        return
        
    if not new_inst:
        print(f"No se encontró la institución nueva: {new_name}")
        return
        
    print(f"Fusionando {old_inst.nombre} (ID {old_inst.id}) -> {new_inst.nombre} (ID {new_inst.id})")
    
    # Mover historiales
    historiales = db.query(HistorialCambios).filter(HistorialCambios.institucion_id == old_inst.id).all()
    for h in historiales:
        h.institucion_id = new_inst.id
    print(f"Movidos {len(historiales)} registros de historial.")
    
    # Mover snapshots
    snapshots = db.query(SnapshotDiario).filter(SnapshotDiario.institucion_id == old_inst.id).all()
    for s in snapshots:
        s.institucion_id = new_inst.id
    print(f"Movidos {len(snapshots)} snapshots.")
    
    # Unir alias (copiar los del viejo + el nombre del viejo)
    aliases_nuevos = list(new_inst.alias_nombres or [])
    if old_inst.nombre not in aliases_nuevos:
        aliases_nuevos.append(old_inst.nombre)
    if old_inst.alias_nombres:
        for alias in old_inst.alias_nombres:
            if alias not in aliases_nuevos:
                aliases_nuevos.append(alias)
    
    new_inst.alias_nombres = aliases_nuevos
    print(f"Alias asignados a la nueva institución: {new_inst.alias_nombres}")
    
    # Unir telefonos de contacto
    telefonos = list(new_inst.telefonos_contacto or [])
    if old_inst.telefonos_contacto:
        for t in old_inst.telefonos_contacto:
            if t not in telefonos:
                telefonos.append(t)
    new_inst.telefonos_contacto = telefonos
    
    # Eliminar estado actual viejo
    old_estado = db.query(EstadoActual).filter(EstadoActual.institucion_id == old_inst.id).first()
    if old_estado:
        db.delete(old_estado)
        print("Estado actual antiguo eliminado.")
        
    # Eliminar institucion vieja
    db.delete(old_inst)
    print("Institución antigua eliminada.")
    
    db.commit()
    print("Fusión completada con éxito.")

if __name__ == "__main__":
    main()
