# Documentación Completa y Manual de Usuario - BICSA Web Satélite V1.5

## 1. Introducción
**BICSA Web Satélite V1.5** es un sistema automatizado de auditoría y monitoreo diseñado para extraer, analizar y alertar sobre el estado de las instituciones financieras en el portal oficial de BICSA. La versión 1.5 introduce integración de Autenticación Segura con Firebase y un motor de scraping resiliente, sumándose al sistema de notificaciones automáticas por WhatsApp para una gestión mucho más proactiva.

---

## 2. Apartados del Menú Lateral

El sistema cuenta con un nuevo panel lateral de navegación (Menú) que agrupa las acciones principales y configuraciones del portal.

### 2.1. Panel Principal (Dashboard)
Es la vista por defecto donde se visualizan:
- **Tarjetas de KPI**: Resumen total de instituciones Activas, Suspendidas, Bloqueadas, etc.
- **Alertas Críticas**: Banners de advertencia que indican cuántas instituciones están a punto de superar las 72 horas hábiles sin cargar archivos XML.
- **Tabla de Instituciones**: Lista completa y en tiempo real, filtrable por categoría o alerta, y con buscador integrado.

### 2.2. Historial de Cambios
Un registro detallado de todas las variaciones de estado detectadas por el sistema de scraping a lo largo del tiempo. 
- Muestra el **Estado Anterior** y el **Estado Nuevo** de cada institución.
- Permite hacer seguimiento de cuándo una institución pasó a estar bloqueada o suspendida.

### 2.3. Exportar Excel
Botón de un solo clic que genera y descarga automáticamente un reporte completo en formato `.xlsx`.
- Incluye toda la información actual de las 216 instituciones (nombres, estados, vencimientos, horas restantes, nivel de alerta).
- Ideal para presentar reportes gerenciales diarios.

### 2.4. Ejecutar Scraping
Permite forzar una ejecución manual de extracción de datos del portal BICSA oficial.
- Útil si se requiere actualizar los datos fuera de los horarios programados automáticamente (07:00 hs y 16:00 hs).
- Refresca inmediatamente la base de datos tras culminar.

---

## 3. Integración y Envío de Alertas por WhatsApp

La versión 1.3 integra un módulo exclusivo para notificar a los representantes de las instituciones financieras de manera automatizada.

### 3.1. Conexión y Lector QR
Para que el sistema pueda enviar mensajes, debe estar vinculado a un número emisor de WhatsApp.
- **Acceso:** Desde el menú lateral, haz clic en **"Lector QR WhatsApp"**.
- **Vinculación:** Escanea el código QR que aparecerá en pantalla utilizando la opción "Dispositivos Vinculados" de la app oficial de WhatsApp en tu teléfono celular.
- **Indicador de Estado:** En la cabecera superior del Dashboard verás un indicador: 
  - 🟢 **WhatsApp: Conectado** (Listo para operar).
  - 🔴 **WhatsApp: Desconectado** (Requiere escanear el QR).

### 3.2. Configuración de Números de Contacto
Las alertas se envían a los números configurados para cada institución.
- En la tabla del Panel Principal, en la columna **"Detalles / Motivo / Vencimiento"**, haz clic en el botón de **Configurar (ícono de engranaje)** de cualquier institución.
- Se abrirá una ventana emergente ("Configurar Textos de WhatsApp") donde podrás ingresar y guardar los números de celular de los encargados (Ej: `+595981234567`).

### 3.3. Envío de Mensajes y Confirmación
El sistema incluye un botón de **Chat (ícono de WhatsApp verde)** para aquellas instituciones que tienen números configurados y están en estado de advertencia o crítico (ej: más de 48h o 72h sin cargar XML).
1. Haz clic en el ícono de WhatsApp en la fila correspondiente.
2. Saltará una **ventana de confirmación** para evitar envíos por error ("¿Estás seguro que deseas enviar la alerta por WhatsApp?").
3. Al confirmar ("Sí, enviar WhatsApp" en color naranja), el sistema enviará automáticamente una plantilla redactada.
4. **Plantilla Inteligente:** El mensaje incluye el nombre de la institución y la **Fecha de última carga registrada**, permitiendo que los administradores reaccionen rápidamente para evitar el bloqueo en el sistema BICSA oficial.

