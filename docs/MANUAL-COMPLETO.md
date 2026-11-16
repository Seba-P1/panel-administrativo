# Nexo · Centro de clientes y proyectos

Aplicación privada para administrar tus seis proyectos, clientes, alquileres, notas, tareas y calendario. Diseño inspirado en la referencia aportada: tarjetas claras, bordes redondeados, navegación lateral y acentos naranja/oliva.

## Empezar en Windows
1. Instalá Node.js 24 LTS desde https://nodejs.org/.
2. Extraé TODO el ZIP a una carpeta, por ejemplo C:\Nexo (no ejecutar desde dentro del ZIP).
3. Ejecutá INSTALAR-WINDOWS.bat. Necesita conexión a Internet para descargar dependencias. No se instala ningún servicio en Windows.
4. Guardá el código de instalación mostrado por npm run init. También está en SETUP_TOKEN dentro del archivo local .env.
5. Ejecutá INICIAR-WINDOWS.bat y visitá http://localhost:3001.
6. Creá tu cuenta con tu email, una contraseña de al menos 12 caracteres y el código. No hay contraseña predeterminada.

Para disponibilidad con tu PC apagada, desplegá UNA instancia principal en un VPS. Usá su URL desde Windows; podés crear un acceso directo en Edge/Chrome. Una copia local separada sirve para desarrollo, no se sincroniza con el VPS.

## Documentos incluidos
- docs/INSTALACION.md: instalación Windows, servidor, HTTPS, copias y restauración.
- docs/USO-Y-COBROS.md: módulos, adelantos y reglas de suspensión.
- docs/INTEGRACION.md: qué archivos hacen falta de los proyectos y cómo conectarlos.
- docs/VERIFICACION.md: pruebas ejecutadas y límites de entrega.
- integrations/nextjs/EJEMPLOS.md: adaptación de App Router, API y Server Actions.
- integrations/react/EJEMPLOS.md: adaptación React + Express.

## Tecnología y datos
React + Vite, Express, Node.js y una base SQLite NUEVA propia. Se crea al iniciar en data/nexo.sqlite. No necesitás instalar MySQL/PostgreSQL ni conectar todas las bases actuales. No hay credenciales de tus clientes dentro del paquete. package-lock.json fija las versiones instaladas.

## Alcance real
Incluye código ejecutable, no un servicio ya publicado ni un instalador EXE firmado. No se accedió a tus repositorios ni se modificaron tus sitios. Los conectores requieren adaptación, build y despliegue en cada proyecto. No se promete ausencia absoluta de errores: revisá el documento de verificación y realizá la aceptación en tu entorno antes de activar restricciones.


---

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


---

# Uso, cobros y reglas de acceso

## 1. Datos iniciales cargados

YP Telpuente: https://yptelpuente.com.ar. Cliente: YPF. Intermediario: Esteban Ochipinti. En funcionamiento. Sin tarifa ni pagos inventados.
RC Play: https://rcplay.com.ar. Cliente: Jorge Tanos. En funcionamiento. Adelanto de 6 meses marcado pagado, con fecha e importe desconocidos. La mención «creo que desde el mes 7» queda como nota, sin inferir el año.
Juan Guenumil: https://juanguenumil.com.ar. En funcionamiento. Se conserva la indicación de que no pagó ningún mes, pero no se cuantifica deuda sin tarifa, fecha y cargos. Nombre de cliente inferido del dominio y marcado para confirmar.
Mutual 1 de Noviembre de Bahía Blanca: en desarrollo, no operativa.
Bardas Bajas: pendiente de creación, no operativa.
Pelota Paleta Atletico: demo, no operativa.

Los nombres, clientes, URLs y etapas pueden editarse. No se verificó titularidad, hosting, rutas de administración ni disponibilidad actual de esos sitios. Las fichas reflejan lo que aportaste, no una auditoría de las webs.

## 2. Módulos

