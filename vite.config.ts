import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
    proxy: {
      '/api/appwrite': {
        target: 'https://fra.cloud.appwrite.io/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/appwrite/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        cars: fileURLToPath(new URL('./cars.html', import.meta.url)),
        carDetails: fileURLToPath(new URL('./car-details.html', import.meta.url)),
        login: fileURLToPath(new URL('./login.html', import.meta.url)),
        register: fileURLToPath(new URL('./register.html', import.meta.url)),
        contact: fileURLToPath(new URL('./contact.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
        adminDashboard: fileURLToPath(new URL('./admin/dashboard.html', import.meta.url)),
        adminCars: fileURLToPath(new URL('./admin/cars.html', import.meta.url)),
        adminAddCar: fileURLToPath(new URL('./admin/add-car.html', import.meta.url)),
        adminEditCar: fileURLToPath(new URL('./admin/edit-car.html', import.meta.url)),
      },
    },
  },
});
