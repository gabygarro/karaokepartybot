# karaokepartybot

Telegram bot that receives links to karaoke songs and manages a round-robin queue

## How to use

Go to BotFather and follow the process to create a new bot and get an API Key.

Create an `.env` file following the example from `.env.example`

### First time run

#### Spin up database

```bash
docker compose up -d # Run the database
```

#### Setup database

Use your favorite way to connect to the database and run the script in `db/schema.sql`. Remember to replace the password.

#### Spin up bot

```bash
npm i
npm start
```
