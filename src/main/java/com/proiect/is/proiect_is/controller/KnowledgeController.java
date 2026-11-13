package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.KnowledgeCategory;
import com.proiect.is.proiect_is.model.KnowledgeNote;
import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.KnowledgeCategoryRepository;
import com.proiect.is.proiect_is.repository.KnowledgeRepository;
import com.proiect.is.proiect_is.repository.UserRepository;
import com.proiect.is.proiect_is.service.SystemRoleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/knowledge")
@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*", "https://*.vercel.app"})
public class KnowledgeController {

    private final KnowledgeRepository knowledgeRepository;
    private final KnowledgeCategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final SystemRoleService systemRoleService;

    @Autowired
    public KnowledgeController(KnowledgeRepository knowledgeRepository,
                               KnowledgeCategoryRepository categoryRepository,
                               UserRepository userRepository,
                               SystemRoleService systemRoleService) {
        this.knowledgeRepository = knowledgeRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.systemRoleService = systemRoleService;
    }

    // --- CATEGORIES: GET ALL ---
    @GetMapping("/categories")
    public ResponseEntity<List<KnowledgeCategory>> getCategories() {
        List<KnowledgeCategory> categories = categoryRepository.findAllByOrderByNameAsc();
        if (categories.isEmpty()) {
            // Seed default categories
            List<String> defaults = List.of("General", "Documentație", "Tutorial", "Ghid");
            for (String name : defaults) {
                if (!categoryRepository.existsByNameIgnoreCase(name)) {
                    categoryRepository.save(new KnowledgeCategory(name));
                }
            }
            categories = categoryRepository.findAllByOrderByNameAsc();
        }
        return ResponseEntity.ok(categories);
    }

    // --- CATEGORIES: CREATE (ADMIN ONLY) ---
    @PostMapping("/categories")
    public ResponseEntity<?> createCategory(@RequestBody Map<String, Object> body, @RequestParam Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Utilizatorul nu a fost găsit!"));
        }

