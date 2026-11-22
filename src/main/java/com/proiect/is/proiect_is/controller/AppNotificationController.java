package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.DTO.AppNotificationRequestDTO;
import com.proiect.is.proiect_is.DTO.AppNotificationResponseDTO;
import com.proiect.is.proiect_is.mapper.AppNotificationMapper;
import com.proiect.is.proiect_is.model.AppNotification;
import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.AppNotificationRepository;
import com.proiect.is.proiect_is.repository.UserRepository;
import com.proiect.is.proiect_is.service.AppNotificationService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Controller REST Enterprise pentru gestionarea fluxului de notificări în aplicație
 * și distribuirea alertelor în timp real prin WebSocket (STOMP).
 *
 * Oferă suport complet pentru:
 * <ul>
 *   <li>Notificări pentru invitații în calendar și apeluri Google Meet</li>
 *   <li>Alerte de sistem și sarcini alocate</li>
 *   <li>Numărare dinamică a notificărilor necitite pentru bara superioară (TopBar)</li>
 *   <li>Marcare ca citite individual sau în masă</li>
 *   <li>Endpoint-uri DTO serializate cu timp relativ ("Acum 5 minute")</li>
 * </ul>
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "*")
public class AppNotificationController {

    private final AppNotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final AppNotificationService notificationService;
    private final AppNotificationMapper notificationMapper;

    @Autowired
    public AppNotificationController(
            AppNotificationRepository notificationRepository,
            UserRepository userRepository,
            @Autowired(required = false) SimpMessagingTemplate messagingTemplate,
            AppNotificationService notificationService,
            AppNotificationMapper notificationMapper) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
        this.notificationService = notificationService;
        this.notificationMapper = notificationMapper;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Endpoint-uri de Citire Notificări
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Returnează toate notificările unui utilizator, ordonate descrescător după data emiterii.
     *
     * @param userId ID-ul utilizatorului
     * @return 200 OK cu lista de entități AppNotification
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<AppNotification>> getAllForUser(@PathVariable Long userId) {
        List<AppNotification> notifications = notificationService.getAllForUser(userId);
        return ResponseEntity.ok(notifications);
    }

    /**
     * Returnează notificările utilizatorului formatate ca DTO îmbogățit cu proprietatea 'timeAgo'.
     *
     * @param userId ID-ul utilizatorului
     * @return 200 OK cu lista de AppNotificationResponseDTO
     */
    @GetMapping("/dto/user/{userId}")
    public ResponseEntity<List<AppNotificationResponseDTO>> getAllDTOsForUser(@PathVariable Long userId) {
        List<AppNotificationResponseDTO> dtos = notificationService.getAllDTOsForUser(userId);
        return ResponseEntity.ok(dtos);
    }

    /**
     * Returnează doar notificările necitite ale unui utilizator.
     *
     * @param userId ID-ul utilizatorului
     * @return 200 OK cu lista de notificări necitite
     */
    @GetMapping("/user/{userId}/unread")
    public ResponseEntity<List<AppNotification>> getUnreadForUser(@PathVariable Long userId) {
        List<AppNotification> unread = notificationService.getUnreadForUser(userId);
        return ResponseEntity.ok(unread);
    }

    /**
     * Returnează numărul de notificări necitite pentru afișarea insignei (badge) pe clopoțelul din TopBar.
     *
     * @param userId ID-ul utilizatorului
     * @return Harta cu proprietatea "unreadCount"
     */
    @GetMapping("/user/{userId}/count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@PathVariable Long userId) {
        Long count = notificationService.getUnreadCount(userId);
        Map<String, Long> result = new HashMap<>();
        result.put("unreadCount", count != null ? count : 0L);
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Creare Notificări & Distribuție WebSocket
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Creează o nouă notificare și o distribuie în timp real prin WebSocket.
     *
     * @param notification Entitatea notificării
     * @return 200 OK cu notificarea persistată sau 400 Bad Request
     */
    @PostMapping
    public ResponseEntity<AppNotification> createNotification(@RequestBody AppNotification notification) {
        if (notification.getRecipientUserId() == null || notification.getTitle() == null) {
            return ResponseEntity.badRequest().build();
        }
        AppNotification saved = notificationService.createNotification(notification);
        return ResponseEntity.ok(saved);
    }

    /**
     * Creează o nouă notificare validată prin DTO.
     *
     * @param requestDTO Corpul cererii validat cu @Valid
     * @return 200 OK cu AppNotificationResponseDTO
     */
    @PostMapping("/dto")
    public ResponseEntity<AppNotificationResponseDTO> createNotificationDTO(@Valid @RequestBody AppNotificationRequestDTO requestDTO) {
        AppNotificationResponseDTO created = notificationService.createNotificationFromDTO(requestDTO);
        return ResponseEntity.ok(created);
    }

    /**
     * Creează și expediază invitații de calendar către mai mulți colegi prin adresele lor de email.
     * Caută fiecare utilizator în baza de date și generează notificarea + transmiterea WebSocket.
     *
     * @param payload Datele invitației
     * @return Harta cu numărul de invitații trimise și eventualele adrese negăsite
     */
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

            Optional<User> userOpt = userRepository.findByEmail(trimmedEmail);

            if (userOpt.isPresent()) {
                User recipient = userOpt.get();

                if (senderUserId != null && recipient.getId().equals(senderUserId)) continue;

                String notifTitle = "📅 Invitație: " + eventTitle;
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
        response.put("message", sentCount + " notificări trimise cu succes.");
        return ResponseEntity.ok(response);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Marcare ca Citit și Curățare
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Marchează o singură notificare ca fiind citită.
     *
     * @param id ID-ul notificării
     * @return 200 OK dacă a fost actualizată sau 404 Not Found
     */
    @PutMapping("/{id}/read")
    public ResponseEntity<Map<String, Object>> markAsRead(@PathVariable Long id) {
        int updated = notificationRepository.markAsReadById(id);
        Map<String, Object> result = new HashMap<>();
        if (updated > 0) {
            result.put("success", true);
            result.put("message", "Notificare marcată ca citită.");
            return ResponseEntity.ok(result);
        }
        result.put("success", false);
        result.put("message", "Notificarea nu a fost găsită.");
        return ResponseEntity.notFound().build();
    }

    /**
     * Marchează toate notificările unui utilizator ca fiind citite.
     *
     * @param userId ID-ul utilizatorului
     * @return 200 OK cu numărul de notificări actualizate
     */
    @PutMapping("/user/{userId}/read-all")
    public ResponseEntity<Map<String, Object>> markAllAsRead(@PathVariable Long userId) {
        int updated = notificationService.markAllAsRead(userId);
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("markedCount", updated);
        result.put("message", updated + " notificări marcate ca citite.");
        return ResponseEntity.ok(result);
    }

    /**
     * Șterge definitiv o notificare după ID.
     *
     * @param id ID-ul notificării
     * @return 204 No Content dacă a fost ștearsă sau 404 Not Found
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(@PathVariable Long id) {
        boolean deleted = notificationService.deleteNotification(id);
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }

    /**
     * Șterge în masă toate notificările citite ale unui utilizator.
     *
     * @param userId ID-ul utilizatorului
     * @return 200 OK cu numărul de notificări șterse
     */
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
