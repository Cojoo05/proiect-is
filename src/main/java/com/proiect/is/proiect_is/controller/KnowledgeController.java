package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.KnowledgeCategory;
import com.proiect.is.proiect_is.model.KnowledgeFolder;
import com.proiect.is.proiect_is.model.KnowledgeNote;
import com.proiect.is.proiect_is.model.SystemRole;
import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.KnowledgeCategoryRepository;
import com.proiect.is.proiect_is.repository.KnowledgeFolderRepository;
import com.proiect.is.proiect_is.repository.KnowledgeRepository;
import com.proiect.is.proiect_is.repository.SystemRoleRepository;
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
    private final KnowledgeFolderRepository folderRepository;
    private final UserRepository userRepository;
    private final SystemRoleService systemRoleService;
    private final SystemRoleRepository systemRoleRepository;

    @Autowired
    public KnowledgeController(KnowledgeRepository knowledgeRepository,
                               KnowledgeCategoryRepository categoryRepository,
                               KnowledgeFolderRepository folderRepository,
                               UserRepository userRepository,
                               SystemRoleService systemRoleService,
                               SystemRoleRepository systemRoleRepository) {
        this.knowledgeRepository = knowledgeRepository;
        this.categoryRepository = categoryRepository;
        this.folderRepository = folderRepository;
        this.userRepository = userRepository;
        this.systemRoleService = systemRoleService;
        this.systemRoleRepository = systemRoleRepository;
    }

    // --- FOLDERS: GET ALL ACCESSIBLE ---
    @GetMapping("/folders")
    public ResponseEntity<List<KnowledgeFolder>> getFolders(@RequestParam(required = false) Long userId) {
        List<KnowledgeFolder> allFolders = folderRepository.findAllByOrderByNameAsc();
        if (userId == null) {
            List<KnowledgeFolder> publicFolders = allFolders.stream()
                    .filter(f -> isFolderVisibleToUser(f, null, "User", false))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(publicFolders);
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().build();
        }

        String userRole = user.getRole() != null ? user.getRole().trim() : "User";
        boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);

        List<KnowledgeFolder> accessibleFolders = allFolders.stream()
                .filter(f -> isFolderVisibleToUser(f, user, userRole, isAdmin))
                .collect(Collectors.toList());
        return ResponseEntity.ok(accessibleFolders);
    }

    // --- FOLDERS: CREATE ---
    @PostMapping("/folders")
    public ResponseEntity<?> createFolder(@RequestBody Map<String, Object> body, @RequestParam Long userId) {
        String name = (String) body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Numele folderului este obligatoriu!"));
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Utilizatorul nu a fost găsit!"));
        }

        String userRole = user.getRole() != null ? user.getRole().trim() : "User";
        boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);

        Long parentId = null;
        if (body.get("parentId") != null && !body.get("parentId").toString().isEmpty()) {
            parentId = Long.valueOf(body.get("parentId").toString());
        }

        // Check Creation Permission:
        KnowledgeFolder parent = null;
        if (parentId == null) {
            boolean canCreateRoot = isAdmin || systemRoleService.canCreateKnowledge(userRole);
            if (!canCreateRoot) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Nu ai permisiunea de a crea foldere în Rădăcină! Doar rolurile autorizate din sistem pot crea aici."));
            }
        } else {
            parent = folderRepository.findById(parentId).orElse(null);
            if (parent == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Folderul părinte nu a fost găsit!"));
            }
            if (!canUserWriteInFolder(parent, user, userRole, isAdmin)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Nu ai permisiunea de a adăuga subfoldere în folderul '" + parent.getName() + "'!"));
            }
        }

        String defaultView = (parent != null) ? parent.getAllowedRolesToView() : "ALL";
        String allowedRolesToView = body.get("allowedRolesToView") != null && !body.get("allowedRolesToView").toString().trim().isEmpty()
                ? body.get("allowedRolesToView").toString().trim()
                : defaultView;
        String allowedRolesToWrite = body.get("allowedRolesToWrite") != null && !body.get("allowedRolesToWrite").toString().trim().isEmpty()
                ? body.get("allowedRolesToWrite").toString().trim()
                : "ADMIN_CREATOR";
        String allowedRolesToEdit = body.get("allowedRolesToEdit") != null && !body.get("allowedRolesToEdit").toString().trim().isEmpty()
                ? body.get("allowedRolesToEdit").toString().trim()
                : "ADMIN_CREATOR";

        KnowledgeFolder folder = new KnowledgeFolder(name.trim(), parentId, user, allowedRolesToView, allowedRolesToWrite, allowedRolesToEdit);
        KnowledgeFolder saved = folderRepository.save(folder);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // --- FOLDERS: RENAME / UPDATE PERMISSIONS / MOVE ---
    @PutMapping("/folders/{id}")
    public ResponseEntity<?> renameFolder(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @RequestParam(required = false) Long userId) {
        KnowledgeFolder folder = folderRepository.findById(id).orElse(null);
        if (folder == null) {
            return ResponseEntity.notFound().build();
        }

        if (userId != null) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                String userRole = user.getRole() != null ? user.getRole().trim() : "User";
                boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);
                if (!canUserEditFolder(folder, user, userRole, isAdmin)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "Nu ai permisiunea de a edita acest folder!"));
                }
            }
        }

        if (body.containsKey("name")) {
            String name = (String) body.get("name");
            if (name != null && !name.trim().isEmpty()) {
                folder.setName(name.trim());
            }
        }

        if (body.containsKey("allowedRolesToView")) {
            Object v = body.get("allowedRolesToView");
            folder.setAllowedRolesToView(v != null ? v.toString().trim() : "ALL");
        }
        if (body.containsKey("allowedRolesToWrite")) {
            Object w = body.get("allowedRolesToWrite");
            folder.setAllowedRolesToWrite(w != null ? w.toString().trim() : "ADMIN_CREATOR");
        }
        if (body.containsKey("allowedRolesToEdit")) {
            Object e = body.get("allowedRolesToEdit");
            folder.setAllowedRolesToEdit(e != null ? e.toString().trim() : "ADMIN_CREATOR");
        }

        if (body.containsKey("parentId")) {
            Object pid = body.get("parentId");
            Long targetParentId = (pid != null && !pid.toString().isEmpty()) ? Long.valueOf(pid.toString()) : null;
            if (targetParentId != null) {
                if (targetParentId.equals(id)) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Un folder nu poate fi mutat în el însuși!"));
                }
                if (isDescendantOf(targetParentId, id)) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Un folder nu poate fi mutat într-unul dintre subfolderele sale!"));
                }
                if (!folderRepository.existsById(targetParentId)) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Folderul destinație nu există!"));
                }
            }
            folder.setParentId(targetParentId);
        }

        folder.setUpdatedAt(LocalDateTime.now());
        KnowledgeFolder saved = folderRepository.save(folder);
        return ResponseEntity.ok(saved);
    }

    // --- FOLDERS: MOVE TO ANOTHER FOLDER / ROOT ---
    @PutMapping("/folders/{id}/move")
    public ResponseEntity<?> moveFolder(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @RequestParam(required = false) Long userId) {
        KnowledgeFolder folder = folderRepository.findById(id).orElse(null);
        if (folder == null) {
            return ResponseEntity.notFound().build();
        }

        if (userId != null) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                String userRole = user.getRole() != null ? user.getRole().trim() : "User";
                boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);
                if (!canUserEditFolder(folder, user, userRole, isAdmin)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "Nu ai permisiunea de a muta acest folder!"));
                }
            }
        }

        Object pid = body.get("parentId");
        Long targetParentId = (pid != null && !pid.toString().isEmpty()) ? Long.valueOf(pid.toString()) : null;

        if (targetParentId != null) {
            if (targetParentId.equals(id)) {
                return ResponseEntity.badRequest().body(Map.of("message", "Un folder nu poate fi mutat în el însuși!"));
            }
            if (isDescendantOf(targetParentId, id)) {
                return ResponseEntity.badRequest().body(Map.of("message", "Un folder nu poate fi mutat într-unul dintre subfolderele sale!"));
            }
            if (!folderRepository.existsById(targetParentId)) {
                return ResponseEntity.badRequest().body(Map.of("message", "Folderul destinație nu există!"));
            }
        }

        folder.setParentId(targetParentId);
        folder.setUpdatedAt(LocalDateTime.now());
        KnowledgeFolder saved = folderRepository.save(folder);
        return ResponseEntity.ok(saved);
    }

    private boolean isDescendantOf(Long candidateParentId, Long folderId) {
        Long curr = candidateParentId;
        while (curr != null) {
            if (curr.equals(folderId)) {
                return true;
            }
            KnowledgeFolder f = folderRepository.findById(curr).orElse(null);
            if (f == null) break;
            curr = f.getParentId();
        }
        return false;
    }

    // --- FOLDERS: DELETE (RECURSIVE) ---
    @DeleteMapping("/folders/{id}")
    public ResponseEntity<?> deleteFolder(
            @PathVariable Long id,
            @RequestParam(required = false) Long userId) {
        KnowledgeFolder folder = folderRepository.findById(id).orElse(null);
        if (folder == null) {
            return ResponseEntity.notFound().build();
        }

        if (userId != null) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                String userRole = user.getRole() != null ? user.getRole().trim() : "User";
                boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);
                if (!canUserEditFolder(folder, user, userRole, isAdmin)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "Nu ai permisiunea de a șterge acest folder!"));
                }
            }
        }

        deleteFolderRecursive(id);
        return ResponseEntity.ok(Map.of("message", "Folderul a fost șters cu succes!"));
    }

    private void deleteFolderRecursive(Long folderId) {
        List<KnowledgeFolder> children = folderRepository.findByParentId(folderId);
        for (KnowledgeFolder child : children) {
            deleteFolderRecursive(child.getId());
        }
        List<KnowledgeNote> notes = knowledgeRepository.findByFolderId(folderId);
        knowledgeRepository.deleteAll(notes);
        folderRepository.deleteById(folderId);
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
    public ResponseEntity<?> createNote(
            @RequestParam(value = "userId", required = false) Long userIdParam,
            @RequestBody Map<String, Object> body) {
        String title = (String) body.get("title");
        String content = (String) body.get("content");
        String category = body.get("category") != null ? (String) body.get("category") : "General";

        Long creatorId = null;
        if (body.get("creatorId") != null && !body.get("creatorId").toString().isEmpty()) {
            creatorId = Long.valueOf(body.get("creatorId").toString());
        } else if (body.get("userId") != null && !body.get("userId").toString().isEmpty()) {
            creatorId = Long.valueOf(body.get("userId").toString());
        } else if (userIdParam != null) {
            creatorId = userIdParam;
        }

        if (creatorId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Utilizatorul creator este obligatoriu!"));
        }
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

        Long folderId = null;
        if (body.get("folderId") != null && !body.get("folderId").toString().isEmpty()) {
            folderId = Long.valueOf(body.get("folderId").toString());
        }

        // Check if role has permission to create knowledge notes / files
        if (folderId == null) {
            if (!isAdmin && !systemRoleService.canCreateKnowledge(userRole)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Rolul tău nu are permisiunea de a adăuga conținut în Rădăcină!"));
            }
        } else {
            KnowledgeFolder parent = folderRepository.findById(folderId).orElse(null);
            if (parent == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Folderul destinație nu a fost găsit!"));
            }
            if (!canUserWriteInFolder(parent, creator, userRole, isAdmin)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Nu ai permisiunea de a adăuga conținut în folderul '" + parent.getName() + "'!"));
            }
            // Automatically inherit parent folder's view permissions if not explicitly set
            if (body.get("allowedRolesToView") == null || body.get("allowedRolesToView").toString().trim().isEmpty()) {
                allowedRolesToView = parent.getAllowedRolesToView();
            }
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
        note.setFolderId(folderId);

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
        if (body.containsKey("folderId")) {
            Object fid = body.get("folderId");
            note.setFolderId(fid != null && !fid.toString().isEmpty() ? Long.valueOf(fid.toString()) : null);
        }

        note.setUpdatedAt(LocalDateTime.now());
        KnowledgeNote updated = knowledgeRepository.save(note);
        return ResponseEntity.ok(updated);
    }

    // --- MOVE NOTE / ITEM TO ANOTHER FOLDER / ROOT ---
    @PutMapping("/{id}/move")
    public ResponseEntity<?> moveNote(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @RequestParam(required = false) Long userId) {
        KnowledgeNote note = knowledgeRepository.findById(id).orElse(null);
        if (note == null) {
            return ResponseEntity.notFound().build();
        }

        if (userId != null) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                String userRole = user.getRole() != null ? user.getRole().trim() : "User";
                boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);
                boolean isCreator = note.getCreator() != null && note.getCreator().getId().equals(userId);
                boolean isUserIdAllowedToEdit = isUserIdAllowed(note.getAllowedUserIdsToEdit(), userId);
                boolean isRoleAllowedToEdit = isRoleAllowed(note.getAllowedRolesToEdit(), userRole);
                if (!isAdmin && !isCreator && !isUserIdAllowedToEdit && !isRoleAllowedToEdit) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("message", "Nu ai permisiunea de a muta această notiță!"));
                }
            }
        }

        Object fid = body.get("folderId");
        Long targetFolderId = (fid != null && !fid.toString().isEmpty()) ? Long.valueOf(fid.toString()) : null;

        if (targetFolderId != null && !folderRepository.existsById(targetFolderId)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Folderul destinație nu există!"));
        }

        note.setFolderId(targetFolderId);
        note.setUpdatedAt(LocalDateTime.now());
        KnowledgeNote saved = knowledgeRepository.save(note);
        return ResponseEntity.ok(saved);
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

    // --- DOWNLOAD / OPEN DRIVE FILE OR LINK ---
    @GetMapping("/{id}/download")
    public ResponseEntity<?> downloadFile(@PathVariable Long id) {
        KnowledgeNote note = knowledgeRepository.findById(id).orElse(null);
        if (note == null || note.getFileData() == null || note.getFileData().trim().isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        try {
            String dataStr = note.getFileData().trim();
            // Dacă resursa este un link extern (Google Docs, Sheets, PDF online), redirecționăm
            if (dataStr.startsWith("http://") || dataStr.startsWith("https://")) {
                return ResponseEntity.status(HttpStatus.FOUND)
                        .location(java.net.URI.create(dataStr))
                        .build();
            }

            byte[] data = java.util.Base64.getDecoder().decode(dataStr);
            String fileName = note.getFileName() != null ? note.getFileName() : "document.pdf";
            String contentType = note.getFileType() != null ? note.getFileType() : "application/pdf";
            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename=\"" + fileName + "\"")
                    .header("Content-Type", contentType)
                    .body(data);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Eroare la descărcarea fișierului!"));
        }
    }

    // --- CHECK USER PERMISSIONS FOR KNOWLEDGE / ROOT / FOLDER ---
    @GetMapping("/permissions")
    public ResponseEntity<Map<String, Object>> getPermissions(
            @RequestParam Long userId,
            @RequestParam(required = false) Long folderId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().build();
        }

        String userRole = user.getRole() != null ? user.getRole().trim() : "User";
        boolean isAdmin = "Admin".equalsIgnoreCase(userRole) || systemRoleService.hasAdminAccess(userRole);
        boolean canCreateRoot = isAdmin || systemRoleService.canCreateKnowledge(userRole);

        boolean canWrite = canCreateRoot;
        boolean canEdit = isAdmin;
        boolean isCreator = false;

        if (folderId != null) {
            KnowledgeFolder folder = folderRepository.findById(folderId).orElse(null);
            if (folder != null) {
                canWrite = canUserWriteInFolder(folder, user, userRole, isAdmin);
                canEdit = canUserEditFolder(folder, user, userRole, isAdmin);
                isCreator = folder.getCreator() != null && folder.getCreator().getId().equals(userId);
            }
        }

        List<String> systemRoles = systemRoleRepository.findAll().stream()
                .map(SystemRole::getName)
                .filter(name -> name != null && !name.trim().isEmpty())
                .distinct()
                .collect(Collectors.toList());
        if (systemRoles.isEmpty()) {
            systemRoles = List.of("Admin", "User");
        }

        Map<String, Object> perms = new HashMap<>();
        perms.put("canCreate", canWrite); // Backward compatibility
        perms.put("canCreateRoot", canCreateRoot);
        perms.put("canWrite", canWrite);
        perms.put("canEdit", canEdit);
        perms.put("isAdmin", isAdmin);
        perms.put("isCreator", isCreator);
        perms.put("role", userRole);
        perms.put("systemRoles", systemRoles);
        return ResponseEntity.ok(perms);
    }

    // --- HELPER: CHECK IF SINGLE FOLDER IS VISIBLE ---
    private boolean isSingleFolderVisible(KnowledgeFolder folder, User user, String userRole, boolean isAdmin) {
        if (isAdmin) return true;
        if (user != null && folder.getCreator() != null && folder.getCreator().getId().equals(user.getId())) {
            return true;
        }

        String allowed = folder.getAllowedRolesToView();
        if (allowed == null || allowed.trim().isEmpty() || "ALL".equalsIgnoreCase(allowed.trim())) {
            return true;
        }

        return isRoleAllowed(allowed, userRole);
    }

    // --- HELPER: CHECK IF FOLDER IS VISIBLE (INHERITANCE FROM ALL ANCESTORS) ---
    private boolean isFolderVisibleToUser(KnowledgeFolder folder, User user, String userRole, boolean isAdmin) {
        if (folder == null) return true;
        if (isAdmin) return true;
        if (!isSingleFolderVisible(folder, user, userRole, isAdmin)) {
            return false;
        }

        Long currParentId = folder.getParentId();
        Set<Long> visited = new HashSet<>();
        visited.add(folder.getId());

        while (currParentId != null) {
            if (visited.contains(currParentId)) break;
            visited.add(currParentId);

            KnowledgeFolder parent = folderRepository.findById(currParentId).orElse(null);
            if (parent == null) break;
            if (!isSingleFolderVisible(parent, user, userRole, isAdmin)) {
                return false;
            }
            currParentId = parent.getParentId();
        }

        return true;
    }

    // --- HELPER: CHECK IF USER CAN WRITE IN FOLDER ---
    private boolean canUserWriteInFolder(KnowledgeFolder folder, User user, String userRole, boolean isAdmin) {
        if (isAdmin) return true;
        if (user != null && folder.getCreator() != null && folder.getCreator().getId().equals(user.getId())) {
            return true;
        }

        String allowed = folder.getAllowedRolesToWrite();
        if (allowed == null || allowed.trim().isEmpty() || "ADMIN_CREATOR".equalsIgnoreCase(allowed.trim())) {
            return false;
        }
        if ("ALL".equalsIgnoreCase(allowed.trim())) {
            return true;
        }

        return isRoleAllowed(allowed, userRole);
    }

    // --- HELPER: CHECK IF USER CAN EDIT FOLDER ---
    private boolean canUserEditFolder(KnowledgeFolder folder, User user, String userRole, boolean isAdmin) {
        if (isAdmin) return true;
        if (user != null && folder.getCreator() != null && folder.getCreator().getId().equals(user.getId())) {
            return true;
        }

        String allowed = folder.getAllowedRolesToEdit();
        if (allowed == null || allowed.trim().isEmpty() || "ADMIN_CREATOR".equalsIgnoreCase(allowed.trim())) {
            return false;
        }
        if ("ALL".equalsIgnoreCase(allowed.trim())) {
            return true;
        }

        return isRoleAllowed(allowed, userRole);
    }

    // --- HELPER: CHECK IF NOTE IS VISIBLE TO USER ---
    private boolean isNoteVisibleToUser(KnowledgeNote note, User user, String userRole, boolean isAdmin) {
        if (isAdmin) return true;

        // Parent folder visibility check (if any ancestor is hidden, note is hidden)
        if (note.getFolderId() != null) {
            KnowledgeFolder parentFolder = folderRepository.findById(note.getFolderId()).orElse(null);
            if (parentFolder != null && !isFolderVisibleToUser(parentFolder, user, userRole, isAdmin)) {
                return false;
            }
        }

        if (user != null && note.getCreator() != null && note.getCreator().getId().equals(user.getId())) {
            return true;
        }

        // Check if specific user is allowed
        if (user != null && isUserIdAllowed(note.getAllowedUserIdsToView(), user.getId())) {
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
