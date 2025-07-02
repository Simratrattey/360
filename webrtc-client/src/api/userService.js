import API from './client';

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await API.post('/api/users/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data; // { avatarUrl: ... }
} 