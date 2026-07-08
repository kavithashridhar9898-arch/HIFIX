const pool = require('../config/database');

async function fixChatTables() {
  try {
    console.log('Fixing chat tables schema...');

    // Drop existing messages table
    await pool.query('DROP TABLE IF EXISTS typing_status');
    console.log('✅ Dropped typing_status table');

    await pool.query('DROP TABLE IF EXISTS message_media');
    console.log('✅ Dropped message_media table');

    await pool.query('DROP TABLE IF EXISTS messages');
    console.log('✅ Dropped messages table');

    // Recreate Messages table with correct schema
    await pool.query(`
      CREATE TABLE messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        conversation_id INT NOT NULL,
        sender_id INT NOT NULL,
        message_type ENUM('text', 'image', 'video', 'audio', 'document') DEFAULT 'text',
        content TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_conversation (conversation_id),
        INDEX idx_sender (sender_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Messages table recreated with correct schema');

    // Recreate Message media table
    await pool.query(`
      CREATE TABLE message_media (
        id INT PRIMARY KEY AUTO_INCREMENT,
        message_id INT NOT NULL,
        media_type ENUM('image', 'video', 'audio', 'document') NOT NULL,
        media_url VARCHAR(500) NOT NULL,
        file_name VARCHAR(255),
        file_size INT,
        thumbnail_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        INDEX idx_message (message_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Message media table recreated');

    // Recreate Typing status table
    await pool.query(`
      CREATE TABLE typing_status (
        id INT PRIMARY KEY AUTO_INCREMENT,
        conversation_id INT NOT NULL,
        user_id INT NOT NULL,
        is_typing BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_typing (conversation_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Typing status table recreated');

    console.log('🎉 All chat tables fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing chat tables:', error);
    process.exit(1);
  }
}

fixChatTables();
