FROM node:22-alpine

# Directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Variables de entorno por defecto en producción
ENV NODE_ENV=production
ENV PORT=3000

# Copiar manifiesto de dependencias primero para aprovechar cache de Docker
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production

# Copiar el código fuente y assets públicos
COPY src ./src
COPY public ./public

# Exponer el puerto de la aplicación
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["node", "src/server.js"]
