package com.skiuo.coreservice.dto;

import com.skiuo.coreservice.entity.Session;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionStatusResponse {
    private Long id;
    private Long userId;
    private String status;
    private String aiModel;
    private String analysisMode;
    private Boolean keepVideo;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer totalChunks;
    private Integer analyzedChunks;

    public static SessionStatusResponse fromEntity(Session session, Integer totalChunks, Integer analyzedChunks) {
        return SessionStatusResponse.builder()
                .id(session.getId())
                .userId(session.getUserId())
                .status(session.getStatus().name())
                .aiModel(session.getAiModel())
                .analysisMode(session.getAnalysisMode() != null ? session.getAnalysisMode().name() : null)
                .keepVideo(session.getKeepVideo())
                .startTime(session.getStartTime())
                .endTime(session.getEndTime())
                .totalChunks(totalChunks)
                .analyzedChunks(analyzedChunks)
                .build();
    }
}
