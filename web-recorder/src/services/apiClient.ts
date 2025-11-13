import { API_BASE_URL, API_ENDPOINTS } from '../config/constants';
import type {
  VideoUploadRequest,
  VideoUploadResponse,
  SessionStatusResponse,
  AnalysisRecordResponse,
  ServerConfigResponse,
} from '../types';
import { useAuthStore } from '../stores/authStore';

/**
 * Get auth token from store
 */
function getAuthToken(): string | null {
  return useAuthStore.getState().accessToken;
}

/**
 * Upload video chunk to core-service
 */
export async function uploadVideoChunk(
  request: VideoUploadRequest
): Promise<VideoUploadResponse> {
  const formData = new FormData();

  formData.append('file', request.file, `chunk_${request.chunkIndex}.webm`);
  formData.append('chunkIndex', request.chunkIndex.toString());
  formData.append('aiModel', request.aiModel);
  formData.append('analysisMode', request.analysisMode);
  formData.append('keepVideo', request.keepVideo.toString());
  formData.append('storageType', request.storageType);

  if (request.sessionId) {
    formData.append('sessionId', request.sessionId.toString());
  }

  if (request.duration) {
    formData.append('duration', request.duration.toString());
  }

  if (request.isLastChunk !== undefined) {
    formData.append('isLastChunk', request.isLastChunk.toString());
  }

  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated. Please log in first.');
  }

  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.UPLOAD_VIDEO}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const data: VideoUploadResponse = await response.json();
    console.log('Upload successful:', data);
    return data;
  } catch (error) {
    console.error('Error uploading video chunk:', error);
    throw error;
  }
}

/**
 * Get session status
 */
export async function getSessionStatus(
  sessionId: number
): Promise<SessionStatusResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.SESSION_STATUS(sessionId)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get session status: ${response.status}`);
    }

    const data: SessionStatusResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting session status:', error);
    throw error;
  }
}

/**
 * Get analysis records for a session
 */
export async function getSessionRecords(
  sessionId: number
): Promise<AnalysisRecordResponse[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.SESSION_RECORDS(sessionId)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get session records: ${response.status}`);
    }

    const data: AnalysisRecordResponse[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting session records:', error);
    throw error;
  }
}

/**
 * Finish session (analyze remaining video and complete)
 */
export async function finishSession(sessionId: number): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/videos/sessions/${sessionId}/finish`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to finish session: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    console.log('Session finished successfully:', data);
  } catch (error) {
    console.error('Error finishing session:', error);
    throw error;
  }
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.HEALTH}`);
    return response.ok;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

/**
 * Get server configuration (window parameters)
 */
export async function getServerConfig(): Promise<ServerConfigResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/config`);

    if (!response.ok) {
      throw new Error(`Failed to get server config: ${response.status}`);
    }

    const data: ServerConfigResponse = await response.json();
    console.log('Server config retrieved:', data);
    return data;
  } catch (error) {
    console.error('Error getting server config:', error);
    // Return default fallback values
    return {
      windowSize: 15,
      windowStep: 10,
      recommendedChunkDuration: 35,
    };
  }
}
