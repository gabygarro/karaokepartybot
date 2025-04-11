import 'dotenv/config';
import TelegramBot, { Message } from 'node-telegram-bot-api';
import { connect as dbConnect, end as dbEnd } from './db/index.js';

const BOT_API_KEY = process.env.BOT_API_KEY;

const handler = async () => {
  let conn;

  try {
    if (!BOT_API_KEY) {
      console.log('Missing API Key');
      return;
    }

    const bot = new TelegramBot(BOT_API_KEY, { polling: true });

    const getCurrentUser = (chatId) => conn.query(`
      SELECT id, current_session FROM karaokebot.user
      WHERE telegram_user_id = ?
    `, [chatId]);
    const getUsername = async (userId) => {
      const [{ username }] = await conn.query(`
        SELECT username FROM karaokebot.user WHERE id = ?
      `, [userId]);
      return username;
    };
    const getUserTelegramId = async (userId) => {
      const [{ telegram_user_id }] = await conn.query(`
        SELECT telegram_user_id FROM karaokebot.user WHERE id = ?
      `, [userId]);
      return telegram_user_id;
    }
    const getUserSong = (userId, sessionId) => conn.query(`
      SELECT id, link FROM karaokebot.submission
      WHERE done = FALSE AND user_id = ? AND session_id = ? LIMIT 1
    `, [userId, sessionId]);
    const setSongAsDone = (songId) => conn.query(`
      UPDATE karaokebot.submission SET done = TRUE
      WHERE id = ?
    `, [songId]);
    const getCurrentSessionsUser = (currentSessionId) => conn.query(`
      SELECT user_id FROM karaokebot.session_current_user
      WHERE session_id = ?
      `, [currentSessionId]);

    bot.on('message', async (message: Message) => {
      conn = await dbConnect();
      const { text, from: { id: fromId }, chat: { id: chatId, username } } = message;
      if (text.startsWith('/start')) {
        await conn.query(`
          INSERT IGNORE INTO karaokebot.user (telegram_user_id, username) VALUES(?, ?)
        `, [fromId, username]);
        await bot.sendMessage(chatId, `
          /fiesta: Unirse a una fiesta con código
/help: Ayuda
        `);

      } else if (text.startsWith('/help')) {
        await bot.sendMessage(chatId, `
          /queue: Las siguientes 5 canciones en la cola
/mynextone: Mi siguiente canción en la cola
        `);

      } else if (text.startsWith('/fiesta')) {
        await bot.sendMessage(chatId, `
          Escribe tu código de fiesta:
        `);
  
      } else if (text.startsWith('/create')) {
        const partyId = text.split(' ')[1].toUpperCase();
        if (!partyId ||
            partyId.length >= 17 ||
            !(/^[A-Za-z0-9]+$/.test(partyId))) {
            await bot.sendMessage(chatId,
              'Identificador de fiesta debe de ser de menos de 16 caracteres alfanuméricos');
            return;
          }
        await conn.query(`
          INSERT INTO karaokebot.session (admin_id, name)
          VALUES (
            (SELECT id FROM karaokebot.user WHERE telegram_user_id = ?),
            ?
          )
        `, [fromId, partyId]);
        await bot.sendMessage(chatId, 'Fiesta creada');

      } else if (text.startsWith('/queue')) {
        const [{ id: userId, current_session: currentSessionId }] = await getCurrentUser(chatId);
        if (!currentSessionId) {
          await bot.sendMessage(chatId, 'Primero tienes que unirte a una fiesta. Escribe tu código de fiesta:');
          return;
        }
        const [{ user_id: currentSessionUserId }] = await getCurrentSessionsUser(currentSessionId);
        const queue_users = await conn.query(`
          SELECT DISTINCT s.user_id, u.username
          FROM submission s
          JOIN user u ON s.user_id = u.id
          WHERE s.session_id = ?
            AND s.done = FALSE;
        `, [currentSessionId]);
        let currentUserIndex = queue_users.findIndex((element) =>
          element.user_id === currentSessionUserId);
        let reply = '';
        const queueLength = 10;
        let ignoreSongIds = [];
        let i = 0;
        while (i < queueLength) {
          const nextIndex = (currentUserIndex === queue_users.length - 1)
            ? 0
            : currentUserIndex + 1;
          const nextUserId = queue_users[nextIndex].user_id;
          const [song] = await conn.query(`
            SELECT id, link FROM karaokebot.submission
            WHERE done = FALSE AND user_id = ? AND session_id = ? ${ignoreSongIds.length > 0 ? 'AND id NOT IN (?)' : ''} LIMIT 1
          `, [nextUserId, currentSessionId, ignoreSongIds]);
          if (!song) {
            const [remainingSubmission] = await conn.query(`
              SELECT 1 FROM karaokebot.submission
              WHERE done = FALSE AND session_id = ? ${ignoreSongIds.length > 0 ? 'AND id NOT IN (?)' : ''} LIMIT 1
            `, [currentSessionId, ignoreSongIds]);
            if (!remainingSubmission) break;
            currentUserIndex = nextIndex;
            continue;
          }
          const { id: songId, link } = song;
          ignoreSongIds = [...ignoreSongIds, songId];
          const username = queue_users[nextIndex].username;
          reply = reply + `
${username}: ${link}`;
          currentUserIndex = nextIndex;
          i++;
        }
        if (reply === '') {
          await bot.sendMessage(chatId, `No hay más canciones en la fila`);
        } else {
          await bot.sendMessage(chatId, reply);
        }

      } else if (text.startsWith('/mynextone')) {
        const [{ id: userId, current_session: currentSessionId }] = await getCurrentUser(chatId);
        const [song] = await getUserSong(userId, currentSessionId);
        if (!song) {
          await bot.sendMessage(chatId, 'No tienes vídeos en la cola');
          return;
        }
        await bot.sendMessage(chatId, song.link);

      } else if (text.startsWith('/next')) {
        const [{ id: userId, current_session: currentSessionId }] = await getCurrentUser(chatId);
        if (!currentSessionId) return;
        const [{ admin_id }] = await conn.query(`
          SELECT admin_id FROM karaokebot.session
          WHERE id = ?
        `, [currentSessionId]);
        if (admin_id != userId) return;

        const [currentSessionUser] = await getCurrentSessionsUser(currentSessionId);
        if (!currentSessionUser) {
          const [{ user_id }] = await conn.query(`
            SELECT user_id FROM karaokebot.submission WHERE done = FALSE LIMIT 1
          `);
          await conn.query(`
            INSERT INTO karaokebot.session_current_user (session_id, user_id)
            VALUES (?, ?)
          `, [currentSessionId, user_id]);
          await bot.sendMessage(chatId, 'Primer usuario en cola configurado');
          const [{ id: songId, link }] = await getUserSong(user_id, currentSessionId);
          const username = await getUsername(user_id);
          await bot.sendMessage(chatId, `
            Usuario: ${username} Link: ${link}
          `);
          await setSongAsDone(songId);

        } else {
          const queue_users = await conn.query(`
            SELECT DISTINCT user_id FROM karaokebot.submission
            WHERE session_id = ? AND done = FALSE;
          `, [currentSessionId]);
          const currentUserIndex = queue_users.findIndex((element) =>
            element.user_id === currentSessionUser.user_id);
          const nextIndex = (currentUserIndex === queue_users.length - 1)
            ? 0
            : currentUserIndex + 1;
          const nextUser = queue_users[nextIndex];
          if (!nextUser) {
            await bot.sendMessage(chatId, 'No hay más vídeos');
            return;
          }
          const nextUserId = nextUser.user_id;
          const [{ id: songId, link }] = await getUserSong(nextUserId, currentSessionId);
          const username = await getUsername(nextUserId);
          await bot.sendMessage(chatId, `
            Usuario: ${username} Link: ${link}
          `);
          const telegramId = await getUserTelegramId(nextUserId);
          await bot.sendMessage(telegramId, `Tu canción es la siguiente: ${link}`);
          await setSongAsDone(songId);
          await conn.query(`
            UPDATE karaokebot.session_current_user SET user_id = ?
            WHERE session_id = ?
          `, [nextUserId, currentSessionId]);
        }

      } else {
        const [{ id: userId, current_session: currentSessionId }] = await getCurrentUser(chatId);
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(\S*)?$/;

        if (!currentSessionId) {
          const partyId = text.toUpperCase();
          const [session] = await conn.query(`
            SELECT id FROM karaokebot.session
            WHERE name = ?
          `, [partyId]);
          if (!session) {
            await bot.sendMessage(chatId, 'Esa fiesta no existe, intenta de nuevo');
            return;
          }
          const { id: sessionId } = session;
          await conn.query(`
            UPDATE karaokebot.user SET current_session = ?
            WHERE id = ?
          `, [sessionId, userId]);
          await bot.sendMessage(chatId, `
            Ahora me puedes enviar enlaces a vídeos de Youtube (uno por mensaje)
También puedes intentar los siguientes comandos:
/queue: Las siguientes 5 canciones en la cola
/mynextone: Mi siguiente canción en la cola
          `);

        } else if (youtubeRegex.test(text)) {
          await conn.query(`
            INSERT INTO karaokebot.submission (link, session_id, telegram_chat_id, user_id)
            VALUES (?, ?, ?, ?)
          `, [text, currentSessionId, chatId, userId]);
          await bot.sendMessage(chatId, 'Vídeo añadido a la cola');
          const username = await getUsername(userId);
          console.log(`Usuario: ${username} Link: ${text}`);
        } else {
          await bot.sendMessage(chatId, 'Solo acepto links de youtube');
        }
      }
      dbEnd(conn);
    });
    
  } catch (error) {
    console.log(error);
    dbEnd(conn);
  }
}

handler();
