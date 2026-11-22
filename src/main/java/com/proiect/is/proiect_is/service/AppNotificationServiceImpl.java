package com.proiect.is.proiect_is.service;

import com.proiect.is.proiect_is.DTO.AppNotificationRequestDTO;
import com.proiect.is.proiect_is.DTO.AppNotificationResponseDTO;
import com.proiect.is.proiect_is.mapper.AppNotificationMapper;
import com.proiect.is.proiect_is.model.AppNotification;
import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.AppNotificationRepository;
import com.proiect.is.proiect_is.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Implementarea serviciului {@link AppNotificationService}.
 *
 * Asigură persistența notificărilor în baza de date PostgreSQL și broadcast-ul
 * în timp real prin WebSocket pe canalul specific fiecărui utilizator:
 * {@code /topic/users/{userId}/notifications}.
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
@Service
@Transactional
public class AppNotificationServiceImpl implements AppNotificationService {

    private final AppNotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final AppNotificationMapper appNotificationMapper;

    @Autowired
    public AppNotificationServiceImpl(
            AppNotificationRepository notificationRepository,
            UserRepository userRepository,
            @Autowired(required = false) SimpMessagingTemplate messagingTemplate,
            AppNotificationMapper appNotificationMapper) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
        this.appNotificationMapper = appNotificationMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AppNotification> getAllForUser(Long userId) {
        if (userId == null) {
            return Collections.emptyList();
        }
        return notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AppNotificationResponseDTO> getAllDTOsForUser(Long userId) {
        List<AppNotification> list = getAllForUser(userId);
        return appNotificationMapper.toResponseDTOList(list);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AppNotification> getUnreadForUser(Long userId) {
        if (userId == null) {
            return Collections.emptyList();
        }
        return notificationRepository.findByRecipientUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public Long getUnreadCount(Long userId) {
        if (userId == null) {
            return 0L;
        }
        Long count = notificationRepository.countUnreadByUserId(userId);
        return count != null ? count : 0L;
    }

    @Override
    public AppNotification createNotification(AppNotification notification) {
        if (notification == null || notification.getRecipientUserId() == null || notification.getTitle() == null) {
            throw new IllegalArgumentException("Destinatarul și titlul notificării sunt obligatorii.");
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

        // Trimite notificare în timp real prin WebSocket dacă brokerul este pornit
        if (messagingTemplate != null) {
            try {
                messagingTemplate.convertAndSend(
                        "/topic/users/" + notification.getRecipientUserId() + "/notifications",
                        saved
                );
            } catch (Exception ignored) {}
        }

        return saved;
    }

    @Override
    public AppNotificationResponseDTO createNotificationFromDTO(AppNotificationRequestDTO requestDTO) {
        AppNotification entity = appNotificationMapper.toEntity(requestDTO);
        AppNotification saved = createNotification(entity);
        return appNotificationMapper.toResponseDTO(saved);
    }

    @Override
    public Map<String, Object> createCalendarInvites(Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body == null) {
            response.put("error", "Corpul cererii este gol.");
            return response;
        }

        String eventTitle = (String) body.get("eventTitle");
        String eventDate  = (String) body.get("eventDate");
        String startTime  = (String) body.get("startTime");
        String meetLink   = (String) body.get("meetLink");
        String senderName = (String) body.get("senderName");
        Object rawSenderId = body.get("senderUserId");

        Long senderUserId = null;
        if (rawSenderId instanceof Number) {
            senderUserId = ((Number) rawSenderId).longValue();
        }

        @SuppressWarnings("unchecked")
        List<Object> userIds = (List<Object>) body.get("recipientUserIds");

        if (userIds == null || userIds.isEmpty()) {
            response.put("error", "Lista recipientUserIds este goală.");
            return response;
        }

        List<AppNotification> created = new ArrayList<>();
        String timeStr = (eventDate != null ? eventDate : "") +
                (startTime != null && !startTime.isBlank() ? " la " + startTime : "");

        for (Object item : userIds) {
            Long recipientId = null;
            if (item instanceof Number) {
                recipientId = ((Number) item).longValue();
            } else if (item instanceof String) {
                try {
                    recipientId = Long.parseLong((String) item);
                } catch (NumberFormatException ignored) {}
            }

            if (recipientId == null) continue;
            if (senderUserId != null && senderUserId.equals(recipientId)) continue;

            AppNotification notif = new AppNotification();
            notif.setRecipientUserId(recipientId);
            notif.setSenderUserId(senderUserId);
            notif.setSenderName(senderName != null && !senderName.isBlank() ? senderName : "Un coleg");
            notif.setTitle("Invitație ședință: " + (eventTitle != null ? eventTitle : "Fără titlu"));
            notif.setMessage((senderName != null ? senderName : "Un coleg") +
                    " te-a invitat la o ședință pe " + timeStr + ".");
            notif.setType("calendar_invite");
            notif.setMeetLink(meetLink != null && !meetLink.isBlank() ? meetLink : "/calendar");
            notif.setIsRead(false);
            notif.setCreatedAt(LocalDateTime.now());

            AppNotification saved = notificationRepository.save(notif);
            created.add(saved);

            if (messagingTemplate != null) {
                try {
                    messagingTemplate.convertAndSend("/topic/users/" + recipientId + "/notifications", saved);
                } catch (Exception ignored) {}
            }
        }

        response.put("createdCount", created.size());
        response.put("notifications", created);
        return response;
    }

    @Override
    public AppNotification markAsRead(Long id) {
        return notificationRepository.findById(id).map(notif -> {
            notif.setIsRead(true);
            return notificationRepository.save(notif);
        }).orElse(null);
    }

    @Override
    public int markAllAsRead(Long userId) {
        if (userId == null) {
            return 0;
        }
        return notificationRepository.markAllAsReadByUserId(userId);
    }

    @Override
    public boolean deleteNotification(Long id) {
        if (!notificationRepository.existsById(id)) {
            return false;
        }
        notificationRepository.deleteById(id);
        return true;
    }
}
