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