Resumen: proyectos activos, pagos del mes, saldo de cargos y tareas. La moneda del selector separa ARS, USD y EUR: no se convierten ni suman monedas diferentes. El gráfico contiene pagos registrados, no proyecciones.
Proyectos: alta, edición, archivo y restauración. Cada ficha separa información, cobros, notas, tareas, calendario, conexión y mensajes. Registrar URL de sitio y panel, hosting, repositorio, intermediario y observaciones. Abrir una URL no sincroniza ni modifica su contenido.
Clientes: datos de contacto, empresa y notas. Se puede archivar sin borrar historial; si tiene proyectos operativos, revisar sus asignaciones antes de archivarlo.
Tareas: Por hacer, En curso, Por revisar, Hecho; prioridades y fecha. Arrastrar tarjetas o editar el estado. Se admiten tareas generales o vinculadas a un proyecto.
Calendario: mes interactivo; crear y editar eventos, moverlos de día arrastrando. Muestra tareas con fecha y cargos pendientes. Los eventos tienen inicio y fin en el mismo día y usan la zona horaria configurada. No hay eventos recurrentes, adjuntos ni integración Google/Outlook en esta versión.
Notas: texto libre por proyecto. No pegar contraseñas o claves.
Mensajes: borradores, apertura de WhatsApp/email y envío SMTP opcional. Editar un mensaje vuelve a dejarlo como borrador. Confirmar envío externo es una declaración manual, no prueba de entrega.
Configuración: nombre del panel, estudio, zona horaria, contacto, cambio de contraseña, auditoría y exportación de registros.

La sincronización del panel principal usa Server-Sent Events (SSE) entre ventanas autenticadas de la MISMA instancia; consulta de respaldo cada 30 segundos. No es sincronización entre bases independientes ni garantía de latencia cero. El calendario necesita conexión al servidor.

## 3. Primeras decisiones financieras

Confirmar para cada proyecto operativo: fecha real de inicio, tarifa, moneda, día del ciclo (derivado de la fecha de inicio), condiciones de pago, días de aviso, gracia y acuerdo sobre restricciones. Dejar desactivada la suspensión automática hasta integrar y probar el sitio.

En Información -> Editar proyecto, cargar tarifa e inicio y habilitar gestión del alquiler. En Cobros -> Generar mes, elegir explícitamente el mes. Se crea un cargo por proyecto activo configurado, salvo que ya exista o el período completo esté cubierto por un adelanto confirmado. El comando se puede repetir sin duplicar cargos vigentes del mismo período.

No hay generador automático programado: se usa el botón Generar mes. Generar el siguiente período con anticipación para que el cliente vea cuántos días faltan. Si no existe un cargo futuro, el sistema no inventa un vencimiento. También se pueden crear cargos manuales, ajustar su importe antes de cobrar y anularlos.

Un ciclo que comienza el 31 se ajusta al último día de meses cortos. No hay prorrateo automático ni cálculo de intereses, multas, impuestos o aumentos. Si una cobertura adelantada coincide solo parcialmente con un ciclo, el generador NO aplica un prorrateo: preparar y revisar un cargo manual. No habilitar cargos automáticos por suposición.

## 4. Registrar un pago

Crear o seleccionar el cargo. Pulsar Cobrar. Indicar importe, fecha real, método y referencia. Los pagos se imputan a un único cargo del mismo proyecto y moneda; se admiten pagos parciales y se impide sobrepagar. Para un pago que cubre varios cargos, registrar una imputación por cargo con la misma referencia y fecha; la suma debe coincidir con el comprobante real.

Si un cargo tiene pagos vigentes no se puede cambiar importe, moneda, proyecto ni anularlo. Primero anular los pagos incorrectos, después corregir el cargo y volver a registrarlos. No se borran comprobantes: se anulan para conservar el historial. Las fechas y descripciones son configurables, las relaciones y validaciones financieras se conservan por seguridad.

Los cargos NO son facturas fiscales de ARCA. No hay integración bancaria ni Mercado Pago; registrar manualmente solo pagos realmente comprobados. El paquete no descarga, adjunta ni verifica comprobantes bancarios.

## 5. Caso RC Play: seis meses adelantados

Primero confirmar con Jorge Tanos la fecha completa y el año de inicio, los seis períodos cubiertos, importe, moneda y fecha del pago. No deducir que comenzó en julio de un año determinado.

En el adelanto existente completar fecha, meses, importe si se conoce y notas. El período usa fin exclusivo: si comienza el 1 de julio y cubre 6 meses, cubre hasta el 31 de diciembre y renueva el 1 de enero siguiente; esto es un ejemplo, NO la fecha asignada a RC Play.

