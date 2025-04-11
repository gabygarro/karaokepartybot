# Karaoke Party Bot

Telegram bot that receives links to youtube karaoke songs and orders the songs equitatively between the people in queue.

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

### Create a karaoke party (admin only)

Send the command `/create [CODE]` to create a karaoke party. The code must have a maximum of 16 alphanumeric chars.

```
/start
/create YERYIS
```

### Join a karaoke party

Admins should also run this

```
/fiesta
YERYIS
```

### See song queue

Get a list of the next 5 songs in the queue

```
/queue
```

### See my next song

```
/mynextone
```

### Go to next song (admin only)

Marks the current song as done, sends the next son's link to the admin and sends the next song's user a message reminding them that their song is up next.

```
/next
```

### Leave karaoke party to join another one

Pending.
