# Frontend image (INFRA-3) — build the Vite app, serve the static bundle via Nginx.
FROM node:22-alpine AS build

WORKDIR /app

# VITE_API_BASE_URL is baked in at build time (the browser calls the API directly).
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
