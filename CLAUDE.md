# BAKAMULA

Herramienta de desarrollo de mods para Quake. Ejecuta un servidor dedicado FTEQW en background y lo controla mediante una interfaz gráfica Electron.

## Funcionalidades

1. **Configuración**: Path de Quake y selección de mod
2. **Control del servidor**: Lanzar / Parar FTEQW dedicado
3. **Monitor de estado**: Polling periódico mostrando mapa actual y número de jugadores
4. **Consola web**: Enviar comandos arbitrarios y ver respuestas

## Stack Técnico

- **Frontend**: Electron + Vue 3 (Composition API) + Pinia
- **Persistencia**: electron-store o similar (persistir config entre sesiones)
- **Comunicación**: RCON para comandos, stdout del proceso para respuestas largas
- **Servidor**: FTEQW dedicado como proceso hijo
- **UI**: Tema oscuro

## Estructura de Archivos

```
src/           Código de la aplicación Electron/Vue
fteqs/src/     Código fuente de FTEQW (referencia, no modificar sin necesidad)
```

## Comandos

```bash
npm install    # Instalar dependencias
npm run dev    # Ejecutar en modo desarrollo
npm run build  # Compilar para producción
```

## Restricciones

- **NO modificar** archivos de configuración del usuario
- **Minimizar** cambios al código de FTEQW
- Preferir soluciones que usen APIs nativas de FTEQW (como RCON)

## Estado del Proyecto

Fase inicial de desarrollo.

## Arquitectura

### Stores (Pinia)
- **configStore**: Path de Quake, mod seleccionado, configuración RCON (persistido)
- **serverStore**: Estado del proceso (running/stopped), mapa actual, jugadores

### Selector de mod
- Lee subcarpetas del directorio de Quake configurado
- Muestra dropdown con las carpetas disponibles (ej: id1, hipnotic, mods custom)

### Polling de estado
- Intervalo: 1 segundo
- Si hay operación pesada en curso, saltar updates hasta que termine
- Evitar acumulación de requests pendientes

### Proceso principal (Electron main)
- Spawn del proceso FTEQW dedicado
- Captura de stdout para respuestas
- Envío de comandos via RCON o stdin

### Consola
- Historial de comandos (navegar con flechas arriba/abajo)
- Buffer de salida: últimas 100 líneas, scrollable
- Input para comandos arbitrarios

### Comandos FTEQW útiles
- `status` - Muestra mapa, jugadores conectados, info del servidor
- `map <nombre>` - Cambia de mapa
- `quit` - Cierra el servidor

## Notas Técnicas

### Comunicación con FTEQW
- RCON: protocolo UDP con autenticación por contraseña, ideal para enviar comandos
- stdout: capturar salida del proceso para respuestas largas o logs
- Enfoque híbrido recomendado: RCON → comando, stdout → respuesta
