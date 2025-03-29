# Use an official Node.js runtime as a parent image
FROM node:20-slim AS base

# Set the working directory in the container
WORKDIR /usr/src/app

# Install dependencies - Copy only package files first for better caching
COPY package*.json ./

# Use --omit=dev for smaller production image
RUN npm install --omit=dev 

# Copy the rest of the application code
COPY . .

# Make port 3000 available to the world outside this container (or your chosen WRAPPER_PORT)
# Note: This doesn't PUBLISH the port, just EXPOSEs it for linking/networking.
EXPOSE 3000

# Define environment variables (defaults or placeholders)
# These will be overridden by docker run -e or docker-compose environment sections
ENV NODE_ENV=production
ENV WRAPPER_PORT=3000
ENV DATA_DIR=/usr/src/app/data
# Required variables must be set at runtime:
# ENV ACTUAL_SERVER_URL=
# ENV ACTUAL_BUDGET_SYNC_ID=
# Optional:
# ENV ACTUAL_SERVER_PASSWORD=
# ENV ACTUAL_BUDGET_PASSWORD=

# Run the server script when the container launches
CMD [ "node", "server.js" ]