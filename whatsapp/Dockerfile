FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN npm install
COPY . .
EXPOSE 8002
CMD ["node", "index.js"]
