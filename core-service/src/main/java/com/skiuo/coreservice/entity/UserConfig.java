package com.skiuo.coreservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_configs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserConfig {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "default_ai_model", length = 50)
    private String defaultAiModel;

    @Column(name = "default_analysis_mode", length = 20)
    @Enumerated(EnumType.STRING)
    private Session.AnalysisMode defaultAnalysisMode;

    @Column(name = "default_keep_video")
    private Boolean defaultKeepVideo;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (defaultAiModel == null) {
            defaultAiModel = "qwen";
        }
        if (defaultAnalysisMode == null) {
            defaultAnalysisMode = Session.AnalysisMode.SLIDING_WINDOW;
        }
        if (defaultKeepVideo == null) {
            defaultKeepVideo = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