        String userRole = user.getRole() != null ? user.getRole().trim() : "User";
        boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);
        if (!isAdmin) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Doar un administrator poate adăuga categorii!"));
        }

        String name = (String) body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Numele categoriei este obligatoriu!"));
        }

        String trimmedName = name.trim();
        if (categoryRepository.existsByNameIgnoreCase(trimmedName)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Categoria '" + trimmedName + "' există deja!"));
        }

        KnowledgeCategory category = new KnowledgeCategory(trimmedName);
        KnowledgeCategory saved = categoryRepository.save(category);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // --- CATEGORIES: DELETE (ADMIN ONLY) ---
    @DeleteMapping("/categories/{id}")
    public ResponseEntity<?> deleteCategory(@PathVariable Long id, @RequestParam Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Utilizatorul nu a fost găsit!"));
        }

        String userRole = user.getRole() != null ? user.getRole().trim() : "User";
        boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);
        if (!isAdmin) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Doar un administrator poate șterge categorii!"));
        }

        if (!categoryRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        categoryRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Categoria a fost ștearsă cu succes!"));
    }

    // --- GET ACCESSIBLE KNOWLEDGE NOTES ---
    @GetMapping
    public ResponseEntity<List<KnowledgeNote>> getNotes(@RequestParam(required = false) Long userId) {
        List<KnowledgeNote> allNotes = knowledgeRepository.findAllByOrderByIsPinnedDescCreatedAtDesc();

        if (userId == null) {
            // If no user context, return only public notes
            List<KnowledgeNote> publicNotes = allNotes.stream()
                    .filter(n -> n.getAllowedRolesToView() == null || "ALL".equalsIgnoreCase(n.getAllowedRolesToView()))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(publicNotes);
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().build();
        }

        String userRole = user.getRole() != null ? user.getRole().trim() : "User";
        boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);

        // Filter based on role or user permissions
        List<KnowledgeNote> accessibleNotes = allNotes.stream()
                .filter(note -> isNoteVisibleToUser(note, user, userRole, isAdmin))
                .collect(Collectors.toList());

        return ResponseEntity.ok(accessibleNotes);
    }

    // --- GET SINGLE NOTE ---
    @GetMapping("/{id}")
    public ResponseEntity<KnowledgeNote> getNoteById(@PathVariable Long id, @RequestParam(required = false) Long userId) {
        KnowledgeNote note = knowledgeRepository.findById(id).orElse(null);
        if (note == null) {
            return ResponseEntity.notFound().build();
        }

        if (userId != null) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                String userRole = user.getRole() != null ? user.getRole().trim() : "User";
                boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);
                if (!isNoteVisibleToUser(note, user, userRole, isAdmin)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                }
            }
        }

        return ResponseEntity.ok(note);
    }

    // --- CREATE KNOWLEDGE NOTE ---
    @PostMapping
    public ResponseEntity<?> createNote(@RequestBody Map<String, Object> body) {
        String title = (String) body.get("title");
        String content = (String) body.get("content");
        String category = body.get("category") != null ? (String) body.get("category") : "General";
        Long creatorId = Long.valueOf(body.get("creatorId").toString());
        String youtubeUrl = (String) body.get("youtubeUrl");
        String imagesJson = (String) body.get("imagesJson");
        String allowedRolesToView = body.get("allowedRolesToView") != null ? (String) body.get("allowedRolesToView") : "ALL";
        String allowedUserIdsToView = body.get("allowedUserIdsToView") != null ? (String) body.get("allowedUserIdsToView") : "";
        String allowedRolesToEdit = body.get("allowedRolesToEdit") != null ? (String) body.get("allowedRolesToEdit") : "ADMIN_CREATOR";
        String allowedUserIdsToEdit = body.get("allowedUserIdsToEdit") != null ? (String) body.get("allowedUserIdsToEdit") : "";
        boolean isPinned = body.get("isPinned") != null && Boolean.parseBoolean(body.get("isPinned").toString());
        String itemType = body.get("itemType") != null ? (String) body.get("itemType") : "NOTE";
        String fileName = (String) body.get("fileName");
        String fileType = (String) body.get("fileType");
        Long fileSize = body.get("fileSize") != null ? Long.valueOf(body.get("fileSize").toString()) : null;
        String fileData = (String) body.get("fileData");

        if (title == null || title.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Titlul este obligatoriu!"));
        }

        User creator = userRepository.findById(creatorId).orElse(null);
        if (creator == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Utilizatorul creator nu a fost găsit!"));
        }

        String userRole = creator.getRole() != null ? creator.getRole().trim() : "User";
        boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);

        // Check if role has permission to create knowledge notes
        if (!isAdmin && !systemRoleService.canCreateKnowledge(userRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Rolul tău nu are permisiunea de a crea notițe în Knowledge!"));
        }

        KnowledgeNote note = new KnowledgeNote();
        note.setTitle(title.trim());
        note.setContent(content != null ? content.trim() : "");
        note.setCategory(category.trim());
        note.setCreator(creator);
        note.setCreatedAt(LocalDateTime.now());
        note.setUpdatedAt(LocalDateTime.now());
        note.setPinned(isPinned);
        note.setItemType(itemType);
        note.setFileName(fileName);
        note.setFileType(fileType);
        note.setFileSize(fileSize);
        note.setFileData(fileData);
        note.setYoutubeUrl(youtubeUrl != null ? youtubeUrl.trim() : null);
        note.setImagesJson(imagesJson);
        note.setAllowedRolesToView(allowedRolesToView != null && !allowedRolesToView.trim().isEmpty() ? allowedRolesToView.trim() : "ALL");
        note.setAllowedUserIdsToView(allowedUserIdsToView != null ? allowedUserIdsToView.trim() : "");
        note.setAllowedRolesToEdit(allowedRolesToEdit != null && !allowedRolesToEdit.trim().isEmpty() ? allowedRolesToEdit.trim() : "ADMIN_CREATOR");
        note.setAllowedUserIdsToEdit(allowedUserIdsToEdit != null ? allowedUserIdsToEdit.trim() : "");

        KnowledgeNote saved = knowledgeRepository.save(note);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // --- UPDATE KNOWLEDGE NOTE ---
    @PutMapping("/{id}")
    public ResponseEntity<?> updateNote(@PathVariable Long id,
                                        @RequestBody Map<String, Object> body,
                                        @RequestParam Long userId) {
        KnowledgeNote note = knowledgeRepository.findById(id).orElse(null);
        if (note == null) {
            return ResponseEntity.notFound().build();
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Utilizatorul nu a fost găsit!"));
        }

        String userRole = user.getRole() != null ? user.getRole().trim() : "User";
        boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);
        boolean isCreator = note.getCreator() != null && note.getCreator().getId().equals(userId);
        boolean isUserIdAllowedToEdit = isUserIdAllowed(note.getAllowedUserIdsToEdit(), userId);
        boolean isRoleAllowedToEdit = isRoleAllowed(note.getAllowedRolesToEdit(), userRole);

        boolean canEdit = isAdmin || isCreator || isUserIdAllowedToEdit || isRoleAllowedToEdit;
        if (!canEdit) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Nu ai permisiunea de a edita această notiță!"));
        }

        if (body.containsKey("title") && body.get("title") != null) {
            note.setTitle(body.get("title").toString().trim());
        }
        if (body.containsKey("content")) {
            note.setContent(body.get("content") != null ? body.get("content").toString().trim() : "");
        }
        if (body.containsKey("category") && body.get("category") != null) {
            note.setCategory(body.get("category").toString().trim());
        }
        if (body.containsKey("youtubeUrl")) {
            note.setYoutubeUrl(body.get("youtubeUrl") != null ? body.get("youtubeUrl").toString().trim() : null);
        }
        if (body.containsKey("imagesJson")) {
            note.setImagesJson((String) body.get("imagesJson"));
        }
        if (body.containsKey("fileName")) {
            note.setFileName(body.get("fileName") != null ? body.get("fileName").toString() : null);
        }
        if (body.containsKey("fileType")) {
            note.setFileType(body.get("fileType") != null ? body.get("fileType").toString() : null);
        }
        if (body.containsKey("fileSize")) {
            note.setFileSize(body.get("fileSize") != null ? Long.valueOf(body.get("fileSize").toString()) : null);
        }
        if (body.containsKey("fileData")) {
            note.setFileData(body.get("fileData") != null ? body.get("fileData").toString() : null);
        }
        if (body.containsKey("allowedRolesToView") && body.get("allowedRolesToView") != null) {
            note.setAllowedRolesToView(body.get("allowedRolesToView").toString().trim());
        }
        if (body.containsKey("allowedUserIdsToView")) {
            note.setAllowedUserIdsToView(body.get("allowedUserIdsToView") != null ? body.get("allowedUserIdsToView").toString().trim() : "");
        }
        if (body.containsKey("allowedRolesToEdit") && body.get("allowedRolesToEdit") != null) {
            note.setAllowedRolesToEdit(body.get("allowedRolesToEdit").toString().trim());
        }
        if (body.containsKey("allowedUserIdsToEdit")) {
            note.setAllowedUserIdsToEdit(body.get("allowedUserIdsToEdit") != null ? body.get("allowedUserIdsToEdit").toString().trim() : "");
        }
        if (body.containsKey("isPinned")) {
            note.setPinned(Boolean.parseBoolean(body.get("isPinned").toString()));
        }

        note.setUpdatedAt(LocalDateTime.now());
        KnowledgeNote updated = knowledgeRepository.save(note);
        return ResponseEntity.ok(updated);
    }

    // --- DELETE KNOWLEDGE NOTE ---
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteNote(@PathVariable Long id, @RequestParam Long userId) {
        KnowledgeNote note = knowledgeRepository.findById(id).orElse(null);
        if (note == null) {
            return ResponseEntity.notFound().build();
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Utilizatorul nu a fost găsit!"));
        }

        String userRole = user.getRole() != null ? user.getRole().trim() : "User";
        boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);
        boolean isCreator = note.getCreator() != null && note.getCreator().getId().equals(userId);
        boolean isUserIdAllowedToEdit = isUserIdAllowed(note.getAllowedUserIdsToEdit(), userId);
        boolean isRoleAllowedToEdit = isRoleAllowed(note.getAllowedRolesToEdit(), userRole);

        boolean canDelete = isAdmin || isCreator || isUserIdAllowedToEdit || isRoleAllowedToEdit;
        if (!canDelete) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Nu ai permisiunea de a șterge această notiță!"));
        }

        knowledgeRepository.delete(note);
        return ResponseEntity.ok(Map.of("message", "Notița a fost ștearsă cu succes!"));
    }

    // --- DOWNLOAD DRIVE FILE ---
    @GetMapping("/{id}/download")
    public ResponseEntity<?> downloadFile(@PathVariable Long id) {
        KnowledgeNote note = knowledgeRepository.findById(id).orElse(null);
        if (note == null || note.getFileData() == null) {
            return ResponseEntity.notFound().build();
        }
        try {
            byte[] data = java.util.Base64.getDecoder().decode(note.getFileData());
            String fileName = note.getFileName() != null ? note.getFileName() : "document";
            String contentType = note.getFileType() != null ? note.getFileType() : "application/octet-stream";
            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename=\"" + fileName + "\"")
                    .header("Content-Type", contentType)
                    .body(data);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Eroare la descărcarea fișierului!"));
        }
    }

    // --- CHECK USER PERMISSION TO CREATE NOTES ---
    @GetMapping("/permissions")
    public ResponseEntity<Map<String, Object>> getPermissions(@RequestParam Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().build();
        }

        String userRole = user.getRole() != null ? user.getRole().trim() : "User";
        boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);
        boolean canCreate = isAdmin || systemRoleService.canCreateKnowledge(userRole);

        Map<String, Object> perms = new HashMap<>();
        perms.put("canCreate", canCreate);
        perms.put("isAdmin", isAdmin);
        perms.put("role", userRole);
        return ResponseEntity.ok(perms);
    }

    // --- HELPER: CHECK IF NOTE IS VISIBLE TO USER ---
    private boolean isNoteVisibleToUser(KnowledgeNote note, User user, String userRole, boolean isAdmin) {
        if (isAdmin) return true;
        if (note.getCreator() != null && note.getCreator().getId().equals(user.getId())) return true;

        // Check if specific user is allowed
        if (isUserIdAllowed(note.getAllowedUserIdsToView(), user.getId())) {
            return true;
        }

        String allowed = note.getAllowedRolesToView();
        if (allowed == null || allowed.trim().isEmpty() || "ALL".equalsIgnoreCase(allowed.trim())) {
            return true;
        }

        return isRoleAllowed(allowed, userRole);
    }

    // --- HELPER: MATCH ROLE IN COMMA-SEPARATED STRING ---
    private boolean isRoleAllowed(String allowedString, String userRole) {
        if (allowedString == null || allowedString.trim().isEmpty()) return false;
        if ("ALL".equalsIgnoreCase(allowedString.trim())) return true;

        String[] roles = allowedString.split(",");
        for (String r : roles) {
            if (r.trim().equalsIgnoreCase(userRole.trim())) {
                return true;
            }
        }
        return false;
    }

    // --- HELPER: MATCH USER ID IN COMMA-SEPARATED STRING ---
    private boolean isUserIdAllowed(String allowedUserIds, Long userId) {
        if (allowedUserIds == null || allowedUserIds.trim().isEmpty() || userId == null) return false;
        String[] ids = allowedUserIds.split(",");
        String target = String.valueOf(userId);
        for (String idStr : ids) {
            if (idStr.trim().equals(target)) {
                return true;
            }
        }
        return false;
    }
}
