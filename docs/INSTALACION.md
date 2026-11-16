# Instalación, publicación y mantenimiento

## 1. Arquitectura recomendada

Navegador en Windows -> HTTPS -> servidor Nexo -> su propia base SQLite persistente.
Cada panel Next.js/Node.js -> petición autenticada HTTPS al estado de SU proyecto en Nexo.
Cada proyecto mantiene su base y autenticación actuales. Los visitantes del sitio público NO pasan por el control de alquiler.

No hace falta una base nueva en un servicio externo: el archivo SQLite se crea automáticamente. Para seis proyectos y un administrador es una solución simple. Usar UN proceso de aplicación y disco local persistente. No usar una carpeta de red/OneDrive activa para la base, ni varias réplicas compartiendo el archivo. Si se necesita alta disponibilidad, varios operadores o escalado horizontal, hay que diseñar una migración a PostgreSQL y revisar roles/concurrencia: esa migración no forma parte de esta versión.

## 2. Windows 10/11: preparación

Descargar Node.js 24 LTS desde https://nodejs.org/. Reiniciar la terminal después de instalar. Comprobar en CMD:

	node --version
	npm --version

También admite Node 22.13 o superior dentro de la rama 22. Se probó aquí con Node 22.23.4; no se ejecutó en una máquina Windows real. Node 24 es la recomendación para tu instalación. El módulo node:sqlite puede emitir advertencias de estabilidad según la versión; consultar su documentación oficial.

Extraer el ZIP completo, por ejemplo a C:\Nexo. Si Windows bloquea un .bat descargado, revisar su contenido antes de ejecutarlo y usar las opciones normales de desbloqueo del archivo. No desactivar el antivirus ni las políticas de seguridad del equipo.

Instalación automática: ejecutar INSTALAR-WINDOWS.bat. Ejecuta npm ci, npm run init y npm run build. Necesita Internet. Si falla, conserva el mensaje de error; no seguir como si hubiera terminado.

Instalación manual equivalente, desde CMD dentro de la carpeta:

	npm ci
	npm run init
	npm run build
	npm start

Abrir http://localhost:3001. Usar localhost de manera consistente, no alternarlo con 127.0.0.1: la comprobación de origen debe coincidir con APP_URL. El servidor local escucha solo en 127.0.0.1, no queda expuesto a tu red. No hace falta abrir puertos del router.

En la primera pantalla escribir el código SETUP_TOKEN generado por init, tu email y una contraseña de al menos 12 caracteres. La cuenta se guarda con hash scrypt. Guardar la contraseña en un gestor. Después de crear la cuenta se puede quitar SETUP_TOKEN de .env y reiniciar; la cuenta no depende de ese código. No enviar .env ni bases de datos por chats públicos.

Para abrirlo otro día: INICIAR-WINDOWS.bat. Cerrar la ventana o Ctrl+C detiene esta copia local. Si el puerto 3001 está ocupado, cambiar PORT y APP_URL juntos en .env; abrir la nueva URL manualmente. El .bat seguirá mostrando la URL original como recordatorio.

Para desarrollo opcional: npm run dev abre Vite en http://localhost:5173 y el backend en 3001; no publicar ese servidor de desarrollo. Para pruebas: npm test. Para compilar cambios: npm run build y reiniciar.

## 3. Servidor principal: requisitos

Un VPS Linux con Docker Engine y Docker Compose plugin instalados, acceso SSH, almacenamiento persistente y salida a Internet. Recomendación de partida para esta escala: 2 vCPU, 2 GB RAM y disco de 20 GB o más, como estimación operativa, no garantía de capacidad. El VPS, dominio y email pueden requerir contratación por separado.

Crear un subdominio propio, por ejemplo panel.tu-dominio.com. Debe apuntar al VPS con un registro A; publicar AAAA solo si IPv6 funciona. No se registró ni verificó un dominio real para vos. En la configuración del firewall del proveedor permitir SSH desde tu IP, HTTP 80 y HTTPS 443. No publicar 3001 ni puertos de bases.

Caddy requiere que el dominio resuelva al servidor, que 80/443 sean accesibles y que sus directorios de certificados sean persistentes. El Compose incluido ya configura los volúmenes. Un dominio inventado, puertos bloqueados o DNS incorrecto impedirán emitir el certificado.

## 4. Publicar con Docker

Subir la carpeta de código al VPS, por ejemplo /opt/nexo, usando SFTP o Git privado. No subir node_modules, .env personal, bases de prueba o backups. El ZIP no contiene tus credenciales. Instalar Docker siguiendo la guía oficial correspondiente al sistema; no ejecutar comandos de instalación de terceros sin revisarlos.

En la carpeta del VPS:

	cp .env.example .env
	docker run --rm node:24-bookworm-slim node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

El segundo comando muestra un secreto aleatorio de 64 caracteres. Editar .env en el VPS:

	APP_URL=https://panel.tu-dominio.com
	PANEL_DOMAIN=panel.tu-dominio.com
	SETUP_TOKEN=PEGAR_AQUI_EL_SECRETO_RECIEN_GENERADO
	TRUST_PROXY=1

No escribir https:// dentro de PANEL_DOMAIN. No reutilizar el código de instalación local en el VPS. Compose fija HOST, PORT, NODE_ENV y DATA_DIR para el contenedor; no cambiar el directorio de datos en el contenedor sin migrar el volumen.

