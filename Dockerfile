FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production LEDGER_DATA_SOURCE=demo PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]
