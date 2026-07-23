# Backend para «Excel» — FUSIONADO con RAG-Pugtín

> ⚠️ **Obsoleto como app aparte.** La app Excel ya **no tiene almacén propio**:
> es una vista de los `.xlsx`/`.csv` que hay en **RAG-Pugtín**. Un fichero es el
> mismo se mire desde Excel o desde Archivos.
>
> No hace falta ninguna tabla `sheets` ni ruta `/api/sheets`. Todo lo que
> necesita Excel es lo mismo que RAG-Pugtín: la tabla `files` y las rutas de
> blob. **Ver `docs/BACKEND-RAGUGTIN.md`.**

Cómo funciona ahora:

- Excel lista los ficheros de `/api/files` cuyo nombre acaba en `.xlsx`/`.xls`/
  `.csv`.
- Crear una hoja nueva = crear un `file` en la raíz (`folderId: ""`) + subir su
  blob con `PUT /api/files/:id/blob`.
- Editar = bajar el blob, editarlo y volver a subirlo, más un `PATCH` con el
  nuevo `size`.

O sea: si montas RAG-Pugtín, Excel funciona solo. No hay nada específico de
Excel que construir en el servidor.
