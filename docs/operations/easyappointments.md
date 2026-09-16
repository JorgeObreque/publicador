# EasyAppointments

Variables requeridas:

- `EASYAPPOINTMENTS_BASE_URL`
- `EASYAPPOINTMENTS_USERNAME`
- `EASYAPPOINTMENTS_PASSWORD`
- `EASYAPPOINTMENTS_PROVIDER_ID`
- `EASYAPPOINTMENTS_SYNC_CRON`

## Rotación de credenciales

Antes de exponer el MVP públicamente:

1. Crear un usuario dedicado en Easy!Appointments con permisos mínimos.
2. Reemplazar la contraseña actual en el archivo `.env`.
3. Reiniciar la API.
4. Validar que la sincronización siga funcionando.
5. Eliminar la contraseña antigua en Easy!Appointments.

## Atribución

- La operadora debe pegar el código `ADS:CMP-XXX-X` en las notas de cada cita.
- La aplicación recordará este paso desde la bandeja de conversiones.
