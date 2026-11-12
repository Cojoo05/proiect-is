package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.AppNotification;
import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.AppNotificationRepository;
import com.proiect.is.proiect_is.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Controller REST pentru sistemul de notificări în aplicație.
 *
 * Endpoint-uri principale:
 *  GET  /api/notifications/user/{userId}          – toate notificările unui user
 *  GET  /api/notifications/user/{userId}/unread   – doar cele necitite
 *  GET  /api/notifications/user/{userId}/count    – număr notificări necitite
 *  POST /api/notifications                        – creează o notificare nouă
 *  POST /api/notifications/calendar-invite        – creează invitații calendar pentru mai mulți useri
 *  PUT  /api/notifications/{id}/read              – marchează o notificare ca citită
 *  PUT  /api/notifications/user/{userId}/read-all – marchează toate ca citite
 *  DELETE /api/notifications/{id}                 – șterge o notificare
 */
@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "*")
public class AppNotificationController {

    @Autowired
    private AppNotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired(required = false)
    private SimpMessagingTemplate messagingTemplate;

    // ── GET: toate notificările unui utilizator ────────────────────────────────

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<AppNotification>> getAllForUser(@PathVariable Long userId) {
        List<AppNotification> notifications =
                notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(userId);
        return ResponseEntity.ok(notifications);
    }

    // ── GET: notificările NECITITE ale unui utilizator ────────────────────────

    @GetMapping("/user/{userId}/unread")
    public ResponseEntity<List<AppNotification>> getUnreadForUser(@PathVariable Long userId) {
        List<AppNotification> unread =
                notificationRepository.findByRecipientUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        return ResponseEntity.ok(unread);
    }

    // ── GET: numărul de notificări necitite ───────────────────────────────────

    @GetMapping("/user/{userId}/count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@PathVariable Long userId) {
        Long count = notificationRepository.countUnreadByUserId(userId);
        Map<String, Long> result = new HashMap<>();
        result.put("unreadCount", count != null ? count : 0L);
        return ResponseEntity.ok(result);
    }

    // ── POST: creează o singură notificare ────────────────────────────────────

    @PostMapping
    public ResponseEntity<AppNotification> createNotification(@RequestBody AppNotification notification) {
        if (notification.getRecipientUserId() == null || notification.getTitle() == null) {
            return ResponseEntity.badRequest().build();
        }
        if (notification.getCreatedAt() == null) {
            notification.setCreatedAt(LocalDateTime.now());
        }
        if (notification.getIsRead() == null) {
            notification.setIsRead(false);
        }
        if (notification.getType() == null) {
            notification.setType("general");
        }

        AppNotification saved = notificationRepository.save(notification);

        // Trimite notificare în timp real prin WebSocket dacă e disponibil
        if (messagingTemplate != null) {
            try {
                messagingTemplate.convertAndSend(
                    "/topic/users/" + notification.getRecipientUserId() + "/notifications",
                    saved
                );
            } catch (Exception ignored) {}
        }

        return ResponseEntity.ok(saved);
    }

    // ── POST: invitații calendar pentru mai mulți utilizatori ─────────────────
    // Payload: { eventId, eventTitle, eventDate, eventStartTime, meetLink,
    //            senderUserId, senderName, attendeeEmails: ["a@b.com", ...] }

