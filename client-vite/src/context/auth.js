// src/services/auth.js
export const facultyLogin = async (department_name, password) => {
  try {
    const res = await fetch('http://localhost:5001/api/faculty-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department_name, password })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      localStorage.setItem('faculty_token', data.token); 
      return { success: true, data };
    } else {
      return { success: false, error: data.message || 'Login failed' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
};
