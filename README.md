# Portal Satélite de Monitoreo de Estado de Instituciones (BICSA) - V1.6

Sistema satélite de solo lectura para auditar y monitorear el estado de instituciones financieras en el portal BICSA (`https://bicquerywebapp.azurewebsites.net`).
Integrado con **Autenticación Firebase** y notificaciones por **WhatsApp**.

---

## 🏗️ Arquitectura Técnica y Monorepo

El proyecto está estructurado en un monorepo modular con 4 servicios orquestados vía Docker Compose:

```
docker-portal-estado-institucionesBIC/
├── PROMPT_ANTIGRAVITY.md     # Requerimientos originales del proyecto
├── .env.example              # Plantilla de variables de entorno
├── docker-compose.yml        # Orquestación de contenedores en local y prod
├── README.md                 # Guía de instalación y operaciones
├── DOCUMENTACION_COMPLETA_V1.6.md # Manual de usuario y arquitectura
├── scraper/                  # Microservicio de Scraping & Scheduler
│   ├── Dockerfile            # Imagen basada en Playwright (amd64/arm64)
│   ├── requirements.txt
│   ├── bicsa_scraper.py      # Extractor Playwright para ASP.NET WebForms (Omite Layouts anidados)
│   └── main.py               # Servicio FastAPI + APScheduler (07:00 / 16:00 hs)
├── backend/                  # API RESTful & Base de Datos
│   ├── Dockerfile
│   ├── firebase-adminsdk.json# Credenciales de Google Cloud (No subir a Git)
│   ├── app/
│   │   ├── main.py           # Aplicación FastAPI (Con Rate Limiting y CORS estricto)
│   │   ├── core/             # Seguridad con Firebase Auth
│   │   ├── db/               # Conexión SQLAlchemy PostgreSQL
│   │   └── api/              # Endpoints API (/auth, /instituciones, /internal)
└── frontend/                 # Dashboard SPA Interactivo
    ├── Dockerfile            # Multi-etapa Node.js + Nginx
    └── src/                  # React + Lucide Icons + Glassmorphic Dark UI + SDK Firebase Auth
```

---

## 🚀 Despliegue en Entorno de Desarrollo Local (Windows 11 + Docker Desktop)

### 1. Configuración de Variables de Entorno y Firebase
Copia el archivo `.env.example` a `.env` y configura tus credenciales reales del portal BICSA:

```bash
cp .env.example .env
```

Edita `.env` con tus datos de acceso:
```env
BICSA_USER=tu_usuario_bicsa
BICSA_PASSWORD=tu_password_bicsa
```

**⚠️ REQUISITO IMPORTANTE**: Debes colocar el archivo de credenciales de tu Service Account de Firebase con el nombre `firebase-adminsdk.json` dentro de la carpeta `backend/`. Este archivo es ignorado por Git por motivos de seguridad.

### 2. Iniciar la Aplicación con Docker Compose

Ejecuta el siguiente comando en PowerShell o CMD dentro del directorio del proyecto:

```powershell
docker compose up --build -d
```

### 3. Acceso a los Servicios

- 🎨 **Dashboard Frontend**: `http://localhost:3000`
  - Inicia sesión utilizando las cuentas autorizadas en tu proyecto de Firebase.
- ⚙️ **Backend API (Swagger Docs)**: `http://localhost:8000/docs`
- 🤖 **Microservicio Scraper (Health Check)**: `http://localhost:8001/health`

---


## 🔬 Prueba Individual del Scraper (Standalone)

Si deseas probar la autenticación y extracción del scraper directamente contra el portal sin levantar toda la infraestructura:

```powershell
# Crear entorno virtual e instalar dependencias
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r scraper/requirements.txt
playwright install chromium

# Ejecutar script extractor
python scraper/bicsa_scraper.py
```

---

## 🌐 Despliegue en Producción (VM Oracle Cloud ARM64 / Ubuntu 22.04)

### 1. Compilación Multi-Arquitectura con `docker buildx`

Debido a que la VM de Oracle Cloud es arquitectura **ARM64 (aarch64)** y el desarrollo se realiza en Windows **amd64**, se recomienda compilar imágenes multi-plataforma:

```bash
# Crear builder multi-arquitectura en Docker Desktop
docker buildx create --name multiarch-builder --use
docker buildx inspect --bootstrap

# Compilar y subir imágenes a Docker Hub o Container Registry
docker buildx build --platform linux/amd64,linux/arm64 -t tu_usuario/bicsa-scraper:latest ./scraper --push
docker buildx build --platform linux/amd64,linux/arm64 -t tu_usuario/bicsa-backend:latest ./backend --push
docker buildx build --platform linux/amd64,linux/arm64 -t tu_usuario/bicsa-frontend:latest ./frontend --push
```

### 2. Despliegue por Git + SSH en la VM de Oracle Cloud

En la VM de Oracle Cloud (Ubuntu 22.04):

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/docker-portal-estado-institucionesBIC.git
cd docker-portal-estado-institucionesBIC

# Configurar variables de entorno de producción
cp .env.example .env
nano .env  # (Asegúrate de agregar DOMAIN=tu-dominio.duckdns.org para Coolify/Traefik)

# IMPORTANTE: Solución al bug de red saliente en Oracle Cloud + Ubuntu
# Esto permite que los contenedores de Docker tengan acceso a Internet para descargar SSL
sudo iptables -I FORWARD -j ACCEPT
sudo apt-get update && sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

# Levantar servicios
docker compose up -d
```

### 3. Integración con Coolify y Traefik (HTTPS)
El proyecto está optimizado para integrarse nativamente con el proxy inverso **Traefik** gestionado por **Coolify**.
En `docker-compose.yml`, el contenedor `frontend` se adjunta a la red `coolify` y expone etiquetas (`labels`) para auto-descubrimiento. Traefik intercepta el dominio definido, genera el certificado SSL con Let's Encrypt y balancea la carga automáticamente, manteniendo cerrados y seguros todos los demás puertos del host.

### 4. Capas de Seguridad Implementadas (V1.6)
- **Firebase Auth:** Las rutas API exigen validación de token JWT firmado criptográficamente.
- **Roles y Permisos:** Control de acceso estricto basado en BD (Ej. Funciones de unificación solo para administradores).
- **Puertos Internos:** Los servicios `backend` (8000), `scraper` (8001) y `db` (5432) solo escuchan tráfico interno (127.0.0.1 o red de docker) y no están expuestos al público general.
- **Rate Limiting:** Se utiliza `slowapi` (120 req/min) para mitigar ataques DDoS y fuerza bruta.
- **CORS Estricto:** Se valida el `DOMAIN` en los orígenes permitidos de FastAPI para prevenir CSRF/XSS.

## ⏰ Programación de Scraping y Reglas de Negocio

- **07:00 hs (Diario)**: Corrida **FULL** / Snapshot Histórico Oficial. Se realiza la captura diaria y se registran eventos en `historial_cambios`.
- **16:00 hs (Lunes a Viernes)**: Corrida **LIGHT** / Refresco en vivo de intradía.
- **Regla de 72 Horas Hábiles**: Se calcula el tiempo restante (excluyendo sábados y domingos) desde `Fecha última carga` para advertir sobre instituciones que corren riesgo de ser **Bloqueadas** por BICSA.
- **Auditoría de Nombres (V1.6)**: El sistema detecta automáticamente instituciones desaparecidas y proporciona una interfaz de "Resolución de Nombres" para que los Administradores puedan unificarlas y mantener un historial transparente de los traspasos.