---

## 4. Novedades de las versiones V1.4 y V1.5

### 4.1. Autenticación Segura (Firebase)
Se ha migrado el sistema de inicio de sesión de un acceso básico en base de datos a **Google Firebase Admin SDK**.
- Los inicios de sesión son ahora procesados y validados de manera criptográfica mediante tokens JWT en Firebase Auth.
- Mayor seguridad en la exposición de endpoints del backend, bloqueando el acceso (Error 401 Unauthorized) a cualquier solicitud que no cuente con un token válido.

### 4.2. Scraping Resiliente a Diseños Web (Layouts)
El motor de scraping ha sido mejorado significativamente para ser inmune a cambios estructurales menores en la plataforma de BICSA.
- Ahora omite inteligentemente las tablas de diseño o "layout" ocultas del motor antiguo ASP.NET (WebForms) analizando el anidamiento de etiquetas HTML (`<table>` dentro de `<table>`).
- Garantiza la extracción exacta de todas las instituciones reales independientemente de si poseen ID o no.
- Maneja correctamente cierres de sesión abruptos (Timeout de ASP.NET) sin generar "instituciones fantasma" con errores de sistema.

### 4.3. Dominio, HTTPS e Infraestructura (Oracle Cloud + Coolify)
Para garantizar la profesionalidad y seguridad en la nube, el sistema fue desplegado utilizando herramientas modernas de enrutamiento web:
- **Dominio Dinámico (DuckDNS):** El sistema es accesible públicamente a través del dominio `bicsa-panel-estado-inst.duckdns.org`. DuckDNS actúa como un servicio de DNS gratuito que apunta este nombre amigable hacia la dirección IP de tu máquina en Oracle Cloud.
- **Certificados SSL (Let's Encrypt):** Todas las comunicaciones entre el navegador y el servidor viajan encriptadas bajo el protocolo seguro HTTPS. Los certificados son emitidos gratuitamente por **Let's Encrypt**, una autoridad de certificación global.
- **Proxy Inverso (Coolify + Traefik):** El despliegue se integra como un módulo directo en el proxy **Traefik** nativo de tu gestor **Coolify**. Traefik intercepta las llamadas al dominio de DuckDNS y negocia la auto-renovación de los certificados SSL de Let's Encrypt en segundo plano.
- **Bug Fix de Red en Ubuntu (Iptables):** Se superaron las severas restricciones del firewall por defecto de Oracle Cloud aplicando la regla `iptables -I FORWARD -j ACCEPT`, lo cual garantiza que los contenedores aislados de Docker puedan salir a internet para validar el certificado SSL de Let's Encrypt sin fricción.

### 4.4. Seguridad Avanzada del Backend y APIs
Para proteger los datos expuestos por la API, se agregaron tres anillos de seguridad adicionales:
1. **Blindaje de Puertos Internos:** Los servicios vitales (`backend` en puerto 8000, `scraper` en puerto 8001, `db` en puerto 5432) ahora corren estrictamente sobre la interfaz local (`127.0.0.1`) o en la red aislada de Docker. Ningún actor externo puede acceder a ellos de manera directa; todo pasa por la inspección de Traefik y el Frontend.
2. **Mitigación DDoS (Rate Limiting):** El servidor principal FastAPI ahora implementa `slowapi`, restringiendo a un máximo de `120 peticiones por minuto` por dirección IP. Cualquier abuso desencadenará bloqueos temporales automáticos HTTP 429 (Too Many Requests).
3. **CORS Estricto:** Cross-Origin Resource Sharing ha sido clausurado para aceptar peticiones única y exclusivamente desde el dominio oficial del panel en producción (ej. `bicsa-panel-estado-inst.duckdns.org`), frustrando ataques automatizados desde otros sitios web maliciosos.
