// Mock users data for development when Supabase is not configured
export const mockUsers = [
  {
    user_id: 1,
    username: 'admin',
    password: 'Admin123!',
    first_name: 'System',
    last_name: 'Administrator',
    email: 'admin@example.com',
    phone_number: '+639123456789',
    role: 'admin',
    created_by: 'system',
    created_at: new Date().toISOString()
  },
  {
    user_id: 2,
    username: 'staff1',
    password: 'Staff123!',
    first_name: 'John',
    last_name: 'Doe',
    email: 'staff1@example.com',
    phone_number: '+639987654321',
    role: 'staff',
    created_by: 'admin',
    created_at: new Date().toISOString()
  }
];

// Mock staff members array that we can modify
let mockStaffMembers = [mockUsers[1]];

export const mockSupabase = {
  from: (table) => {
    if (table === 'users') {
      return {
        select: (columns) => ({
          or: (conditions) => ({
            eq: (column, value) => ({
              single: () => {
                const user = mockUsers.find(u => 
                  (u.username === value || u.email === value) && u.password === value
                );
                return Promise.resolve({ data: user, error: user ? null : new Error('User not found') });
              }
            })
          }),
          eq: (column, value) => ({
            single: () => {
              if (column === 'username' || column === 'email') {
                const user = mockUsers.find(u => u[column] === value);
                return Promise.resolve({ data: user, error: null });
              }
              return Promise.resolve({ data: null, error: null });
            },
            order: (column, options) => ({
              then: (callback) => {
                const staff = mockStaffMembers;
                callback({ data: staff, error: null });
              }
            })
          }),
          order: (column, options) => ({
            then: (callback) => {
              const staff = mockStaffMembers;
              callback({ data: staff, error: null });
            }
          })
        }),
        insert: (data) => ({
          select: () => ({
            single: () => {
              const newUser = {
                user_id: mockUsers.length + 1,
                ...data[0],
                created_at: new Date().toISOString()
              };
              mockUsers.push(newUser);
              mockStaffMembers.push(newUser);
              return Promise.resolve({ data: newUser, error: null });
            }
          })
        }),
        delete: () => ({
          eq: (column, value) => ({
            then: (callback) => {
              const index = mockStaffMembers.findIndex(u => u.user_id === value);
              if (index > -1) {
                mockStaffMembers.splice(index, 1);
              }
              callback({ error: null });
            }
          })
        })
      };
    }
    return {
      select: () => ({ single: () => Promise.resolve({ data: null, error: null }) })
    };
  }
};