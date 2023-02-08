# Event Service
This service is equipped with a worker that keeps a close eye on the Substrate chains, ensuring smooth and uninterrupted event management.

## Getting Started
These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites
- Node.js
- NPM
- Redis
### Installing
1. Clone the repository
```
$ git clone https://github.com/subrelay/event-service.git
```

2. Navigate to the project directory
```
$ cd event-service
```

3. Install the dependencies
```
$ npm install
```

4. Start the server
```
$ npm start
```

### Build docker image

#### Step 1:
Rename .env.dist to .env and update those variables in that file.

#### Step 2: 
Run command:

```
docker build -t subrelay-event-service .
```