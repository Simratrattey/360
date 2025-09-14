import API from './client';

// Request to join a meeting (waiting room)
export const requestToJoin = async (meetingId) => {
  try {
    const response = await API.post(`/meetings/${meetingId}/request-join`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: 'Failed to request join' };
  }
};

// Handle join request (approve/deny) - Host only
export const handleJoinRequest = async (meetingId, requestId, action, reason = null) => {
  try {
    const payload = { requestId, action };
    if (reason) payload.reason = reason;
    
    const response = await API.post(`/meetings/${meetingId}/handle-join-request`, payload);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: 'Failed to handle join request' };
  }
};

// Get pending join requests - Host only
export const getJoinRequests = async (meetingId) => {
  try {
    const response = await API.get(`/meetings/${meetingId}/join-requests`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { error: 'Failed to fetch join requests' };
  }
};

// Approve a join request - Host only
export const approveJoinRequest = async (meetingId, requestId) => {
  return handleJoinRequest(meetingId, requestId, 'approve');
};

// Deny a join request - Host only
export const denyJoinRequest = async (meetingId, requestId, reason = null) => {
  return handleJoinRequest(meetingId, requestId, 'deny', reason);
};

const waitingRoomApi = {
  requestToJoin,
  handleJoinRequest,
  getJoinRequests,
  approveJoinRequest,
  denyJoinRequest
};

export default waitingRoomApi;