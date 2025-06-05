
FROM node:18-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app
COPY package.json .
RUN npm install
COPY ./src ./src

EXPOSE 3000
CMD ["npm", "start"]
