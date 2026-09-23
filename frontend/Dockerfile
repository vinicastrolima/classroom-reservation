# syntax=docker/dockerfile:1
# ------------------------------------------------------------------------------
# Stage 1: Dependencies and Build
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: High Performance Nginx Production Runner
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/build/client /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
