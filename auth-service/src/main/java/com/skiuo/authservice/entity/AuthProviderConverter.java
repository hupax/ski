package com.skiuo.authservice.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA converter for AuthProvider enum
 * Converts enum to lowercase string for database storage
 */
@Converter(autoApply = true)
public class AuthProviderConverter implements AttributeConverter<User.AuthProvider, String> {

    @Override
    public String convertToDatabaseColumn(User.AuthProvider provider) {
        if (provider == null) {
            return null;
        }
        return provider.toString();  // Returns lowercase value
    }

    @Override
    public User.AuthProvider convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isEmpty()) {
            return null;
        }

        // Convert database string to enum
        for (User.AuthProvider provider : User.AuthProvider.values()) {
            if (provider.toString().equals(dbData)) {
                return provider;
            }
        }

        throw new IllegalArgumentException("Unknown provider: " + dbData);
    }
}
