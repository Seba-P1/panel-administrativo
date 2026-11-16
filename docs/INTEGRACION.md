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
