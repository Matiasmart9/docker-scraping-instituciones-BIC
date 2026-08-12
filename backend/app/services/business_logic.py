from datetime import datetime, timedelta
from typing import Tuple

def parse_fecha_bicsa(fecha_str: str) -> datetime | None:
    """
    Convierte cadenas de fecha provenientes de BICSA a un objeto datetime.
    Formatos comunes: 'YYYY-MM-DD HH:MM:SS', 'DD/MM/YYYY HH:MM:SS', 'YYYY-MM-DDTHH:MM:SS'.
    """
    if not fecha_str or str(fecha_str).strip().upper() in ["N/A", "N.A", "NONE", "NULL", ""]:
        return None

    fecha_clean = str(fecha_str).strip()
    
    formatos = [
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d/%m/%Y"
    ]

    for fmt in formatos:
        try:
            return datetime.strptime(fecha_clean, fmt)
        except ValueError:
            continue
            
    return None

def calcular_horas_habiles(fecha_inicio: datetime, fecha_fin: datetime) -> float:
    """
    Calcula la cantidad de horas hábiles (Lunes a Viernes) transcurridas entre fecha_inicio y fecha_fin.
    Sábados (weekday 5) y Domingos (weekday 6) son excluidos del cómputo.
    """
    if fecha_inicio >= fecha_fin:
        return 0.0

    total_segundos_habiles = 0
    curr = fecha_inicio

    # Iterar día a día
    while curr < fecha_fin:
        siguiente_dia = (curr + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        fin_tramo = min(fecha_fin, siguiente_dia)

        # 0 = Lunes, 4 = Viernes, 5 = Sábado, 6 = Domingo
        if curr.weekday() < 5:
            delta = (fin_tramo - curr).total_seconds()
            total_segundos_habiles += max(0, delta)

        curr = siguiente_dia

    return round(total_segundos_habiles / 3600.0, 2)

def evaluar_nivel_alerta(estado: str, fecha_ultima_carga_str: str) -> Tuple[float, float, str]:
    """
    Calcula horas hábiles transcurridas, restantes (sobre límite 72hs) y clasifica el nivel de alerta.
    Retorna: (horas_transcurridas, horas_restantes, nivel_alerta)
    Niveles de alerta:
      - DESVINCULADA: Institución con contrato finalizado (excluida de alertas).
      - BLOQUEADO: Institución bloqueada por BICSA (excluida de alertas preventivas).
      - SUSPENDIDA: Institución suspendida por BICSA (excluida de alertas preventivas).
      - NORMAL (Verde): < 48hs hábiles transcurridas desde la última carga (al día).
      - ADVERTENCIA (Amarillo): entre 48hs y 72hs hábiles transcurridas (quedan <= 24hs para bloqueo).
      - CRITICO (Rojo): > 72hs hábiles transcurridas sin nueva carga de XML.
    """
    estado_upper = estado.upper() if estado else ""

    # Excluir instituciones desvinculadas de alertas
    if "DESVINCULAD" in estado_upper:
        return (0.0, 0.0, "DESVINCULADA")

    # Excluir instituciones ya bloqueadas o suspendidas de alertas preventivas
    if "BLOQUEAD" in estado_upper:
        return (72.0, 0.0, "BLOQUEADO")

    if "SUSPENDID" in estado_upper:
        return (72.0, 0.0, "SUSPENDIDA")

    fecha_carga = parse_fecha_bicsa(fecha_ultima_carga_str)
    if not fecha_carga:
        return (0.0, 72.0, "NORMAL")

    ahora = datetime.now()
    horas_transcurridas = calcular_horas_habiles(fecha_carga, ahora)
    horas_restantes = max(0.0, round(72.0 - horas_transcurridas, 2))

    if horas_transcurridas > 72.0:
        nivel = "CRITICO"
    elif horas_transcurridas >= 48.0:
        nivel = "ADVERTENCIA"
    else:
        nivel = "NORMAL"

    return (horas_transcurridas, horas_restantes, nivel)
