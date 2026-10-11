# Cómo trabajamos en este repo

Para Gaby y Juanma (y para cualquier Claude que trabaje acá). Pocas reglas, que se cumplan siempre.

## Una sola raíz

**Este repo es el único del producto Carta Viva.** "Comilona" fue una demo publicada de Carta Viva; su repo
(`comilona`) está archivado y no se toca. Lo que se haga para un cliente concreto (por ejemplo, una carta con la
marca de un local) vive en el repo de ese cliente, no acá. Acá va solo lo que sirve a **todos** los locales.

## La regla de `main`

`main` **siempre anda**: `npm start` levanta la demo y `npm test` pasa. Nadie sube directo a `main`: todo
entra por **Pull Request**.

## Ramas

Una rama por tema, con prefijo y en minúsculas:

| Prefijo | Para | Ejemplo |
|---|---|---|
| `feat/` | algo nuevo | `feat/capas-3d` |
| `fix/` | arreglar algo | `fix/precio-combo` |
| `docs/` | solo documentación | `docs/orden-del-repo` |
| `chore/` | mantenimiento, herramientas | `chore/actualizar-dependencias` |

Ramas cortas: se abren, se mergean y se borran. Si una rama dura más de una semana, se la parte en pasos.

## Commits

En español, en imperativo, con el prefijo de arriba y una línea que diga **qué** cambió:

```
feat: la carta en capas con escena, video y cámara
fix: el combo suma bien con la bebida elegida
docs: explicar cómo sumar un plato
```

Un commit = una idea. No se mezclan en el mismo commit cambios de código con fotos nuevas o con regenerados.

## Pull Requests

1. Abrí el PR contra `main` con la plantilla (se carga sola).
2. **El otro lo mira antes de mergear**, aunque sea rápido. Es lo que nos evita pisarnos.
3. Se mergea con *Squash* y se borra la rama.
4. Si el PR toca algo que le cambia el trabajo al otro (`local.js`, `esquema.sql`, estructura de carpetas),
   se avisa antes de abrirlo.

## Qué NO se sube

- Claves, tokens, `.env`, contraseñas. Nunca. Si se subió una por error, se **rota** la clave (borrar el commit no alcanza).
- `node_modules/`, videos del taller, archivos del sistema.
- Cambios a mano en archivos **generados**: `vista-previa.html` (se arma con `npm run vista-previa`) y
  `supabase/semilla.sql` (se arma con `npm run semilla`). Se editan los originales y se regenera.

## Antes de abrir un PR

- [ ] `npm start` anda y probaste lo que tocaste en el navegador (celular incluido si tocaste la carta del comensal).
- [ ] Si cambiaste `app/assets/local.js`: corriste `npm run semilla`.
- [ ] Si cambiaste la base (`supabase/esquema.sql`): `npm install` y `npm test` pasan.
- [ ] Si cambiaste la app: corriste `npm run vista-previa`.
- [ ] Fotos y videos pesados: webp o comprimidos, nada de originales de varios MB.

## Dónde va cada cosa

| Qué | Dónde |
|---|---|
| La app (carta del comensal + panel) | `app/` |
| Todo lo propio de un local (carta, precios, mesas, equipo) | `app/assets/local.js` |
| La base real (Supabase) | `supabase/` |
| Herramientas (servidor, vista previa, taller de fotos) | `herramientas/` |
| Pruebas y experimentos que todavía no son parte de la app | `mejoras/` (cuando pasan a la app, se mueven y se borran de acá) |
| Por qué se decidió algo | `decisiones.md` |
| Guía de planes para explicarle al cliente | `planes-para-el-cliente.md` |

Las decisiones importantes se anotan en `decisiones.md` con fecha, en el mismo PR que las implementa.
