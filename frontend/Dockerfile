FROM node:22-alpine 

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

CMD ["sh", "-c", "npx next dev -H 0.0.0.0 -p ${PORT:-3000}"]
