package com.skiuo.coreservice.repository;

import com.skiuo.coreservice.entity.VideoChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VideoChunkRepository extends JpaRepository<VideoChunk, Long> {

    List<VideoChunk> findBySessionIdOrderByChunkIndexAsc(Long sessionId);

    Optional<VideoChunk> findBySessionIdAndChunkIndex(Long sessionId, Integer chunkIndex);

    List<VideoChunk> findByStatus(VideoChunk.ChunkStatus status);

    void deleteBySessionId(Long sessionId);
}