    @PostMapping("/calendar-invite")
    public ResponseEntity<Map<String, Object>> sendCalendarInvites(
            @RequestBody Map<String, Object> payload) {

        Map<String, Object> response = new HashMap<>();

        Long senderUserId = payload.get("senderUserId") != null
                ? Long.valueOf(payload.get("senderUserId").toString()) : null;
        String senderName = (String) payload.get("senderName");
        String eventTitle = (String) payload.get("eventTitle");
        String eventDate  = (String) payload.get("eventDate");
        String startTime  = (String) payload.get("eventStartTime");
        String meetLink   = (String) payload.get("meetLink");

        Long eventId = null;
        if (payload.get("eventId") != null) {
            try { eventId = Long.valueOf(payload.get("eventId").toString()); } catch (Exception ignored) {}
        }

        @SuppressWarnings("unchecked")
        List<String> attendeeEmails = payload.get("attendeeEmails") instanceof List
                ? (List<String>) payload.get("attendeeEmails") : Collections.emptyList();

        if (attendeeEmails.isEmpty() || eventTitle == null) {
            response.put("sent", 0);
            response.put("message", "Niciun invitat sau titlu lipsă");
            return ResponseEntity.ok(response);
        }

        int sentCount = 0;
        List<String> notFoundEmails = new ArrayList<>();

        for (String email : attendeeEmails) {
            if (email == null || email.isBlank()) continue;
            String trimmedEmail = email.trim().toLowerCase();

            // Căutăm utilizatorul după email în baza de date
            Optional<User> userOpt = userRepository.findByEmail(trimmedEmail);

            if (userOpt.isPresent()) {
                User recipient = userOpt.get();

                // Evităm să trimitem notificare senderului în sine
                if (senderUserId != null && recipient.getId().equals(senderUserId)) continue;

                String notifTitle = "📅 Invitatie: " + eventTitle;
                String notifMsg = (senderName != null ? senderName : "Cineva") +
                        " te-a invitat la \"" + eventTitle + "\"" +
                        (eventDate != null ? " pe " + eventDate : "") +
                        (startTime != null && !startTime.isBlank() ? " la " + startTime : "") + ".";

                AppNotification notif = new AppNotification(
                        recipient.getId(),
                        senderUserId,
                        senderName,
                        "calendar_invite",
                        notifTitle,
                        notifMsg
                );
                notif.setEventId(eventId);
                notif.setEventTitle(eventTitle);
                notif.setEventDate(eventDate);
                notif.setEventStartTime(startTime);
                notif.setMeetLink(meetLink);
                notif.setCreatedAt(LocalDateTime.now());

                AppNotification saved = notificationRepository.save(notif);
                sentCount++;

                // Trimite prin WebSocket în timp real
                if (messagingTemplate != null) {
                    try {
                        messagingTemplate.convertAndSend(
                            "/topic/users/" + recipient.getId() + "/notifications",
                            saved
                        );
                    } catch (Exception ignored) {}
                }
            } else {
                notFoundEmails.add(trimmedEmail);
            }
        }

        response.put("sent", sentCount);
        response.put("notFoundEmails", notFoundEmails);
        response.put("message", sentCount + " notificari trimise cu succes");
        return ResponseEntity.ok(response);
    }

    // ── PUT: marchează o notificare ca citită ─────────────────────────────────

    @PutMapping("/{id}/read")
    public ResponseEntity<Map<String, Object>> markAsRead(@PathVariable Long id) {
        int updated = notificationRepository.markAsReadById(id);
        Map<String, Object> result = new HashMap<>();
        if (updated > 0) {
            result.put("success", true);
            result.put("message", "Notificare marcata ca citita");
            return ResponseEntity.ok(result);
        }
        result.put("success", false);
        result.put("message", "Notificarea nu a fost gasita");
        return ResponseEntity.notFound().build();
    }

    // ── PUT: marchează TOATE notificările unui user ca citite ─────────────────

    @PutMapping("/user/{userId}/read-all")
    public ResponseEntity<Map<String, Object>> markAllAsRead(@PathVariable Long userId) {
        int updated = notificationRepository.markAllAsReadByUserId(userId);
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("markedCount", updated);
        result.put("message", updated + " notificari marcate ca citite");
        return ResponseEntity.ok(result);
    }

    // ── DELETE: șterge o notificare ───────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(@PathVariable Long id) {
        if (!notificationRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        notificationRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── DELETE: șterge toate notificările citite ale unui user ───────────────

    @DeleteMapping("/user/{userId}/clear-read")
    public ResponseEntity<Map<String, Object>> clearReadNotifications(@PathVariable Long userId) {
        List<AppNotification> all = notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(userId);
        List<AppNotification> readOnes = all.stream()
                .filter(n -> Boolean.TRUE.equals(n.getIsRead()))
                .toList();
        notificationRepository.deleteAll(readOnes);
        Map<String, Object> result = new HashMap<>();
        result.put("deleted", readOnes.size());
        return ResponseEntity.ok(result);
    }
}
