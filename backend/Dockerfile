FROM node:22-slim

# Install system dependencies (ffmpeg and clean up apt lists to keep image small)
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install packages
RUN npm install

# Copy source code and prisma folder
COPY . .

# Run prisma generate
RUN npx prisma generate

EXPOSE 5000

CMD ["npm", "run", "start:dev"]