Proteger .env y arrancar:

	chmod 600 .env
	docker compose up -d --build
	docker compose ps
	docker compose logs --tail=100 app
	docker compose logs --tail=100 caddy

Abrir https://panel.tu-dominio.com, crear la cuenta y hacer la configuración inicial. No abrir por HTTP con credenciales. La emisión del certificado puede tardar; si falla, revisar DNS, puertos y logs. Dockerfile ejecuta la aplicación como usuario node. Caddy es el único servicio publicado.

Luego quitar SETUP_TOKEN de .env y ejecutar docker compose up -d --force-recreate app. No compartir logs que contengan códigos de instalación de la etapa inicial. Confirmar que docker compose ps informa salud correcta y que el login funciona por HTTPS.

## 5. Usarlo desde la PC sin mantenerla encendida

Abrir la URL HTTPS del servidor desde Windows. En Edge o Chrome se puede crear un acceso directo o instalar la página como aplicación cuando el navegador ofrezca esa opción. Es un acceso al servicio web, no una sincronización offline. No es necesario arrancar el .bat local para usar el VPS.

Elegir el VPS como única fuente de verdad. Una instancia local y una instancia VPS con bases diferentes NO se fusionan ni se sincronizan. Para mover los datos locales al VPS, hacer una copia completa y restaurarla con la aplicación del VPS detenida, siguiendo la sección siguiente. Trasladar también, por un canal seguro, los secretos de configuración necesarios, sin publicarlos.

## 6. Copias de seguridad

Exportar JSON desde Configuración descarga tus registros, pero NO es una copia completa restaurable por el programa. No incluye la cuenta, sesiones ni credenciales del conector. No hay botón de importar JSON en esta versión.

Copia SQLite consistente en Windows/local:

	npm run backup

La aplicación puede seguir funcionando: se usa VACUUM INTO para una instantánea consistente. Se guarda en backups/. Copiar el archivo fuera de la PC o del VPS, preferentemente cifrado. No copiar a mano solo nexo.sqlite mientras la aplicación esté escribiendo: en modo WAL podría quedar una copia incompleta.

Con Docker:

	docker compose exec app npm run backup
	docker compose exec app ls -lt /app/backups
	docker compose cp app:/app/backups/NOMBRE-EXACTO.sqlite ./copia-nexo.sqlite

Usar el nombre real mostrado, no NOMBRE-EXACTO literalmente. Descargar esa copia a otro dispositivo. El volumen de backups en el mismo VPS no protege contra pérdida del servidor. El .env y las variables SMTP se respaldan aparte y con cifrado. Recomendar una rutina diaria y probar periódicamente una restauración; no hay una tarea de backup automático configurada por el paquete.

## 7. Restaurar con la aplicación detenida

Local: detener npm start o el .bat y ejecutar:

	npm run restore -- "C:\ruta\copia.sqlite" --confirm
	npm start

El comando verifica integrity_check, preserva una copia de la base anterior e invalida las sesiones restauradas. No ejecutarlo mientras la aplicación esté abierta. El código no puede verificar que otro proceso externo no esté escribiendo: detenerlo es una responsabilidad operativa.

Docker: guardar una copia en la carpeta del VPS y ejecutar:

	docker compose stop app
	docker compose run --rm -v "$PWD/copia-nexo.sqlite:/restore.sqlite:ro" app node scripts/restore.mjs /restore.sqlite --confirm
	docker compose up -d app

La copia anterior queda preservada dentro del volumen. No subir una base privada a Git. Los tokens originales de los sitios no se pueden reconstruir desde sus hashes: si se perdieron, emitir nuevos y actualizar los sitios. No borrar volúmenes al restaurar. En particular, docker compose down -v elimina datos y certificados: NO usarlo como comando normal de mantenimiento.

## 8. Actualizaciones

Hacer backup, revisar cambios y dependencias, ejecutar npm ci, npm test, npm run build y reiniciar en local. En VPS ejecutar docker compose up -d --build tras revisar la nueva versión. Comprobar login, un proyecto y conexión de un sitio. Las actualizaciones futuras que cambien el modelo de datos pueden necesitar migraciones; no asumir compatibilidad de cualquier base futura.

## 9. Email opcional

En .env del servidor configurar SMTP_HOST, SMTP_PORT (habitualmente 587), SMTP_SECURE=false para STARTTLS o true para 465, SMTP_USER, SMTP_PASSWORD y SMTP_FROM. Reiniciar el contenedor. Usar un proveedor autorizado y un dominio con SPF/DKIM/DMARC según sus instrucciones; no se configuraron DNS de email por vos. El cliente usa TLS y no desactiva la validación de certificados.

Sin SMTP podés abrir borradores en tu correo o WhatsApp. Con SMTP cada envío requiere tu acción en el panel. Que el servidor SMTP lo acepte no garantiza entrega en la bandeja de entrada. No hay campañas automáticas, notificaciones push ni integración oficial con WhatsApp Business en este paquete.

## 10. Fuentes técnicas consultadas

Node SQLite: https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html
Caddy HTTPS: https://caddyserver.com/docs/automatic-https
Next.js secretos servidor/cliente: https://nextjs.org/docs/app/getting-started/server-and-client-components

Consulta adicional para instalar Docker: https://docs.docker.com/engine/install/ (seguir la variante de tu distribución).
