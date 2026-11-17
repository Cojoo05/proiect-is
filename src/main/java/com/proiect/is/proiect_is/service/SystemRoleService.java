package com.proiect.is.proiect_is.service;

import org.springframework.stereotype.Service;

/**
 * Centralizează verificările de rol de sistem, ca logica să nu fie duplicată
 * în controller-e. Rolurile sunt păstrate ca String pe {@code User.role}.
 */
@Service
public class SystemRoleService {

    public static final String ADMIN_ROLE = "ADMIN";
    public static final String USER_ROLE = "USER";

    /**
     * @return true dacă rolul primit are drepturi de administrator.
     */
    public boolean hasAdminAccess(String role) {
        if (role == null) {
            return false;
        }

        String normalized = role.trim().toUpperCase();

        if (normalized.isEmpty() || USER_ROLE.equals(normalized)) {
            return false;
        }

        // Acoperă "ADMIN", "ROLE_ADMIN", "SUPER_ADMIN" etc.
        return normalized.contains(ADMIN_ROLE);
    }
}
