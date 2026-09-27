# Lilipo Club — robot mensual personalitzat

Aquest robot NO envia el mateix dia a tothom.

Quan una persona s'apunta, guarda:
- dia de la setmana
- setmana del mes (1a, 2a, 3a, 4a, 5a)
- hora i minut locals
- zona horària

Exemple: si s'apunta un dijous de la primera setmana a les 10:30, el robot li enviarà el correu el dijous de la primera setmana de cada mes a les 10:30, segons la seva zona horària.

## Posada en marxa
1. `npm install`
2. Copia `.env.example` a `.env` i omple `RESEND_API_KEY`, `FROM_EMAIL` i `PUBLIC_BASE_URL`.
3. `npm start`
4. Publica aquest servidor en un host que mantingui Node.js actiu 24/7.

El formulari demana consentiment explícit i cada correu inclou baixa.
