FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies

# Copy the rest of the project files to the container
COPY . .

# Build the project
RUN yarn install
RUN yarn run build

ENV NODE_OPTIONS=--max-old-space-size=16384

# Specify the command to run when the container starts
CMD [ "yarn", "start:dev" ]

# Expose port 3001 for the application to listen on
EXPOSE 3001