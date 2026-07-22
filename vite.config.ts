import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // El sitio se publica en https://irenemg8.github.io/Nookofono/, así que todas
  // las rutas de los assets tienen que colgar de ese subdirectorio. Sin esto,
  // el bundle se pide a la raíz del dominio y da 404.
  base: '/Nookofono/',
})
