from sqlalchemy.orm import Session

from app.models.institucion import ConfiguracionScraper

DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


def obtener_configuracion_scraper(db: Session) -> ConfiguracionScraper:
    """
    Devuelve la fila única de configuración, creándola con los valores por
    defecto (lunes a viernes) si todavía no existe.
    """
    config = db.query(ConfiguracionScraper).first()
    if not config:
        config = ConfiguracionScraper()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def actualizar_configuracion_scraper(db: Session, valores: dict, usuario_email: str) -> ConfiguracionScraper:
    config = obtener_configuracion_scraper(db)
    for dia in DIAS:
        setattr(config, dia, bool(valores.get(dia, False)))
    config.actualizado_por = usuario_email
    db.commit()
    db.refresh(config)
    return config


def serializar_configuracion_scraper(config: ConfiguracionScraper) -> dict:
    dias_valores = {dia: getattr(config, dia) for dia in DIAS}
    return {
        **dias_valores,
        "activo": any(dias_valores.values()),
        "actualizado_el": config.actualizado_el,
        "actualizado_por": config.actualizado_por,
    }
