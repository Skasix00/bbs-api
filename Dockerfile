FROM node:18-alpine

# Diretório de trabalho
WORKDIR /usr/src/app

# Copiar dependências primeiro
COPY package*.json ./

# Instalar apenas dependências necessárias
RUN npm install --production

# Copiar o código
COPY . .

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=4000

# Porta exposta
EXPOSE 4000

# Arrancar a API
CMD ["node", "src/index.js"]
