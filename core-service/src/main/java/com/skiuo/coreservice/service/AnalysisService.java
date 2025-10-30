package com.skiuo.coreservice.service;

import com.skiuo.coreservice.entity.AnalysisRecord;
import com.skiuo.coreservice.repository.AnalysisRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class AnalysisService {

    private final AnalysisRecordRepository analysisRecordRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Save analysis record to database
     *
     * @param sessionId     Session ID
     * @param chunkId       Chunk ID
     * @param windowIndex   Window index (null for full analysis)
     * @param content       Analysis result content
     * @param startOffset   Start time offset
     * @param endOffset     End time offset
     * @param videoPath     MinIO object path
     * @return Saved record
     */
    @Transactional
    public AnalysisRecord saveAnalysisRecord(Long sessionId, Long chunkId, Integer windowIndex,
                                              String content, Double startOffset, Double endOffset, String videoPath) {
        AnalysisRecord record = AnalysisRecord.builder()
                .sessionId(sessionId)
                .chunkId(chunkId)
                .windowIndex(windowIndex)
                .content(content)
                .startTimeOffset(startOffset)
                .endTimeOffset(endOffset)
                .videoPath(videoPath)
                .build();

        record = analysisRecordRepository.save(record);

        log.info("Saved analysis record: sessionId={}, chunkId={}, windowIndex={}, length={}, videoPath={}",
                sessionId, chunkId, windowIndex, content.length(), videoPath);

        return record;
    }

    /**
     * Send streaming result to WebSocket clients
     *
     * @param sessionId   Session ID
     * @param windowIndex Window index
     * @param content     Content chunk
     */
    public void sendStreamingResult(Long sessionId, Integer windowIndex, String content) {
        try {
            Map<String, Object> message = new HashMap<>();
            message.put("type", "analysis_result");
            message.put("sessionId", sessionId);
            message.put("windowIndex", windowIndex);
            message.put("content", content);
            message.put("timestamp", System.currentTimeMillis());

            // Send to session-specific topic
            String destination = "/topic/session/" + sessionId;
            messagingTemplate.convertAndSend(destination, message);

            log.debug("Sent streaming result to WebSocket: sessionId={}, windowIndex={}, length={}",
                    sessionId, windowIndex, content.length());

        } catch (Exception e) {
            log.error("Failed to send WebSocket message: {}", e.getMessage());
            // Don't throw exception - WebSocket failures shouldn't break processing
        }
    }

    /**
     * Get all analysis records for a session
     */
    public List<AnalysisRecord> getSessionRecords(Long sessionId) {
        return analysisRecordRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
    }

    /**
     * Get analysis records for a specific chunk
     */
    public List<AnalysisRecord> getChunkRecords(Long sessionId, Long chunkId) {
        return analysisRecordRepository.findBySessionIdAndChunkIdOrderByWindowIndexAsc(sessionId, chunkId);
    }

    /**
     * Get the last analysis record for context
     */
    public AnalysisRecord getLastAnalysisRecord(Long sessionId) {
        return analysisRecordRepository.findFirstBySessionIdOrderByCreatedAtDesc(sessionId);
    }

    /**
     * Count total windows analyzed for a session
     */
    public long countAnalyzedWindows(Long sessionId) {
        return analysisRecordRepository.countBySessionId(sessionId);
    }
}
