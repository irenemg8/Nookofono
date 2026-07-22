import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // El sitio vive en dos sitios a la vez y cada uno quiere una raíz distinta:
  //
  //   - GitHub Pages lo publica en https://irenemg8.github.io/Nookofono/, o sea
  //     colgando de un subdirectorio. Sin `base` los assets se piden a la raíz
  //     del dominio y dan 404. El workflow `.github/workflows/deploy.yml` es
  //     quien pone DEPLOY_TARGET=pages.
  //   - En https://ipug.vrlabs.es el dominio es sólo suyo y los sirve la propia
  //     API desde la raíz, así que el prefijo sobra: con él los assets se
  //     pedirían a /Nookofono/assets/… y darían 404 igualmente.
  base: process.env.DEPLOY_TARGET === 'pages' ? '/Nookofono/' : '/',
})
