package com.proiect.is.proiect_is.mapper;

import com.proiect.is.proiect_is.DTO.AppNotificationRequestDTO;
import com.proiect.is.proiect_is.DTO.AppNotificationResponseDTO;
import com.proiect.is.proiect_is.model.AppNotification;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Mapper component responsabil pentru conversia între modelul JPA {@link AppNotification}
 * și obiectele de transfer date {@link AppNotificationRequestDTO} și {@link AppNotificationResponseDTO}.
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
@Component
public class AppNotificationMapper {

    /**
     * Convertește un DTO de cerere într-o entitate AppNotification.
     *
     * @param dto Datele primite pentru creare
     * @return Entitatea JPA pregătită pentru persistență
     */
    public AppNotification toEntity(AppNotificationRequestDTO dto) {
        if (dto == null) {
            return null;
        }

        AppNotification notification = new AppNotification();
        notification.setRecipientUserId(dto.getRecipientUserId());
        notification.setSenderUserId(dto.getSenderUserId());
        notification.setSenderName(dto.getSenderName() != null ? dto.getSenderName() : "Sistem");
        notification.setTitle(dto.getTitle());
        notification.setMessage(dto.getMessage());
        notification.setType(dto.getType() != null ? dto.getType() : "general");
        notification.setMeetLink(dto.getLink());
        notification.setIsRead(false);
        notification.setCreatedAt(LocalDateTime.now());

        return notification;
    }

    /**
     * Convertește o entitate AppNotification într-un DTO de răspuns îmbogățit cu proprietăți derivate.
     *
     * @param entity Entitatea din baza de date
     * @return DTO-ul serializabil pentru frontend
     */
    public AppNotificationResponseDTO toResponseDTO(AppNotification entity) {
        if (entity == null) {
            return null;
        }

        AppNotificationResponseDTO dto = AppNotificationResponseDTO.builder()
                .id(entity.getId())
                .recipientUserId(entity.getRecipientUserId())
                .senderUserId(entity.getSenderUserId())
                .senderName(entity.getSenderName())
                .title(entity.getTitle())
                .message(entity.getMessage())
                .type(entity.getType())
                .link(entity.getMeetLink())
                .isRead(entity.getIsRead())
                .createdAt(entity.getCreatedAt())
                .build();

        dto.computeTimeAgo();
        return dto;
    }

    /**
     * Convertește o listă de entități de notificări în listă de DTO-uri.
     *
     * @param entities Lista de entități
     * @return Lista de DTO-uri corespunzătoare
     */
    public List<AppNotificationResponseDTO> toResponseDTOList(List<AppNotification> entities) {
        if (entities == null || entities.isEmpty()) {
            return Collections.emptyList();
        }
        return entities.stream()
                .map(this::toResponseDTO)
                .collect(Collectors.toList());
    }
}
