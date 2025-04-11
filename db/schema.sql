CREATE USER IF NOT EXISTS 'bot' IDENTIFIED BY '<<change your password here>>';
GRANT ALL PRIVILEGES ON karaokebot.* TO 'bot';
FLUSH PRIVILEGES;

USE karaokebot;

CREATE TABLE user (
  id INT NOT NULL AUTO_INCREMENT,
  telegram_user_id BIGINT NOT NULL UNIQUE,
  current_session INT DEFAULT NULL,
  username VARCHAR(32) DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE session (
  id INT NOT NULL AUTO_INCREMENT,
  admin_id INT NOT NULL,
  name VARCHAR(16) NOT NULL UNIQUE,
  PRIMARY KEY (id),
  FOREIGN KEY (admin_id) REFERENCES user(id) ON DELETE CASCADE
);

ALTER TABLE user
ADD FOREIGN KEY (current_session)
REFERENCES session(id)
ON DELETE SET NULL;

CREATE TABLE submission (
  id INT NOT NULL AUTO_INCREMENT,
  link VARCHAR(128) NOT NULL,
  session_id INT NOT NULL,
  telegram_chat_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessionaq (id) ON DELETE CASCADE
);

CREATE TABLE session_current_user (
  session_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);
