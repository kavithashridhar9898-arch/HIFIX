const pool = require('../config/database');

async function addNotificationSettings() {
  try {
    // Get all users who don't have notification settings
    const [users] = await pool.query(`
      SELECT u.id 
      FROM users u 
      LEFT JOIN notification_settings ns ON u.id = ns.user_id 
      WHERE ns.id IS NULL
    `);

    console.log(`Found ${users.length} users without notification settings`);

    // Add default notification settings for each user
    for (const user of users) {
      await pool.query(`
        INSERT INTO notification_settings (user_id, email_notifications, push_notifications, sms_notifications)
        VALUES (?, TRUE, TRUE, FALSE)
      `, [user.id]);
      console.log(`✅ Added notification settings for user ${user.id}`);
    }

    console.log('✅ All users now have notification settings');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addNotificationSettings();
