const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function seedWorkers() {
  try {
    const dbName = process.env.DB_NAME || 'hifix_db';
    await pool.query(`USE ${dbName}`);

    // Sample workers data
    const workers = [
      {
        name: 'John Smith',
        email: 'john.painter@hifix.com',
        phone: '+1234567890',
        password: 'password123',
        service_type: 'painter',
        experience_years: 8,
        hourly_rate: 45.00,
        min_charge: 100.00,
        bio: 'Professional painter with 8+ years experience. Specialized in interior and exterior painting, wallpaper installation, and decorative finishes.',
        skills: 'Interior Painting, Exterior Painting, Wallpaper, Spray Painting, Color Consultation',
        latitude: 40.7128,
        longitude: -74.0060,
        city: 'New York',
        state: 'NY',
        verified: true,
        total_jobs: 156,
        average_rating: 4.8
      },
      {
        name: 'Mike Johnson',
        email: 'mike.electric@hifix.com',
        phone: '+1234567891',
        password: 'password123',
        service_type: 'electrician',
        experience_years: 12,
        hourly_rate: 65.00,
        min_charge: 150.00,
        bio: 'Licensed electrician with over 12 years of experience. Expert in residential and commercial electrical work, wiring, and panel upgrades.',
        skills: 'Electrical Wiring, Panel Upgrades, Lighting Installation, Troubleshooting, Smart Home Setup',
        latitude: 40.7580,
        longitude: -73.9855,
        city: 'New York',
        state: 'NY',
        verified: true,
        total_jobs: 243,
        average_rating: 4.9
      },
      {
        name: 'David Wilson',
        email: 'david.plumber@hifix.com',
        phone: '+1234567892',
        password: 'password123',
        service_type: 'plumber',
        experience_years: 10,
        hourly_rate: 55.00,
        min_charge: 120.00,
        bio: 'Certified plumber offering reliable plumbing services. Specialized in leak repairs, drain cleaning, and fixture installations.',
        skills: 'Leak Repair, Drain Cleaning, Fixture Installation, Water Heater Service, Pipe Replacement',
        latitude: 40.7489,
        longitude: -73.9680,
        city: 'New York',
        state: 'NY',
        verified: true,
        total_jobs: 198,
        average_rating: 4.7
      },
      {
        name: 'Robert Brown',
        email: 'robert.carpenter@hifix.com',
        phone: '+1234567893',
        password: 'password123',
        service_type: 'carpenter',
        experience_years: 15,
        hourly_rate: 50.00,
        min_charge: 110.00,
        bio: 'Master carpenter with 15+ years experience. Custom furniture, cabinetry, and home renovations are my specialties.',
        skills: 'Custom Furniture, Cabinetry, Door & Window Installation, Deck Building, Trim Work',
        latitude: 40.7306,
        longitude: -73.9352,
        city: 'New York',
        state: 'NY',
        verified: true,
        total_jobs: 187,
        average_rating: 4.9
      },
      {
        name: 'James Davis',
        email: 'james.handyman@hifix.com',
        phone: '+1234567894',
        password: 'password123',
        service_type: 'handyman',
        experience_years: 6,
        hourly_rate: 40.00,
        min_charge: 80.00,
        bio: 'Versatile handyman ready to help with all your home repair and maintenance needs. No job too small!',
        skills: 'General Repairs, Furniture Assembly, Drywall Repair, Minor Plumbing, Minor Electrical',
        latitude: 40.7614,
        longitude: -73.9776,
        city: 'New York',
        state: 'NY',
        verified: true,
        total_jobs: 142,
        average_rating: 4.6
      },
      {
        name: 'Thomas Martinez',
        email: 'thomas.hvac@hifix.com',
        phone: '+1234567895',
        password: 'password123',
        service_type: 'hvac',
        experience_years: 11,
        hourly_rate: 70.00,
        min_charge: 160.00,
        bio: 'Certified HVAC technician with expertise in heating, cooling, and ventilation systems. Fast, reliable service.',
        skills: 'AC Repair, Heating Repair, Installation, Maintenance, Duct Cleaning, Thermostat Installation',
        latitude: 40.7282,
        longitude: -73.7949,
        city: 'New York',
        state: 'NY',
        verified: true,
        total_jobs: 221,
        average_rating: 4.8
      }
    ];

    const salt = await bcrypt.genSalt(10);

    for (const worker of workers) {
      // Check if user already exists
      const [existingUsers] = await pool.query(
        'SELECT id FROM users WHERE email = ?',
        [worker.email]
      );

      let userId;
      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
        console.log(`User ${worker.email} already exists, skipping...`);
      } else {
        // Create user
        const hashedPassword = await bcrypt.hash(worker.password, salt);
        const [userResult] = await pool.query(
          'INSERT INTO users (name, email, phone, password, user_type) VALUES (?, ?, ?, ?, ?)',
          [worker.name, worker.email, worker.phone, hashedPassword, 'worker']
        );
        userId = userResult.insertId;
        console.log(`Created user: ${worker.name}`);
      }

      // Check if worker profile exists
      const [existingWorkers] = await pool.query(
        'SELECT id FROM workers WHERE user_id = ?',
        [userId]
      );

      if (existingWorkers.length === 0) {
        // Create worker profile
        await pool.query(
          `INSERT INTO workers (
            user_id, service_type, experience_years, hourly_rate, min_charge, 
            bio, skills, latitude, longitude, city, state, verified, 
            total_jobs, average_rating, availability_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            worker.service_type,
            worker.experience_years,
            worker.hourly_rate,
            worker.min_charge,
            worker.bio,
            worker.skills,
            worker.latitude,
            worker.longitude,
            worker.city,
            worker.state,
            worker.verified,
            worker.total_jobs,
            worker.average_rating,
            'available'
          ]
        );
        console.log(`Created worker profile for: ${worker.name}`);
      } else {
        console.log(`Worker profile for ${worker.name} already exists, skipping...`);
      }
    }

    console.log('\n✅ Worker seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding workers:', error);
    process.exit(1);
  }
}

seedWorkers();
