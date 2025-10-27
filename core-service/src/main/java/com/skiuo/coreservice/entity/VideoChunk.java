package com.skiuo.coreservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "video_chunks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VideoChunk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "chunk_index", nullable = false)
    private Integer chunkIndex;

    @Column(name = "minio_path", nullable = false, length = 500)
    private String minioPath;

    @Column(name = "duration")
    private Integer duration;

    @Column(name = "status", length = 20)
    @Enumerated(EnumType.STRING)
    private ChunkStatus status;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    @Column(name = "analyzed_at")
    private LocalDateTime analyzedAt;

    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
        if (status == null) {
            status = ChunkStatus.UPLOADED;
        }
    }

    public enum ChunkStatus {
        UPLOADED,
        ANALYZING,
        ANALYZED,
        DELETED
    }
}
