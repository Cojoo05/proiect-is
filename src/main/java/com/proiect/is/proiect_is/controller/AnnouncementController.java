package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.Announcement;
import com.proiect.is.proiect_is.model.AppNotification;
import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.AnnouncementRepository;
import com.proiect.is.proiect_is.repository.AppNotificationRepository;
import com.proiect.is.proiect_is.repository.UserRepository;
import com.proiect.is.proiect_is.service.SystemRoleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*", "https://*.vercel.app"})
@RestController
@RequestMapping("/api/announcements")
public class AnnouncementController {

    private static final String ADMIN_ONLY_MESSAGE =
            "Doar administratorii pot publica, edita sau sterge anunturi.";
    private static final String TITLE_REQUIRED_MESSAGE =
            "Titlul anuntului este obligatoriu!";
    private static final String NOT_FOUND_MESSAGE =
            "Anuntul nu a fost gasit.";

    private final AnnouncementRepository announcementRepository;
    private final UserRepository userRepository;
    private final AppNotificationRepository notificationRepository;
    private final SystemRoleService systemRoleService;

    @Autowired(required = false)
    private SimpMessagingTemplate messagingTemplate;

    public AnnouncementController(AnnouncementRepository announcementRepository,
                                  UserRepository userRepository,
                                  AppNotificationRepository notificationRepository,
                                  SystemRoleService systemRoleService) {
        this.announcementRepository = announcementRepository;
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
        this.systemRoleService = systemRoleService;
    }

    @GetMapping
    public List<Announcement> getAnnouncements() {
        return announcementRepository.findAllByOrderByPinnedDescCreatedAtDesc();
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getAnnouncement(@PathVariable Long id) {
        return announcementRepository.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> notFound());
    }

    @PostMapping
    public ResponseEntity<?> createAnnouncement(@RequestBody Announcement request) {
        Long userId = extractUserId(request);
        User author = findAdmin(userId);
        if (author == null) {
            return forbidden();
        }

        if (isBlank(request.getTitle())) {
            return badRequest(TITLE_REQUIRED_MESSAGE);
        }

        Announcement announcement = new Announcement();
        // Orice id trimis din client este ignorat: îl lasă pe Hibernate să genereze unul nou.
        announcement.setId(null);
        announcement.setTitle(request.getTitle().trim());
        announcement.setContent(request.getContent());
        announcement.setPinned(request.getPinned() != null ? request.getPinned() : Boolean.FALSE);
        announcement.setCreatedAt(LocalDateTime.now());
        announcement.setUpdatedAt(null);
        announcement.setAuthor(author);

        Announcement saved = announcementRepository.save(announcement);

        // Notificăm toți ceilalți utilizatori că a fost publicat un anunț nou.
        notifyOtherUsers(author, saved);

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * Creează câte o notificare „Anunț nou” pentru fiecare utilizator, cu excepția autorului.
     * Notificarea este salvată în bază de date (pentru dropdown-ul de Notificări) și
     * publicată și prin WebSocket, pentru actualizare în timp real.
     */
    private void notifyOtherUsers(User author, Announcement announcement) {
        String senderName = author.getUsername();
        String notifTitle = "Anunț nou: " + announcement.getTitle();

        String preview = buildPreview(announcement.getContent());
        String notifMsg = (senderName != null ? senderName : "Cineva") +
                " a publicat un anunț nou." + (preview != null ? " " + preview : "");

        for (User recipient : userRepository.findAll()) {
            // Autorul nu primește notificare pentru propriul anunț.
            if (recipient.getId() != null && recipient.getId().equals(author.getId())) {
                continue;
            }

            AppNotification notif = new AppNotification(
                    recipient.getId(),
                    author.getId(),
                    senderName,
                    "announcement",
                    notifTitle,
                    notifMsg
            );
            notif.setCreatedAt(LocalDateTime.now());

            AppNotification savedNotif = notificationRepository.save(notif);

            if (messagingTemplate != null) {
                try {
                    messagingTemplate.convertAndSend(
                            "/topic/users/" + recipient.getId() + "/notifications",
                            savedNotif
                    );
                } catch (Exception ignored) {
                    // WebSocket-ul este opțional; notificarea e deja salvată în DB.
                }
            }
        }
    }

    /** Primele ~140 de caractere din conținut, pe o singură linie. */
    private String buildPreview(String content) {
        if (content == null || content.isBlank()) {
            return null;
        }
        String clean = content.trim().replaceAll("\\s+", " ");
        if (clean.length() > 140) {
            clean = clean.substring(0, 140) + "…";
        }
        return clean;
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateAnnouncement(@PathVariable Long id,
                                                @RequestParam(required = false) Long userId,
                                                @RequestBody Announcement request) {
        User admin = findAdmin(userId);
        if (admin == null) {
            return forbidden();
        }

        Announcement announcement = announcementRepository.findById(id).orElse(null);
        if (announcement == null) {
            return notFound();
        }

        if (request.getTitle() != null && isBlank(request.getTitle())) {
            return badRequest(TITLE_REQUIRED_MESSAGE);
        }

        if (request.getTitle() != null) {
            announcement.setTitle(request.getTitle().trim());
        }
        if (request.getContent() != null) {
            announcement.setContent(request.getContent());
        }
        if (request.getPinned() != null) {
            announcement.setPinned(request.getPinned());
        }

        announcement.setUpdatedAt(LocalDateTime.now());

        return ResponseEntity.ok(announcementRepository.save(announcement));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAnnouncement(@PathVariable Long id,
                                                @RequestParam(required = false) Long userId) {
        User admin = findAdmin(userId);
        if (admin == null) {
            return forbidden();
        }

        if (!announcementRepository.existsById(id)) {
            return notFound();
        }

        announcementRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Anuntul a fost sters."));
    }

    private Long extractUserId(Announcement request) {
        if (request == null || request.getAuthor() == null) {
            return null;
        }
        return request.getAuthor().getId();
    }

    /**
     * @return userul admin dacă există și are drepturi de admin, altfel null.
     */
    private User findAdmin(Long userId) {
        if (userId == null) {
            return null;
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null || !systemRoleService.hasAdminAccess(user.getRole())) {
            return null;
        }

        return user;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("message", ADMIN_ONLY_MESSAGE));
    }

    private ResponseEntity<?> badRequest(String message) {
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    private ResponseEntity<?> notFound() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("message", NOT_FOUND_MESSAGE));
    }
}
