FROM node:16-alpine

RUN mkdir -p /workplace
WORKDIR /workplace
ADD . /workplace

RUN npm install

CMD ["npm", "start"]
