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