Para contabilizar ingreso, crear un cargo agregado por esos 6 meses (concepto claro, sin período mensual para no colisionar con el generador), registrar un pago por el total en la fecha real y conservar el adelanto para la cobertura. El monto del adelanto es informativo: NO se suma además al ingreso para evitar contar dos veces el mismo dinero. El ingreso del gráfico proviene únicamente del recibo registrado.

Los meses futuros totalmente cubiertos se omiten al generar. Si ya había cargos mensuales impagos para los mismos meses, revisarlos y anular los que efectivamente estén reemplazados por el cargo agregado. El adelanto NO borra deudas previas ni reconcilia cargos antiguos automáticamente. No registrar simultáneamente pagos duplicados en un cargo agregado y en todos los cargos mensuales. Revisar el saldo antes de avisar al cliente.

## 6. Caso Juan Guenumil

Confirmar identidad/contacto, inicio y tarifa. Crear los cargos correspondientes a los meses efectivamente adeudados. Si corresponde, generar uno por mes y revisar sus fechas. Sin esa confirmación se muestra Por configurar, no un saldo inventado ni Al día. Comunicar y acordar la política antes de aplicar una restricción. La información del panel no reemplaza acuerdos comerciales o asesoramiento legal.

## 7. Avisos y suspensión

Los estados se derivan de los cargos: sin configuración, no iniciado, revisar adelanto, próximo pago, vencido, al día o suspendido. Al día significa que los cargos registrados están saldados o existe cobertura vigente; no garantiza que estén cargados todos los meses históricos.

El día de vencimiento no se considera atrasado. Un cargo queda vencido al día siguiente. La suspensión automática se activa solo cuando el atraso supera estrictamente los días de gracia: con 7 días de gracia, se activa desde el día 8 de atraso. Requiere alquiler habilitado, proyecto operativo, política acordada, opción automática activada y conector instalado en todas las operaciones administrativas relevantes.

Un pago completo libera la suspensión automática cuando no quedan cargos que superen la gracia. Una suspensión manual requiere motivo y solo se libera desmarcándola manualmente. Tener un adelanto vigente no cancela una deuda anterior. No usar la suspensión para borrar datos ni cortar el sitio público.

No hay interruptor mágico que permita apagar sitios ajenos desde un enlace: el panel conectado debe consultar y aplicar el estado en el servidor. El conector entrega el ámbito admin_only. El aviso se actualiza en el panel del cliente cada 60 segundos; el backend puede usar una caché de 30 segundos. Una petición ya iniciada no se cancela retroactivamente.

Por defecto, si Nexo no responde o hay error de credencial, el conector permite temporalmente el acceso (fail-open) y registra advertencia. Evita castigar al cliente por caída técnica; limita la fuerza de la restricción durante una incidencia. La autenticación y los permisos del sitio siguen siendo obligatorios.

Archivar no equivale a suspender: conservará historial y dejará de listar el proyecto como operativo. Revocar el token deshabilita la consulta, pero bajo fail-open NO es una forma de suspender. Para suspender, usar el estado y mantener una credencial válida.

## 8. Información que no se edita en esta versión

No es un panel universal del contenido de todas las webs: no modifica noticias, usuarios, productos o ajustes propios de los otros CMS. Para esas operaciones se necesitan APIs específicas por proyecto, lista de acciones permitidas y permisos. La URL del panel sirve para abrirlo; el conector incluido resuelve estado de alquiler y acceso administrativo, no replicar todas las funciones de cada panel.


---

# Conectar proyectos React / Next.js / Node.js

## ¿Tengo que conectar todas las bases?

No. Nexo tiene su propia base. Cada proyecto conserva su base, login y hosting. Se integra servidor a servidor con una credencial por proyecto y una API de solo lectura del estado del alquiler. No entregar a Nexo usuarios root ni contraseñas globales de bases ajenas.

## Qué archivos o información hacen falta para una adaptación exacta

Por cada proyecto: package.json y archivo lock; árbol de carpetas de src/app o pages o rutas Express; layout/componente del panel; mecanismo de sesión y roles; handlers de API privados y Server Actions; middleware existente; nombres de variables de entorno sin sus valores secretos; plataforma de hosting, versión de Node y ruta real del panel. Si se necesitan funciones de contenido, agregar el esquema de datos anonimizado y las rutas API pertinentes.

