package com.skiuo.coreservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_memory")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserMemory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    /**
     * User memory data stored as JSON
     * Structure: {
     *   "habits": { "programming_languages": [...], "tools": [...], "coding_style": [...] },
     *   "knowledge": { "expertise": [...], "learning": [...], "gaps": [...] },
     *   "behavior_patterns": { "workflows": [...], "problem_solving": [...], "project_types": [...] }
     * }
     */
    @Column(name = "memory_data", columnDefinition = "jsonb", nullable = false)
    private String memoryData;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (memoryData == null) {
            memoryData = "{}";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
