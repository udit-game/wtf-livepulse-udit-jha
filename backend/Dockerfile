FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Install `pg_isready` (postgres client) so the container can wait for DB readiness
RUN apk add --no-cache postgresql-client curl

COPY . .

EXPOSE 3001

CMD ["npm", "start"]