FROM node:22-alpine AS cogfall-build
WORKDIR /build
COPY cogfall/package.json cogfall/package-lock.json ./
RUN npm ci
COPY cogfall/ ./
RUN npm run build

FROM python:3.13-slim
WORKDIR /app
COPY . .
COPY --from=cogfall-build /build/dist ./cogfall/dist
EXPOSE 8000
CMD ["python3", "-m", "http.server", "8000"]
