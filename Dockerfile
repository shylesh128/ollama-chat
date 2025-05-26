# Use Node.js v22 LTS slim image
FROM node:22-slim

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile

# Copy the rest of the code
COPY . .

EXPOSE 3000

CMD ["pnpm", "start"] 