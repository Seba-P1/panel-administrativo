# React con backend Node / Express

Copiar nexo-node.mjs solo al backend. Nunca importarlo desde el bundle React. Las variables NEXO_BASE_URL, NEXO_PROJECT_ID y NEXO_PROJECT_TOKEN se cargan en el servidor. La ruta del estado solo funciona después de tu autenticación administrativa.

Ejemplo de montaje (adaptar requireYourAdminSession a tu función real; no está implementada por este paquete):

    import {requireNexoAdminAccess,nexoStatusHandler} from './nexo-node.mjs';
    app.get('/api/admin/nexo-status',requireYourAdminSession,nexoStatusHandler);
    app.use('/api/admin/contenido',requireYourAdminSession,requireNexoAdminAccess,tuRouterAdministrativo);

Primero proteger sesión/roles. Luego aplicar requireNexoAdminAccess en TODOS los routers administrativos que deban restringirse, antes de consultar o modificar información. Preservar CSRF y validaciones originales. No montarlo en APIs públicas ni login/contacto.

Desde React consultar únicamente tu propia ruta /api/admin/nexo-status con credentials:'same-origin'. Mostrar message, días y saldo por moneda. Se puede adaptar el componente NexoNotice.tsx quitando su import type y usando el mismo contrato de datos. No esconder solo botones: una llamada directa a la API debe recibir 402 si está suspendido. La UI no es el control de acceso.

Aplicar las mismas pruebas de aceptación enumeradas en integrations/nextjs/EJEMPLOS.md. La estrategia de contingencia permite acceso en una caída del central y registra advertencia. El adapter usa hasta 30 segundos de caché.
