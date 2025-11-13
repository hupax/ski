package com.skiuo.coreservice.repository;

import com.skiuo.coreservice.entity.AnalysisRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnalysisRecordRepository extends JpaRepository<AnalysisRecord, Long> {

    List<AnalysisRecord> findBySessionIdOrderByCreatedAtAsc(Long sessionId);

    List<AnalysisRecord> findByChunkId(Long chunkId);

    List<AnalysisRecord> findBySessionIdAndChunkIdOrderByWindowIndexAsc(Long sessionId, Long chunkId);

    // Get the last analysis record for a session (for context)
    AnalysisRecord findFirstBySessionIdOrderByCreatedAtDesc(Long sessionId);

    // Count total windows analyzed for a session
    long countBySessionId(Long sessionId);

    // Get all analysis records for a session ordered by window index
    List<AnalysisRecord> findAllBySessionIdOrderByWindowIndexAsc(Long sessionId);
}
