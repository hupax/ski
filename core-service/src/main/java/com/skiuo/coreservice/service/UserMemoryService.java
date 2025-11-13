package com.skiuo.coreservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.skiuo.coreservice.entity.UserMemory;
import com.skiuo.coreservice.repository.UserMemoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Iterator;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserMemoryService {

    private final UserMemoryRepository userMemoryRepository;
    private final ObjectMapper objectMapper;

    /**
     * Get user memory by user ID
     *
     * @param userId User ID
     * @return User memory JSON string (empty object if not exists)
     */
    public String getUserMemory(Long userId) {
        return userMemoryRepository.findByUserId(userId)
                .map(UserMemory::getMemoryData)
                .orElse("{}");
    }

    /**
     * Update user memory by merging new data
     *
     * @param userId User ID
     * @param newMemoryJson New memory data JSON string from AI
     * @return Updated memory JSON string
     */
    @Transactional
    public String updateUserMemory(Long userId, String newMemoryJson) {
        try {
            // Parse new memory JSON
            JsonNode newMemory = objectMapper.readTree(newMemoryJson);

            // Get existing memory or create new
            UserMemory userMemory = userMemoryRepository.findByUserId(userId)
                    .orElse(UserMemory.builder()
                            .userId(userId)
                            .memoryData("{}")
                            .build());

            // Parse existing memory
            JsonNode existingMemory = objectMapper.readTree(userMemory.getMemoryData());

            // Merge memories
            JsonNode mergedMemory = mergeMemories(existingMemory, newMemory);

            // Save
            String mergedJson = objectMapper.writeValueAsString(mergedMemory);
            userMemory.setMemoryData(mergedJson);
            userMemoryRepository.save(userMemory);

            log.info("Updated user memory for userId={}, length={}", userId, mergedJson.length());
            return mergedJson;

        } catch (JsonProcessingException e) {
            log.error("Failed to parse/merge user memory JSON: {}", e.getMessage());
            // Return original memory on error
            return getUserMemory(userId);
        }
    }

    /**
     * Merge two memory JSON objects
     * Strategy: Deep merge arrays (avoid duplicates), override primitive values
     *
     * @param existing Existing memory
     * @param newData New memory data
     * @return Merged memory
     */
    private JsonNode mergeMemories(JsonNode existing, JsonNode newData) {
        if (!existing.isObject() || !newData.isObject()) {
            return newData;
        }

        ObjectNode result = existing.deepCopy();

        // Iterate through all fields in new data
        Iterator<Map.Entry<String, JsonNode>> fields = newData.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String fieldName = entry.getKey();
            JsonNode newValue = entry.getValue();

            if (!result.has(fieldName)) {
                // New field, add it
                result.set(fieldName, newValue);
            } else {
                JsonNode existingValue = result.get(fieldName);

                if (existingValue.isObject() && newValue.isObject()) {
                    // Recursively merge objects
                    result.set(fieldName, mergeMemories(existingValue, newValue));
                } else if (existingValue.isArray() && newValue.isArray()) {
                    // Merge arrays (avoid duplicates)
                    result.set(fieldName, mergeArrays(existingValue, newValue));
                } else {
                    // Override with new value
                    result.set(fieldName, newValue);
                }
            }
        }

        return result;
    }

    /**
     * Merge two arrays, avoiding duplicates
     *
     * @param existing Existing array
     * @param newArray New array
     * @return Merged array
     */
    private JsonNode mergeArrays(JsonNode existing, JsonNode newArray) {
        ObjectMapper mapper = new ObjectMapper();
        var resultArray = mapper.createArrayNode();

        // Add all existing items
        existing.forEach(resultArray::add);

        // Add new items that don't exist
        newArray.forEach(newItem -> {
            boolean exists = false;
            for (JsonNode existingItem : existing) {
                if (existingItem.equals(newItem)) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                resultArray.add(newItem);
            }
        });

        return resultArray;
    }

    /**
     * Delete user memory
     *
     * @param userId User ID
     */
    @Transactional
    public void deleteUserMemory(Long userId) {
        userMemoryRepository.deleteByUserId(userId);
        log.info("Deleted user memory for userId={}", userId);
    }

    /**
     * Reset user memory to empty
     *
     * @param userId User ID
     */
    @Transactional
    public void resetUserMemory(Long userId) {
        UserMemory userMemory = userMemoryRepository.findByUserId(userId)
                .orElse(UserMemory.builder()
                        .userId(userId)
                        .memoryData("{}")
                        .build());
        userMemory.setMemoryData("{}");
        userMemoryRepository.save(userMemory);
        log.info("Reset user memory for userId={}", userId);
    }
}
