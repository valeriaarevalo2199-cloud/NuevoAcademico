
# Académico Fácil
## Documento de arquitectura del sistema

**Versión:** 1.0  
**Estado:** Arquitectura propuesta  
**Repositorio:** NuevoAcademico  
**Publicación:** GitHub Pages

---

## 1. Descripción general

Académico Fácil es una aplicación web orientada a la gestión y seguimiento de solicitudes académicas. Su propósito es centralizar la recepción, revisión, actualización y resolución de trámites mediante una interfaz sencilla, organizada y adaptable a dispositivos móviles.

El proyecto se desarrolla como una aplicación independiente. No representa ni está oficialmente vinculada a una institución educativa específica.

## 2. Objetivos

- Facilitar la radicación de solicitudes académicas.
- Permitir consultar el estado y el historial de cada solicitud.
- Facilitar la comunicación entre estudiantes y funcionarios.
- Administrar servicios, categorías y permisos.
- Mantener registros de las operaciones relevantes.
- Proteger la información mediante controles de acceso.

## 3. Tecnologías

| Tecnología | Responsabilidad |
|---|---|
| HTML5 | Estructura de las páginas |
| CSS3 | Diseño y presentación |
| Bootstrap | Componentes y diseño adaptable |
| JavaScript | Interactividad del frontend |
| GitHub | Control de versiones y repositorio |
| GitHub Pages | Publicación del frontend |
| Supabase Auth | Autenticación de usuarios |
| PostgreSQL | Almacenamiento de información |
| Supabase Storage | Almacenamiento privado de archivos |
| Row Level Security (RLS) | Control de acceso a los registros |

## 4. Arquitectura general

La solución se organizará en dos partes principales:

### 4.1. Frontend

Se alojará en GitHub Pages y contendrá las páginas públicas, formularios, paneles y componentes visuales.

El frontend se encargará de presentar la información, validar los formularios de manera inicial y comunicarse con los servicios autorizados del backend.

### 4.2. Backend

Supabase proporcionará autenticación, base de datos PostgreSQL y almacenamiento de archivos.

Las políticas RLS restringirán el acceso a los datos según la identidad y los permisos del usuario. Las operaciones privilegiadas se ejecutarán únicamente en un entorno de servidor protegido cuando sea necesario.

## 5. Roles del sistema

### Estudiante
- Registrarse e iniciar sesión.
- Consultar los servicios disponibles.
- Crear solicitudes académicas.
- Consultar sus propias solicitudes.
- Enviar y recibir mensajes relacionados con sus trámites.
- Consultar actualizaciones e historial.
- Adjuntar documentos permitidos.

### Funcionario
- Consultar las solicitudes que tenga autorización para gestionar.
- Revisar la información recibida.
- Actualizar los estados permitidos.
- Solicitar información adicional.
- Responder mensajes.
- Registrar actuaciones y resultados.

### Administrador
- Gestionar perfiles y asignación autorizada de roles.
- Administrar categorías y servicios.
- Configurar parámetros del sistema.
- Consultar reportes autorizados.
- Revisar registros de auditoría.

Cada usuario tendrá un único rol principal. La asignación de roles privilegiados no estará disponible mediante el registro público.

## 6. Estados de las solicitudes

Los estados iniciales serán:

1. Recibida.
2. En revisión.
3. Pendiente de información.
4. Resuelta.
5. Cerrada.

Las transiciones estarán sujetas a reglas de negocio y permisos. Cada cambio relevante deberá registrar el estado anterior, el nuevo estado, la fecha y el usuario responsable.

## 7. Módulos funcionales

- Página pública.
- Registro e inicio de sesión.
- Perfiles y autorización.
- Catálogo de servicios.
- Gestión de solicitudes.
- Asignación de funcionarios.
- Mensajería.
- Historial de solicitudes.
- Notificaciones.
- Adjuntos privados.
- Administración.
- Reportes y auditoría.

## 8. Seguridad

- Utilizar Supabase Auth para la autenticación.
- No almacenar contraseñas en texto plano.
- Activar RLS en las tablas expuestas a usuarios.
- Aplicar permisos mínimos necesarios.
- Impedir que los estudiantes consulten solicitudes ajenas.
- Proteger los archivos mediante almacenamiento privado y políticas de acceso.
- No publicar claves privadas ni secretos en GitHub.
- No confiar únicamente en las validaciones del navegador.
- Registrar las operaciones sensibles y los cambios de estado.
- Validar tipos, tamaños y permisos de los archivos adjuntos.

La clave pública de Supabase podrá utilizarse en el frontend únicamente después de configurar correctamente las políticas de seguridad. Las claves secretas y de servicio nunca deben exponerse en el código público.

## 9. Organización del proyecto

La estructura inicial será:

- `index.html`: página principal.
- `assets/css/styles.css`: estilos visuales.
- `assets/js/app.js`: funciones generales.
- `docs/arquitectura.md`: documentación técnica.

A medida que avance el desarrollo, se incorporarán módulos adicionales para autenticación, solicitudes, mensajería y administración.

## 10. Publicación y mantenimiento

GitHub Pages publicará el frontend a partir de la rama principal del repositorio. Los cambios se incorporarán mediante commits.

La base de datos y la autenticación se gestionarán en Supabase. La publicación del frontend no implica que todas las funciones del sistema estén implementadas o habilitadas.

## 11. Alcance de la primera versión

La primera versión priorizará el registro seguro, los perfiles, las solicitudes, el seguimiento, la mensajería, la administración y el control de acceso.

No se contemplan inicialmente integraciones con sistemas institucionales externos, pagos, firma digital, aplicaciones móviles nativas ni notificaciones por SMS o WhatsApp.

## 12. Estado actual

La página pública inicial está publicada en GitHub Pages.

La conexión con Supabase, el modelo definitivo de datos, las políticas RLS y los módulos funcionales se implementarán y probarán en etapas posteriores.

La arquitectura descrita es una propuesta de diseño y no constituye evidencia de que los módulos o controles de seguridad ya estén implementados.
