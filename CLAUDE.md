# Carta Viva

Producto de **Gaby y Juanma**: carta viva (fotos reales o 3D) y pedidos desde la mesa para locales
gastronómicos. **Este es el único repo del producto**: "Comilona" fue una demo de Carta Viva y su repo está
archivado. Lo específico de un cliente va en el repo de ese cliente.

Leé antes de tocar nada: `README.md` (qué es y cómo se corre), `CONTRIBUTING.md` (cómo trabajamos) y
`decisiones.md` (por qué se decidió cada cosa).

## Reglas para Claude

- **No se sube a `main`.** Trabajá en una rama con prefijo (`feat/`, `fix/`, `docs/`, `chore/`) y abrí un PR.
- **No edites a mano los generados:** `vista-previa.html` (`npm run vista-previa`) y `supabase/semilla.sql`
  (`npm run semilla`). Editá el original y regenerá.
- Lo propio de un local vive en `app/assets/local.js`. Si lo cambiás, corré `npm run semilla`.
- Si tocás `supabase/esquema.sql`, corré `npm install` y `npm test`.
- Nunca escribas claves, tokens ni contraseñas en un archivo ni en el chat. Van en `.env` (no se versiona).
- Anotá las decisiones importantes en `decisiones.md`, con fecha, en el mismo PR.
- Hablá con quien te use en español rioplatense, directo, sin narrar el paso a paso.
- El trabajo mecánico (implementar un encargo ya cerrado) se delega al agente `obrero`
  (`.claude/agents/obrero.md`).
