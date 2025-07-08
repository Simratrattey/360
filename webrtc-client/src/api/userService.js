import API from './client';

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await API.post('/users/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data; // { avatarUrl: ... }
}

export async function updateSettings(settings) {
  try {
    const response = await API.put('/users/settings', settings);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to save settings'
    };
  }
}

export async function getUserSettings() {
  const response = await API.get('/users/settings');
  return response.data;
} 