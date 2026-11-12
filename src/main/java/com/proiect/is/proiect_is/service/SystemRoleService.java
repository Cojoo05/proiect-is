package com.proiect.is.proiect_is.service;

import com.proiect.is.proiect_is.model.SystemRole;
import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.SystemRoleRepository;
import com.proiect.is.proiect_is.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class SystemRoleService {

    @Autowired
    private SystemRoleRepository systemRoleRepository;

    @Autowired
    private UserRepository userRepository;

    @PostConstruct
    @Transactional
    public void initDefaultRoles() {
        if (systemRoleRepository.count() == 0) {
            SystemRole adminRole = new SystemRole("Admin", 2, true, "#dc2626", false);
            SystemRole userRole = new SystemRole("User", 0, false, "#5a3d5c", true);
            systemRoleRepository.save(adminRole);
            systemRoleRepository.save(userRole);
        }

        // Standardize any null/blank user roles to default role
        List<User> users = userRepository.findAll();
        boolean changed = false;
        for (User u : users) {
            if (u.getRole() == null || u.getRole().trim().isEmpty()) {
                u.setRole("User");
                changed = true;
            } else if ("ADMIN".equalsIgnoreCase(u.getRole().trim())) {
                u.setRole("Admin");
                changed = true;
            } else if ("USER".equalsIgnoreCase(u.getRole().trim())) {
                u.setRole("User");
                changed = true;
            }
        }
        if (changed) {
            userRepository.saveAll(users);
        }
    }

    public List<Map<String, Object>> getAllRolesWithUserCounts() {
        List<SystemRole> roles = systemRoleRepository.findAll();
        List<User> allUsers = userRepository.findAll().stream()
                .filter(u -> !Boolean.TRUE.equals(u.getArchived()))
                .collect(Collectors.toList());

        return roles.stream().map(role -> {
            long count = allUsers.stream()
                    .filter(u -> u.getRole() != null && u.getRole().equalsIgnoreCase(role.getName()))
                    .count();

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", role.getId());
            map.put("name", role.getName());
            map.put("adminLevel", role.getAdminLevel());
            map.put("hasFullAccess", role.isHasFullAccess());
            map.put("color", role.getColor());
            map.put("isDefault", role.isDefault());
            map.put("canCreateKnowledge", role.isCanCreateKnowledge());
            map.put("createdAt", role.getCreatedAt());
            map.put("userCount", count);
            return map;
        }).collect(Collectors.toList());
    }

    public boolean hasAdminAccess(String roleName) {
        if (roleName == null || roleName.trim().isEmpty()) return false;
        if ("ADMIN".equalsIgnoreCase(roleName.trim())) return true;
        return systemRoleRepository.findByNameIgnoreCase(roleName.trim())
                .map(SystemRole::isHasFullAccess)
                .orElse(false);
    }

    public boolean canCreateKnowledge(String roleName) {
        if (roleName == null || roleName.trim().isEmpty()) return false;
        if ("ADMIN".equalsIgnoreCase(roleName.trim())) return true;
        return systemRoleRepository.findByNameIgnoreCase(roleName.trim())
                .map(r -> r.isHasFullAccess() || r.isCanCreateKnowledge())
                .orElse(false);
    }

    @Transactional
    public SystemRole createRole(SystemRole role) {
        String trimmedName = role.getName() != null ? role.getName().trim() : "";
        if (trimmedName.isEmpty()) {
            throw new IllegalArgumentException("Numele rolului nu poate fi gol!");
        }

        if (systemRoleRepository.findByNameIgnoreCase(trimmedName).isPresent()) {
            throw new IllegalArgumentException("Un rol cu numele '" + trimmedName + "' există deja!");
        }

        role.setName(trimmedName);
        if (role.isHasFullAccess()) {
            role.setAdminLevel(2);
        } else if (role.getAdminLevel() == null) {
            role.setAdminLevel(0);
        }

        if (role.getColor() == null || role.getColor().isBlank()) {
            role.setColor(role.isHasFullAccess() ? "#dc2626" : "#5a3d5c");
        }

        if (role.isDefault()) {
            // Unset previous default role
            systemRoleRepository.findByIsDefaultTrue().ifPresent(prev -> {
                prev.setDefault(false);
                systemRoleRepository.save(prev);
            });
        }

        return systemRoleRepository.save(role);
    }

    @Transactional
    public SystemRole updateRole(Long id, SystemRole roleData) {
        SystemRole existing = systemRoleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rolul nu a fost găsit cu id: " + id));

        String newName = roleData.getName() != null ? roleData.getName().trim() : "";
        if (newName.isEmpty()) {
            throw new IllegalArgumentException("Numele rolului nu poate fi gol!");
        }

        // If name changed, check uniqueness
        if (!existing.getName().equalsIgnoreCase(newName)) {
            if (systemRoleRepository.findByNameIgnoreCase(newName).isPresent()) {
                throw new IllegalArgumentException("Un rol cu numele '" + newName + "' există deja!");
            }

            // Update all users referencing old name
            String oldName = existing.getName();
            List<User> usersToUpdate = userRepository.findAll().stream()
                    .filter(u -> u.getRole() != null && u.getRole().equalsIgnoreCase(oldName))
                    .collect(Collectors.toList());
            usersToUpdate.forEach(u -> u.setRole(newName));
            userRepository.saveAll(usersToUpdate);

            existing.setName(newName);
        }

        // Safety check if changing from fullAccess to non-fullAccess
        if (existing.isHasFullAccess() && !roleData.isHasFullAccess()) {
            List<SystemRole> otherFullAccessRoles = systemRoleRepository.findByHasFullAccessTrue().stream()
                    .filter(r -> !r.getId().equals(existing.getId()))
                    .collect(Collectors.toList());

            if (otherFullAccessRoles.isEmpty()) {
                throw new IllegalStateException("Nu poți retrage drepturile depline ale acestui rol! Trebuie să existe un alt rol cu drepturi depline.");
            }

            Set<String> otherFullAccessNames = otherFullAccessRoles.stream()
                    .map(r -> r.getName().toLowerCase())
                    .collect(Collectors.toSet());

            long usersWithOtherFullAccess = userRepository.findAll().stream()
                    .filter(u -> !Boolean.TRUE.equals(u.getArchived()) && u.getRole() != null && otherFullAccessNames.contains(u.getRole().toLowerCase()))
                    .count();

            if (usersWithOtherFullAccess == 0) {
                throw new IllegalStateException("Nu poți retrage drepturile depline ale acestui rol! Trebuie să existe cel puțin o persoană cu acces la un alt rol cu drepturi depline.");
            }
        }

        existing.setHasFullAccess(roleData.isHasFullAccess());
        existing.setCanCreateKnowledge(roleData.isCanCreateKnowledge());
        existing.setAdminLevel(roleData.isHasFullAccess() ? 2 : (roleData.getAdminLevel() != null ? roleData.getAdminLevel() : 0));

        if (roleData.getColor() != null && !roleData.getColor().isBlank()) {
            existing.setColor(roleData.getColor());
        }

        if (roleData.isDefault() && !existing.isDefault()) {
            systemRoleRepository.findByIsDefaultTrue().ifPresent(prev -> {
                prev.setDefault(false);
                systemRoleRepository.save(prev);
            });
            existing.setDefault(true);
        }

        return systemRoleRepository.save(existing);
    }

    @Transactional
    public void deleteRole(Long id) {
        SystemRole roleToDelete = systemRoleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rolul nu a fost găsit cu id: " + id));

        // Regula critică de siguranță:
        // "nu se poate sterge rolul cu drepturi depline pana cand nu este creat altul si are minim o persoana acces"
        if (roleToDelete.isHasFullAccess()) {
            List<SystemRole> otherFullAccessRoles = systemRoleRepository.findByHasFullAccessTrue().stream()
                    .filter(r -> !r.getId().equals(roleToDelete.getId()))
                    .collect(Collectors.toList());

            if (otherFullAccessRoles.isEmpty()) {
                throw new IllegalStateException("Nu poți șterge acest rol cu drepturi depline! Trebuie să creezi mai întâi un alt rol cu drepturi depline.");
            }

            Set<String> otherFullAccessNames = otherFullAccessRoles.stream()
                    .map(r -> r.getName().toLowerCase())
                    .collect(Collectors.toSet());

            long usersWithOtherFullAccess = userRepository.findAll().stream()
                    .filter(u -> !Boolean.TRUE.equals(u.getArchived()) && u.getRole() != null && otherFullAccessNames.contains(u.getRole().toLowerCase()))
                    .count();

            if (usersWithOtherFullAccess == 0) {
                throw new IllegalStateException("Nu poți șterge acest rol! Trebuie să existe minim o persoană care are acces la un alt rol cu drepturi depline.");
            }
        }

        // Reassign any users who had this role to default role (e.g., "User")
        SystemRole fallbackRole = systemRoleRepository.findByIsDefaultTrue()
                .orElseGet(() -> systemRoleRepository.findAll().stream()
                        .filter(r -> !r.getId().equals(roleToDelete.getId()))
                        .findFirst()
                        .orElse(null));

        String fallbackRoleName = fallbackRole != null ? fallbackRole.getName() : "User";

        List<User> usersToReassign = userRepository.findAll().stream()
                .filter(u -> u.getRole() != null && u.getRole().equalsIgnoreCase(roleToDelete.getName()))
                .collect(Collectors.toList());

        if (!usersToReassign.isEmpty()) {
            usersToReassign.forEach(u -> u.setRole(fallbackRoleName));
            userRepository.saveAll(usersToReassign);
        }

        systemRoleRepository.delete(roleToDelete);
    }
}
