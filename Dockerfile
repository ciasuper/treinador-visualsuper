FROM node:20-alpine

WORKDIR /app

# Copia arquivos do projeto
COPY package*.json ./

# Copia código completo
COPY . .

# Garante a pasta persistente do banco de dados
RUN mkdir -p /app/data

ENV PORT=5500
ENV DATA_DIR=/app/data

EXPOSE 5500

VOLUME ["/app/data"]

CMD ["node", "server.js"]
