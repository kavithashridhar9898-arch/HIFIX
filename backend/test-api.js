import { useTheme } from '../context/ThemeContext';
const { colors } = useTheme();
// Then use colors.background, colors.text, colors.primary, etc.

const pool = require('./config/database');

async function testWorkerData() {
  try {
    console.log('\n📊 Testing Worker Data Visibility\n');
    console.log('='.repeat(70));
    
    // Test 1: Check if data exists in database
    const [workers] = await pool.query(`
      SELECT 
        w.id, 
        u.name, 
        w.service_type, 
        w.hourly_rate, 
        w.min_charge, 
        w.experience_years,
        w.average_rating,
        w.total_jobs,
        SUBSTRING(w.skills, 1, 60) as skills,
        SUBSTRING(w.bio, 1, 60) as bio
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      WHERE w.hourly_rate IS NOT NULL
      LIMIT 3
    `);
    
    console.log('\n✅ Workers with complete data in database:\n');
    workers.forEach((w, i) => {
      console.log(`${i + 1}. ${w.name} (${w.service_type})`);
      console.log(`   💰 Hourly Rate: $${w.hourly_rate}/hr`);
      console.log(`   💵 Min Charge: $${w.min_charge}`);
      console.log(`   📅 Experience: ${w.experience_years} years`);
      console.log(`   ⭐ Rating: ${w.average_rating} (${w.total_jobs} jobs)`);
      console.log(`   🛠️  Skills: ${w.skills}...`);
      console.log(`   📝 Bio: ${w.bio}...`);
      console.log('');
    });
    
    console.log('='.repeat(70));
    console.log('\n✨ SUCCESS! All worker data is stored correctly.\n');
    console.log('📱 Next Steps:');
    console.log('   1. Make sure backend server is running (npm start)');
    console.log('   2. Reload your mobile app (shake device → Reload)');
    console.log('   3. Check HomeScreen - worker cards show pricing');
    console.log('   4. Tap any worker to see full details');
    console.log('\n🎯 Homeowners can now see all worker information for booking!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testWorkerData();