No hacen falta .env reales, contraseñas, tokens de producción, dumps con datos de clientes, node_modules ni claves privadas. Enviar código con secretos sustituidos por MARCADOR. Las credenciales nuevas se cargan directamente en el hosting.

## Proceso

1. Publicar Nexo con HTTPS y crear la cuenta.
2. Completar identidad, contacto y política del proyecto.
3. Entrar en su ficha -> Conexión -> Generar credencial. Guardarla: no se vuelve a mostrar. El servidor conserva solo su hash.
4. Copiar los conectores al backend de ese proyecto y establecer NEXO_BASE_URL, NEXO_PROJECT_ID y NEXO_PROJECT_TOKEN como variables PRIVADAS del servidor.
5. Next.js: seguir integrations/nextjs/EJEMPLOS.md. React + Express: integrations/react/EJEMPLOS.md.
6. Mantener la autenticación actual. Validar usuario y permiso de administrador antes del control Nexo. Nunca usar el estado del alquiler como login.
7. Mostrar el aviso en el dashboard autenticado y aplicar el guard en cada API/Server Action administrativa. No solo en un componente visual.
8. Hacer build, desplegar en pruebas y ejecutar la aceptación detallada del conector.
9. Revisar Última consulta en Nexo. Emitir una clave no significa que la integración esté instalada; una consulta recibida tampoco prueba que todas las rutas estén protegidas.
10. Activar la política real solo después de acordarla y probarla.

## API incluida

GET /api/integration/v1/status
Authorization: Bearer TOKEN_DEL_PROYECTO

Respuesta resumida: project_id, project_name, state, message, suspended, scope=admin_only, debt_by_currency (centavos separados por moneda), next_due, days_to_due, coverage_end, pending_advance, as_of, warning_days, show_notice, contact_email y contact_phone.

Solo devuelve datos del proyecto de esa credencial. No acepta un project_id del navegador para elegir otro proyecto. No devuelve notas privadas, contraseñas, otros clientes ni tokens. No habilita CORS para el frontend: el secreto y la petición pertenecen al servidor del sitio.

Rotar invalida inmediatamente la clave anterior en Nexo; la caché del sitio puede conservar el último estado hasta 30 segundos. Actualizar variables y redesplegar. Si perdés un token, no se puede reconstruir: emitir otro. No usar un token de Nexo como credencial administrativa general.

## Servidor y contingencia

El endpoint tiene un límite de 300 solicitudes/minuto por IP. La caché de los adaptadores evita una consulta por cada render. No usar polling por usuario contra el central desde el navegador. Revisar escala si muchas instancias comparten IP.

Timeout de 4 segundos, caché válida 30 segundos y reintento tras 10 segundos en error. Permitir acceso administrativo ante indisponibilidad está configurado por seguridad operativa. No pretende ser DRM ni protección frente a alguien que controla el código o el servidor del sitio.

## Editar contenido de otras webs desde Nexo

Requiere un segundo tipo de conector, distinto al de alquiler: APIs autenticadas con acciones concretas, validación, permisos, auditoría y protección contra operaciones peligrosas. No se incluyó una función genérica que ejecute SQL remoto o código arbitrario. Hace falta revisar tus repositorios para implementarlo por proyecto. No se modificaron ni desplegaron tus sitios durante esta entrega.


---

# React con backend Node / Express

Copiar nexo-node.mjs solo al backend. Nunca importarlo desde el bundle React. Las variables NEXO_BASE_URL, NEXO_PROJECT_ID y NEXO_PROJECT_TOKEN se cargan en el servidor. La ruta del estado solo funciona después de tu autenticación administrativa.

Ejemplo de montaje (adaptar requireYourAdminSession a tu función real; no está implementada por este paquete):

    import {requireNexoAdminAccess,nexoStatusHandler} from './nexo-node.mjs';
    app.get('/api/admin/nexo-status',requireYourAdminSession,nexoStatusHandler);
    app.use('/api/admin/contenido',requireYourAdminSession,requireNexoAdminAccess,tuRouterAdministrativo);

