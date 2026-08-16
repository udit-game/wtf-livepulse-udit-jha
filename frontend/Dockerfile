FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=http://localhost:3000/api
ARG VITE_WS_URL=ws://localhost:3000/ws

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Install curl so we can poll the backend health endpoint before starting nginx
RUN apk add --no-cache curl

EXPOSE 80

CMD sh -c "until curl -sSf http://backend:3001/health; do echo 'Waiting for backend...'; sleep 1; done; nginx -g 'daemon off;'"