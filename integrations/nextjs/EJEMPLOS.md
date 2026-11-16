# Integrar un proyecto Next.js existente

Estos son puntos de integración: no reemplazan la autenticación ni conocen las rutas de tu proyecto. Los conectores están incluidos; las llamadas a `requireYourAdminSession` son el lugar explícito para TU autenticación. No copies ejemplos que todavía tengan ese nombre sin adaptarlos. No conectes el panel central a la base privada del sitio.

## 1. Variables privadas del proyecto conectado

En su hosting o `.env.local`, nunca en el navegador ni en Git:

```env
NEXO_BASE_URL=https://panel.tu-dominio.com
NEXO_PROJECT_ID=ID_DE_LA_FICHA_EN_NEXO
NEXO_PROJECT_TOKEN=TOKEN_EMITIDO_PARA_ESE_PROYECTO
```

No usar prefijos `NEXT_PUBLIC_` ni `VITE_`. No copiar las variables al frontend. Reiniciar o redesplegar el sitio tras modificar variables.

Copiar `nexo.server.ts` y `NexoNotice.tsx` a `src/lib/nexo/`. El componente hace un `import type` del tipo: no debe importar funciones del servidor. La clave nunca se pasa como prop.

## 2. Layout del panel: verificar sesión ANTES de consultar Nexo

Ejemplo para App Router; adaptar rutas de imports. `requireYourAdminSession` debe redirigir al login si no hay usuario y verificar permisos administrativos.

```tsx
// src/app/admin/layout.tsx (solo ejemplo de adaptación)
import {requireYourAdminSession} from '@/lib/auth'; // TU función real
import {getNexoStatus} from '@/lib/nexo/nexo.server';
import NexoNotice from '@/lib/nexo/NexoNotice';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function AdminLayout({children}:{children:React.ReactNode}) {
  await requireYourAdminSession();
  const billing = await getNexoStatus();
  if (billing.suspended) return <main><NexoNotice initial={billing}/><p>Contactá al proveedor para reactivar el acceso.</p></main>;
  return <main><NexoNotice initial={billing}/>{children}</main>;
}
```

El layout mejora la experiencia, pero NO basta para proteger datos. No montar este layout en el sitio público. Next.js puede conservar layouts durante la navegación: las comprobaciones de las API y Server Actions son obligatorias.

## 3. Proteger CADA endpoint administrativo y CADA Server Action

```ts
// src/app/api/admin/ejemplo/route.ts
import {requireYourAdminSession} from '@/lib/auth'; // TU función real
import {assertNexoAdminAccess, NexoSuspendedError} from '@/lib/nexo/nexo.server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request:Request) {
  await requireYourAdminSession();
  // También preservar las verificaciones CSRF/origen y permisos propios del proyecto.
  try {
    await assertNexoAdminAccess();
    // A partir de aquí va la validación y operación administrativa ORIGINAL.
    return Response.json({ok:true});
  } catch (e) {
    if (e instanceof NexoSuspendedError) return Response.json({error:e.message},{status:402});
    throw e;
  }
}
```

En una Server Action, validar sesión, permisos y `await assertNexoAdminAccess()` antes de acceder a la base o modificar datos. Cubrir lecturas privadas y escrituras. El inicio de sesión, cierre de sesión, contacto y estado de cobro pueden permanecer accesibles al usuario autenticado para permitir regularización. No modificar APIs públicas del sitio por esta regla.

## 4. Endpoint para refrescar el aviso

```ts
// src/app/api/admin/nexo-status/route.ts
import {requireYourAdminSession} from '@/lib/auth';
import {getNexoStatus} from '@/lib/nexo/nexo.server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  await requireYourAdminSession();
  return Response.json(await getNexoStatus(),{headers:{'Cache-Control':'no-store'}});
}
```

Este endpoint NO debe requerir `assertNexoAdminAccess`: el cliente suspendido debe poder consultar su aviso. Sí debe requerir su sesión válida. El componente actualiza el aviso cada 60 segundos; las operaciones del servidor consultan una caché de hasta 30 segundos. No es una revocación instantánea.

## 5. Contingencia y límites

Timeout central de 4 segundos. Si no responde, hay una respuesta inválida o una credencial fue revocada, se permite temporalmente acceso administrativo (fail-open), se registra un aviso en el servidor del sitio y se intenta otra vez después de 10 segundos. Evita bloquear clientes por una caída técnica; implica que no hay garantía absoluta de restricción si el central está caído o inaccesible. No usar para decisiones de seguridad, autorización de usuarios o protección de datos: eso pertenece a la autenticación del sitio.

Para el conector Next.js se suministró código para adaptar y revisar, no una integración ya instalada en tus repositorios. Hay que ejecutar el build y las pruebas de cada proyecto y desplegarlo.

## 6. Prueba de aceptación antes de activar suspensiones

1. Emitir credencial y desplegar en un entorno de prueba.
2. Verificar que el sitio público sigue funcionando sin conexión al panel central.
3. Confirmar que un usuario anónimo no puede consultar `/api/admin/nexo-status` ni APIs administrativas.
4. Crear un cargo de prueba. Verificar días y aviso con fechas conocidas.
5. Activar suspensión manual con motivo. Comprobar layout Y respuestas 402 de TODAS las API/acciones del panel.
6. Desactivar suspensión manual y registrar el pago. Comprobar rehabilitación.
7. Probar la suspensión automática con acuerdo y días de gracia en una copia de prueba.
8. Cortar temporalmente la conexión central: comprobar contingencia y registro de advertencia.
9. Rotar token, cambiar variable en el hosting y redesplegar.
10. Recién entonces configurar la política real, luego de acordarla con el cliente.

Referencia oficial: https://nextjs.org/docs/app/getting-started/server-and-client-components