Primero proteger sesión/roles. Luego aplicar requireNexoAdminAccess en TODOS los routers administrativos que deban restringirse, antes de consultar o modificar información. Preservar CSRF y validaciones originales. No montarlo en APIs públicas ni login/contacto.

Desde React consultar únicamente tu propia ruta /api/admin/nexo-status con credentials:'same-origin'. Mostrar message, días y saldo por moneda. Se puede adaptar el componente NexoNotice.tsx quitando su import type y usando el mismo contrato de datos. No esconder solo botones: una llamada directa a la API debe recibir 402 si está suspendido. La UI no es el control de acceso.

Aplicar las mismas pruebas de aceptación enumeradas en integrations/nextjs/EJEMPLOS.md. La estrategia de contingencia permite acceso en una caída del central y registra advertencia. El adapter usa hasta 30 segundos de caché.


---

# Verificación de esta entrega · 2026-11-06

## Ejecutado en el entorno de construcción

- Compilación de producción React/Vite completada.
- 36 pruebas automáticas Node: 20 de API/integración interna y 16 de cálculos financieros/calendario; todas aprobadas.
- 16 comprobaciones de navegador Chromium: alta y login, resumen, cliente, proyecto, nota, token, tarea, arrastre Kanban, evento, validación horaria, cargo con decimales, imputación de pago, SSE entre dos pestañas, auditoría, diseño móvil sin desborde y ausencia de errores JavaScript durante esos flujos.
- Backups consistentes y restauración de una copia en un directorio de prueba.
- npm audit sin vulnerabilidades conocidas reportadas en las dependencias bloqueadas al momento de la prueba. No es una auditoría de seguridad completa ni una garantía futura.

Los tests financieros cubren adelantos sin fecha, seis meses confirmados, monedas separadas, pagos parciales/anulados, cargos anulados, límite de gracia, suspensión automática/manual, rehabilitación, fecha de hoy, fin de mes y años bisiestos. Las pruebas API cubren autenticación, código de instalación, CSRF, origen, fechas, relaciones, conflictos de edición, sobrepagos, credenciales aisladas, rotación y generación mensual sin duplicados.

## No ejecutado ni acreditado

Instalación en tu PC Windows real; despliegue Docker en tu VPS; DNS y certificados de tu dominio; SMTP contra tu proveedor; recepción de emails; build de tus proyectos Next.js; controles de acceso de cada sitio real; carga/concurrencia de producción; recuperación ante desastre del hosting. No se accedió a tus códigos ni cuentas externas.

El paquete NO contiene una cuenta de prueba preinstalada, la base de QA ni datos de clientes ficticios creados durante las comprobaciones. Los tests sí incluyen credenciales sintéticas para sus procesos temporales aislados; no sirven para iniciar sesión en tu instalación. Los seis proyectos se precargan al primer arranque; los importes y fechas no confirmados permanecen sin completar. Las capturas se obtuvieron de una instancia de prueba, no de un servidor público desplegado.

## Aceptación antes de producción

Verificar alta/login y datos precargados en Windows. Desplegar una copia en servidor. Crear un cargo de prueba, pagar parcialmente y por completo. Probar próximos vencimientos. Instalar cada conector en pruebas y comprobar cada ruta protegida y el sitio público. Probar caída del central. Configurar SMTP y enviar un email de prueba a tu propia casilla. Generar un backup, descargarlo y restaurarlo en otra instancia. Revisar todas las fechas reales con cada cliente. Recién entonces usar datos y políticas definitivas.

## Límites de versión 1.0

Un administrador, tres monedas sin conversión, registro manual de cobros, sin ARCA/bancos/pasarelas, sin cuotas recurrentes automáticas, sin adjuntos, sin calendar sync externo, sin push, sin 2FA, sin recuperación de contraseña por correo, sin permisos multiusuario, sin editor universal de contenido de los sitios, sin aplicación offline, sin sincronización local/VPS. No hay generación de cargos programada ni backup externo programado. El esquema actual se crea al inicio; cambios de esquema futuros deben gestionarse con migraciones explícitas.

No afirmar «todo perfecto» sin completar estas verificaciones en el entorno real. La entrega es un sistema ejecutable y probado dentro del alcance indicado, más conectores para adaptar.
