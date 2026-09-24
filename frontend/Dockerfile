FROM node:alpine

WORKDIR /app

# Copy the frontend code
COPY . .

# Install dependencies
RUN npm install

# Expose port 5173
EXPOSE 5173

# Run the Vite development server
CMD ["npm", "run", "dev", "--", "--host"]
