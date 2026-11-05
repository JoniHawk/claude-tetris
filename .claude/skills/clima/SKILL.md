---
name: clima
description: Obtiene el clima actual (temperatura, sensación térmica, humedad, viento, lluvia) de una ciudad. Por defecto San Fernando, Chile. Usar cuando el usuario pida el clima o la temperatura local.
argument-hint: "[ciudad] (opcional, default: San Fernando, Chile)"
---

# Clima local

Ciudad por defecto: **San Fernando, Chile** (lat -34.58, lon -70.99). Usarla SIEMPRE, sin geocodificar ni preguntar, salvo que `$ARGUMENTS` indique explícitamente otra ciudad.

## Pasos

1. Si se dio otra ciudad, geocodificar:
   `curl -s "https://geocoding-api.open-meteo.com/v1/search?name=<ciudad>&count=1&language=es"`
   → tomar `results[0]` (latitude, longitude, name, country). Si no hay resultados, avisar.
2. Consultar clima (sin API key):
   `curl -s "https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&timezone=auto"`
3. Responder en español, conciso:
   `<Ciudad>: <temp>°C (sensación <ap>°C), humedad <h>%, viento <v> km/h, lluvia <p> mm — <descripción> (<hora local>)`

## weather_code → descripción
0 despejado · 1-3 parcialmente nublado · 45/48 niebla · 51-57 llovizna · 61-67 lluvia · 71-77 nieve · 80-82 chubascos · 95-99 tormenta

## Notas
- Si `curl` falla, usar WebFetch con la misma URL.
- No guardar datos en archivos; solo informar.
