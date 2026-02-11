FROM node:22-alpine 

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

CMD ["sh", "-c", "next dev -p ${PORT:-8080}"]
