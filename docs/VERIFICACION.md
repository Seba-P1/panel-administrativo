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
