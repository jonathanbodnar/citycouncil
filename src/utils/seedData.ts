import { supabase } from '../services/supabase';

export const createTestUsers = async () => {
  const testUsers = [
    {
      email: 'admin@shoutout.com',
      password: 'password123',
      fullName: 'Admin User',
      userType: 'admin' as const,
    },
    {
      email: 'tucker@shoutout.com',
      password: 'password123',
      fullName: 'Tucker Carlson',
      userType: 'talent' as const,
    },
    {
      email: 'john@example.com',
      password: 'password123',
      fullName: 'John Smith',
      userType: 'user' as const,
    },
    {
      email: 'corp@company.com',
      password: 'password123',
      fullName: 'Corporate User',
      userType: 'user' as const,
    },
  ];

  console.log('Creating test users...');
  
  for (const user of testUsers) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: {
            full_name: user.fullName,
            user_type: user.userType,
          },
        },
      });

      if (error) {
        console.error(`Error creating user ${user.email}:`, error.message);
        continue;
      }

      if (data.user) {
        // Insert user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              email: user.email,
              full_name: user.fullName,
              user_type: user.userType,
            },
          ]);

        if (profileError) {
          console.error(`Error creating profile for ${user.email}:`, profileError.message);
          continue;
        }

        // Create additional profiles based on user type
        if (user.userType === 'user') {
          await supabase
            .from('user_profiles')
            .insert([{ 
              user_id: data.user.id,
              is_corporate: user.email.includes('corp'),
              company_name: user.email.includes('corp') ? 'ACME Corporation' : null,
            }]);
        } else if (user.userType === 'talent') {
          // Create talent profile for Tucker
          const { data: talentData, error: talentError } = await supabase
            .from('talent_profiles')
            .insert([{
              user_id: data.user.id,
              category: 'tv-host',
              bio: 'Former Fox News host and political commentator. Get a personalized message from me for any occasion!',
              pricing: 299.99,
              fulfillment_time_hours: 48,
              charity_percentage: 10,
              charity_name: 'Wounded Warrior Project',
              is_featured: true,
              total_orders: 25,
              fulfilled_orders: 23,
              average_rating: 4.8,
              is_active: true,
            }])
            .select()
            .single();

          if (!talentError && talentData) {
            // Add social accounts
            await supabase
              .from('social_accounts')
              .insert([
                {
                  talent_id: talentData.id,
                  platform: 'twitter',
                  handle: '@TuckerCarlson',
                },
                {
                  talent_id: talentData.id,
                  platform: 'facebook',
                  handle: 'TuckerCarlsonOfficial',
                },
              ]);
          }
        }

        console.log(`✅ Created user: ${user.email}`);
      }
    } catch (error) {
      console.error(`Error with user ${user.email}:`, error);
    }
  }

  console.log('Test user creation complete!');
};

export const createTestCharity = async () => {
  try {
    const { error } = await supabase
      .from('charities')
      .insert([{
        name: 'Wounded Warrior Project',
        ein: '20-2370934',
        description: 'Supporting wounded veterans and their families',
        website: 'https://www.woundedwarriorproject.org',
        account_holder_name: 'Wounded Warrior Project',
        account_number: '1234567890',
        routing_number: '123456789',
        bank_name: 'Bank of America',
        is_verified: true,
      }]);

    if (error) {
      console.error('Error creating charity:', error);
    } else {
      console.log('✅ Created test charity');
    }
  } catch (error) {
    console.error('Error creating charity:', error);
  }
};

export const seedTestData = async () => {
  await createTestCharity();
  await createTestUsers();
};
