import API from './client';

export const getConversations = () => API.get('/conversations');
export const createConversation = (data) => API.post('/conversations', data);
export const deleteConversation = (conversationId) => API.delete(`/conversations/${conversationId}`);
export const getConversation = (conversationId) => API.get(`/conversations/${conversationId}`);
export const updateConversation = (conversationId, data) => API.put(`/conversations/${conversationId}`, data);
export const markConversationAsRead = (conversationId) => API.put(`/conversations/${conversationId}/read`);
export const addMembers = (conversationId, memberIds) => API.post(`/conversations/${conversationId}/members`, { memberIds });
export const removeMembers = (conversationId, memberIds) => API.delete(`/conversations/${conversationId}/members`, { data: { memberIds } });
export const addMember = (id, userId) => API.post(`/conversations/${id}/members`, { userId });
export const removeMember = (id, userId) => API.delete(`/conversations/${id}/members/${userId}`);
export const addAdmin = (id, userId) => API.post(`/conversations/${id}/admins`, { userId });
export const removeAdmin = (id, userId) => API.delete(`/conversations/${id}/admins/${userId}`); 