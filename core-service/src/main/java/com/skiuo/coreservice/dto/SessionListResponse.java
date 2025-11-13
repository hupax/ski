package com.skiuo.coreservice.dto;

import com.skiuo.coreservice.entity.Session;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Response DTO for session list in sidebar
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionListResponse {

    private Long id;
    private String title;  // AI-generated title or fallback
    private String status;
    private String aiModel;
    private String analysisMode;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private LocalDateTime updatedAt;

    public static SessionListResponse fromEntity(Session session) {
        return SessionListResponse.builder()
                .id(session.getId())
                .title(session.getTitle() != null && !session.getTitle().isEmpty()
                        ? session.getTitle()
                        : "Untitled Session")  // Fallback title
                .status(session.getStatus().name())
                .aiModel(session.getAiModel())
                .analysisMode(session.getAnalysisMode().name())
                .startTime(session.getStartTime())
                .endTime(session.getEndTime())
                .updatedAt(session.getUpdatedAt())
                .build();
    }

    public static List<SessionListResponse> fromEntities(List<Session> sessions) {
        return sessions.stream()
                .map(SessionListResponse::fromEntity)
                .collect(Collectors.toList());
    }
}
