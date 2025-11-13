package com.skiuo.coreservice.controller;

import com.skiuo.coreservice.client.AuthServiceClient;
import com.skiuo.coreservice.dto.*;
import com.skiuo.coreservice.entity.AnalysisRecord;
import com.skiuo.coreservice.entity.Session;
import com.skiuo.coreservice.entity.VideoChunk;
import com.skiuo.coreservice.repository.SessionRepository;
import com.skiuo.coreservice.repository.VideoChunkRepository;
import com.skiuo.coreservice.service.AnalysisService;
import com.skiuo.coreservice.service.VideoProcessingService;
import com.skiuo.coreservice.service.VideoUploadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/videos")
@Slf4j
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class VideoController {

    private final VideoUploadService videoUploadService;
    private final VideoProcessingService videoProcessingService;
    private final AnalysisService analysisService;
    private final SessionRepository sessionRepository;
    private final VideoChunkRepository videoChunkRepository;
    private final AuthServiceClient authServiceClient;

    /**
     * Upload video chunk
     * POST /api/videos/upload
     */
    @PostMapping("/upload")
    public ResponseEntity<VideoUploadResponse> uploadVideo(
            @RequestHeader("Authorization") String authorization,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "sessionId", required = false) Long sessionId,
            @RequestParam("chunkIndex") Integer chunkIndex,
            @RequestParam(value = "aiModel", defaultValue = "qwen") String aiModel,
            @RequestParam(value = "analysisMode", defaultValue = "SLIDING_WINDOW") String analysisMode,
            @RequestParam(value = "keepVideo", defaultValue = "false") Boolean keepVideo,
            @RequestParam(value = "storageType", defaultValue = "cos") String storageType,
            @RequestParam(value = "duration", required = false) Double duration,
            @RequestParam(value = "isLastChunk", defaultValue = "false") Boolean isLastChunk) {

        try {
            // Validate token and get user
            String token = authorization.replace("Bearer ", "");
            AuthServiceClient.UserInfo user = authServiceClient.validateToken(token);

            if (user == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(VideoUploadResponse.builder()
                                .status("UNAUTHORIZED")
                                .message("Invalid or expired token")
                                .build());
            }

            Long userId = user.getId();

            log.info("Received video upload: sessionId={}, userId={}, chunkIndex={}, size={}",
                    sessionId, userId, chunkIndex, file.getSize());

            // Parse analysis mode
            Session.AnalysisMode mode = Session.AnalysisMode.valueOf(analysisMode.toUpperCase());

            // Create or update session
            Session session = videoUploadService.createOrUpdateSession(
                    sessionId, userId, aiModel, mode, keepVideo, storageType);

            // Save temporary file
            String localPath = videoUploadService.saveTemporaryFile(
                    session.getId(), chunkIndex, file);

            // Create chunk record with empty minioPath (will be set during processing)
            VideoChunk chunk = videoUploadService.createVideoChunk(
                    session.getId(), chunkIndex, "", duration);

            // Start async processing
            videoProcessingService.processVideoChunk(session, chunk, localPath, isLastChunk);

            VideoUploadResponse response = VideoUploadResponse.builder()
                    .sessionId(session.getId())
                    .chunkId(chunk.getId())
                    .status("ACCEPTED")
                    .message("Video upload accepted, processing started")
                    .build();

            return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);

        } catch (Exception e) {
            log.error("Video upload failed: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Get session status
     * GET /api/sessions/{sessionId}
     */
    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<SessionStatusResponse> getSessionStatus(@PathVariable Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        List<VideoChunk> chunks = videoChunkRepository.findBySessionIdOrderByChunkIndexAsc(sessionId);
        long analyzedChunks = chunks.stream()
                .filter(c -> c.getStatus() == VideoChunk.ChunkStatus.ANALYZED ||
                        c.getStatus() == VideoChunk.ChunkStatus.DELETED)
                .count();

        SessionStatusResponse response = SessionStatusResponse.fromEntity(
                session, chunks.size(), (int) analyzedChunks);

        return ResponseEntity.ok(response);
    }

    /**
     * Get analysis records for a session
     * GET /api/sessions/{sessionId}/records
     */
    @GetMapping("/sessions/{sessionId}/records")
    public ResponseEntity<List<AnalysisRecordResponse>> getSessionRecords(@PathVariable Long sessionId) {
        List<AnalysisRecord> records = analysisService.getSessionRecords(sessionId);
        List<AnalysisRecordResponse> response = AnalysisRecordResponse.fromEntities(records);
        return ResponseEntity.ok(response);
    }

    /**
     * Get user sessions
     * GET /api/users/{userId}/sessions
     */
    @GetMapping("/users/{userId}/sessions")
    public ResponseEntity<List<Session>> getUserSessions(@PathVariable Long userId) {
        List<Session> sessions = sessionRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return ResponseEntity.ok(sessions);
    }

    /**
     * Health check
     * GET /api/videos/health
     */
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("Video service is running");
    }
}
