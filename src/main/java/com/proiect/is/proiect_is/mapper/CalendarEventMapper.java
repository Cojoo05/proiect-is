package com.proiect.is.proiect_is.mapper;

import com.proiect.is.proiect_is.DTO.CalendarEventRequestDTO;
import com.proiect.is.proiect_is.DTO.CalendarEventResponseDTO;
import com.proiect.is.proiect_is.model.CalendarEvent;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Mapper component responsabil pentru conversia bidirecțională între
 * entitatea JPA {@link CalendarEvent} și obiectele DTO {@link CalendarEventRequestDTO}
 * respectiv {@link CalendarEventResponseDTO}.
 *
 * Implementează logica de izolare a structurii bazei de date de interfața REST API.
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
@Component
public class CalendarEventMapper {

    /**
     * Convertește un obiect de tip DTO de cerere într-o entitate CalendarEvent.
     *
     * @param dto Obiectul cu datele primite de la client
     * @return Entitatea JPA pregătită pentru persistență
     */
    public CalendarEvent toEntity(CalendarEventRequestDTO dto) {
        if (dto == null) {
            return null;
        }

        CalendarEvent event = new CalendarEvent();
        event.setTitle(dto.getTitle());
        event.setDescription(dto.getDescription());
        event.setEventDate(dto.getEventDate());
        event.setStartTime(dto.getStartTime());
        event.setEndTime(dto.getEndTime());
        event.setAllDay(dto.getAllDay() != null ? dto.getAllDay() : false);
        event.setCategory(dto.getCategory() != null ? dto.getCategory() : "General");
        event.setPriority(dto.getPriority() != null ? dto.getPriority() : "medium");
        event.setRecurrence(dto.getRecurrence() != null ? dto.getRecurrence() : "none");
        event.setHasVideoMeet(dto.getHasVideoMeet() != null ? dto.getHasVideoMeet() : false);
        event.setMeetLink(dto.getMeetLink());
        event.setMeetPlatform(dto.getMeetPlatform() != null ? dto.getMeetPlatform() : "Google Meet");
        event.setMeetRoomCode(dto.getMeetRoomCode());
        event.setLocation(dto.getLocation());
        event.setAttendees(dto.getAttendees());
        event.setProjectId(dto.getProjectId());
        event.setUserId(dto.getUserId());
        event.setCompleted(dto.getCompleted() != null ? dto.getCompleted() : false);
        event.setIsDelayed(dto.getIsDelayed() != null ? dto.getIsDelayed() : false);
        event.setDelayReason(dto.getDelayReason());
        event.setCreatedAt(dto.getCreatedAt() != null ? dto.getCreatedAt() : LocalDateTime.now());

        return event;
    }

    /**
     * Convertește o entitate JPA CalendarEvent într-un DTO de răspuns complet.
     *
     * @param entity Entitatea citită din baza de date
     * @return DTO-ul îmbogățit cu proprietăți derivate pentru frontend
     */
    public CalendarEventResponseDTO toResponseDTO(CalendarEvent entity) {
        if (entity == null) {
            return null;
        }

        CalendarEventResponseDTO dto = CalendarEventResponseDTO.builder()
                .id(entity.getId())
                .title(entity.getTitle())
                .description(entity.getDescription())
                .eventDate(entity.getEventDate())
                .startTime(entity.getStartTime())
                .endTime(entity.getEndTime())
                .allDay(entity.getAllDay())
                .category(entity.getCategory())
                .priority(entity.getPriority())
                .recurrence(entity.getRecurrence())
                .hasVideoMeet(entity.getHasVideoMeet())
                .meetLink(entity.getMeetLink())
                .meetPlatform(entity.getMeetPlatform())
                .meetRoomCode(entity.getMeetRoomCode())
                .location(entity.getLocation())
                .attendees(entity.getAttendees())
                .projectId(entity.getProjectId())
                .userId(entity.getUserId())
                .completed(entity.getCompleted())
                .isDelayed(entity.getIsDelayed())
                .delayReason(entity.getDelayReason())
                .createdAt(entity.getCreatedAt())
                .build();

        dto.computeDerivedFields();
        return dto;
    }

    /**
     * Convertește o listă de entități într-o listă de DTO-uri de răspuns.
     *
     * @param entities Lista de entități
     * @return Lista de DTO-uri corespunzătoare
     */
    public List<CalendarEventResponseDTO> toResponseDTOList(List<CalendarEvent> entities) {
        if (entities == null || entities.isEmpty()) {
            return Collections.emptyList();
        }
        return entities.stream()
                .map(this::toResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Aplică actualizările din DTO asupra unei entități existente.
     *
     * @param target Entitatea existentă care va fi actualizată
     * @param source DTO-ul cu noile modificări
     */
    public void updateEntityFromDTO(CalendarEvent target, CalendarEventRequestDTO source) {
        if (target == null || source == null) {
            return;
        }

        if (source.getTitle() != null) target.setTitle(source.getTitle());
        if (source.getDescription() != null) target.setDescription(source.getDescription());
        if (source.getEventDate() != null) target.setEventDate(source.getEventDate());
        if (source.getStartTime() != null) target.setStartTime(source.getStartTime());
        if (source.getEndTime() != null) target.setEndTime(source.getEndTime());
        if (source.getAllDay() != null) target.setAllDay(source.getAllDay());
        if (source.getCategory() != null) target.setCategory(source.getCategory());
        if (source.getPriority() != null) target.setPriority(source.getPriority());
        if (source.getRecurrence() != null) target.setRecurrence(source.getRecurrence());
        if (source.getHasVideoMeet() != null) target.setHasVideoMeet(source.getHasVideoMeet());
        if (source.getMeetLink() != null) target.setMeetLink(source.getMeetLink());
        if (source.getMeetPlatform() != null) target.setMeetPlatform(source.getMeetPlatform());
        if (source.getMeetRoomCode() != null) target.setMeetRoomCode(source.getMeetRoomCode());
        if (source.getLocation() != null) target.setLocation(source.getLocation());
        if (source.getAttendees() != null) target.setAttendees(source.getAttendees());
        if (source.getProjectId() != null) target.setProjectId(source.getProjectId());
        if (source.getCompleted() != null) target.setCompleted(source.getCompleted());
        if (source.getIsDelayed() != null) target.setIsDelayed(source.getIsDelayed());
        if (source.getDelayReason() != null) target.setDelayReason(source.getDelayReason());
    }
}
