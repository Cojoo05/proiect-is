package com.proiect.is.proiect_is.service;

import com.proiect.is.proiect_is.DTO.CalendarEventRequestDTO;
import com.proiect.is.proiect_is.DTO.CalendarEventResponseDTO;
import com.proiect.is.proiect_is.DTO.CalendarInviteRequestDTO;
import com.proiect.is.proiect_is.DTO.EventStatsDTO;
import com.proiect.is.proiect_is.exception.CalendarResourceNotFoundException;
import com.proiect.is.proiect_is.exception.CalendarValidationException;
import com.proiect.is.proiect_is.mapper.CalendarEventMapper;
import com.proiect.is.proiect_is.model.CalendarEvent;
import com.proiect.is.proiect_is.repository.CalendarEventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementarea serviciului de business {@link CalendarEventService}.
 *
 * Coordonează logica de persistență, validare a datelor, generare de camere
 * Google Meet, trimitere automată a invitațiilor via Gmail SMTP și export/import iCalendar.
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
@Service
@Transactional
public class CalendarEventServiceImpl implements CalendarEventService {

    private final CalendarEventRepository calendarEventRepository;
    private final EmailService emailService;
    private final IcsCalendarService icsCalendarService;
    private final CalendarEventMapper calendarEventMapper;

    @Autowired
    public CalendarEventServiceImpl(
            CalendarEventRepository calendarEventRepository,
            EmailService emailService,
            IcsCalendarService icsCalendarService,
            CalendarEventMapper calendarEventMapper) {
        this.calendarEventRepository = calendarEventRepository;
        this.emailService = emailService;
        this.icsCalendarService = icsCalendarService;
        this.calendarEventMapper = calendarEventMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<CalendarEvent> getAllEvents() {
        return calendarEventRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CalendarEvent> getEventById(Long id) {
        return calendarEventRepository.findById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CalendarEvent> getEventsByUser(Long userId) {
        if (userId == null) {
            return Collections.emptyList();
        }
        return calendarEventRepository.findByUserId(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CalendarEvent> getEventsByProject(Long projectId) {
        if (projectId == null) {
            return Collections.emptyList();
        }
        return calendarEventRepository.findByProjectId(projectId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CalendarEvent> getProjectEventsByDate(Long projectId, String date) {
        if (projectId == null || date == null) {
            return Collections.emptyList();
        }
        return calendarEventRepository.findByProjectIdAndEventDate(projectId, date);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CalendarEvent> getUpcomingMeetings(Long projectId, Long userId) {
        if (projectId != null || userId != null) {
            return calendarEventRepository.findUpcomingMeetings(projectId, userId);
        }
        return calendarEventRepository.findByHasVideoMeetTrue();
    }

    @Override
    public CalendarEvent createEvent(CalendarEvent event) {
        if (event == null) {
            throw new CalendarValidationException("Obiectul eveniment nu poate fi nul.");
        }
        if (event.getTitle() == null || event.getTitle().trim().isEmpty()) {
            throw new CalendarValidationException("Titlul evenimentului este obligatoriu.");
        }

        if (event.getCreatedAt() == null) {
            event.setCreatedAt(LocalDateTime.now());
        }

        // Generare automată cod cameră și link Google Meet dacă este activată opțiunea video
        if (Boolean.TRUE.equals(event.getHasVideoMeet())) {
            if (event.getMeetRoomCode() == null || event.getMeetRoomCode().trim().isEmpty()) {
                String code = "is-meet-" + UUID.randomUUID().toString().substring(0, 8);
                event.setMeetRoomCode(code);
            }
            if (event.getMeetLink() == null || event.getMeetLink().trim().isEmpty()) {
                event.setMeetLink("https://meet.google.com/new");
            }
            if (event.getMeetPlatform() == null || event.getMeetPlatform().isBlank()) {
                event.setMeetPlatform("Google Meet");
            }
        }

        CalendarEvent saved = calendarEventRepository.save(event);

        // Notificare pe email către participanții invitați
        dispatchEmailInvitationsIfPresent(saved);

        return saved;
    }

    @Override
    public CalendarEventResponseDTO createEventFromDTO(CalendarEventRequestDTO requestDTO) {
        if (requestDTO == null) {
            throw new CalendarValidationException("Datele evenimentului sunt obligatorii.");
        }
        CalendarEvent entity = calendarEventMapper.toEntity(requestDTO);
        CalendarEvent saved = createEvent(entity);
        return calendarEventMapper.toResponseDTO(saved);
    }

    @Override
    public Optional<CalendarEvent> updateEvent(Long id, CalendarEvent updatedData) {
        return calendarEventRepository.findById(id).map(existing -> {
            if (updatedData.getTitle() != null) existing.setTitle(updatedData.getTitle());
            if (updatedData.getDescription() != null) existing.setDescription(updatedData.getDescription());
            if (updatedData.getEventDate() != null) existing.setEventDate(updatedData.getEventDate());
            if (updatedData.getStartTime() != null) existing.setStartTime(updatedData.getStartTime());
            if (updatedData.getEndTime() != null) existing.setEndTime(updatedData.getEndTime());
            if (updatedData.getAllDay() != null) existing.setAllDay(updatedData.getAllDay());
            if (updatedData.getCategory() != null) existing.setCategory(updatedData.getCategory());
            if (updatedData.getPriority() != null) existing.setPriority(updatedData.getPriority());
            if (updatedData.getRecurrence() != null) existing.setRecurrence(updatedData.getRecurrence());
            if (updatedData.getHasVideoMeet() != null) existing.setHasVideoMeet(updatedData.getHasVideoMeet());
            if (updatedData.getMeetLink() != null) existing.setMeetLink(updatedData.getMeetLink());
            if (updatedData.getMeetPlatform() != null) existing.setMeetPlatform(updatedData.getMeetPlatform());
            if (updatedData.getMeetRoomCode() != null) existing.setMeetRoomCode(updatedData.getMeetRoomCode());
            if (updatedData.getLocation() != null) existing.setLocation(updatedData.getLocation());
            if (updatedData.getAttendees() != null) existing.setAttendees(updatedData.getAttendees());
            if (updatedData.getCompleted() != null) existing.setCompleted(updatedData.getCompleted());
            if (updatedData.getIsDelayed() != null) existing.setIsDelayed(updatedData.getIsDelayed());
            if (updatedData.getDelayReason() != null) existing.setDelayReason(updatedData.getDelayReason());

            return calendarEventRepository.save(existing);
        });
    }

    @Override
    public boolean deleteEvent(Long id) {
        if (!calendarEventRepository.existsById(id)) {
            return false;
        }
        calendarEventRepository.deleteById(id);
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public EventStatsDTO getEventStatistics(Long userId, Long projectId) {
        List<CalendarEvent> events;
        if (projectId != null) {
            events = calendarEventRepository.findByProjectId(projectId);
        } else if (userId != null) {
            events = calendarEventRepository.findByUserId(userId);
        } else {
            events = calendarEventRepository.findAll();
        }

        EventStatsDTO stats = new EventStatsDTO();
        stats.setTotalEvents(events.size());

        LocalDate today = LocalDate.now();
        long upcoming = 0;
        long completed = 0;
        long videoMeets = 0;
        long delayed = 0;

        Map<String, Long> byCategory = new HashMap<>();
        Map<String, Long> byPriority = new HashMap<>();

        for (CalendarEvent ev : events) {
            if (Boolean.TRUE.equals(ev.getCompleted())) {
                completed++;
            }
            if (Boolean.TRUE.equals(ev.getHasVideoMeet())) {
                videoMeets++;
            }
            if (Boolean.TRUE.equals(ev.getIsDelayed())) {
                delayed++;
            }

            // Calcul eveniment viitor
            if (ev.getEventDate() != null) {
                try {
                    LocalDate d = LocalDate.parse(ev.getEventDate());
                    if (!d.isBefore(today)) {
                        upcoming++;
                    }
                } catch (Exception ignored) {
                    upcoming++;
                }
            }

            // Grupări
            String cat = ev.getCategory() != null ? ev.getCategory() : "General";
            byCategory.put(cat, byCategory.getOrDefault(cat, 0L) + 1);

            String prio = ev.getPriority() != null ? ev.getPriority() : "medium";
            byPriority.put(prio, byPriority.getOrDefault(prio, 0L) + 1);
        }

        stats.setUpcomingEvents(upcoming);
        stats.setCompletedEvents(completed);
        stats.setVideoMeetingsCount(videoMeets);
        stats.setDelayedEventsCount(delayed);
        stats.setEventsByCategory(byCategory);
        stats.setEventsByPriority(byPriority);
        stats.calculateCompletionRate();

        return stats;
    }

    @Override
    @Transactional(readOnly = true)
    public String exportUserEventsIcs(Long userId) {
        List<CalendarEvent> events = getEventsByUser(userId);
        return icsCalendarService.generateIcsContent(events, "Calendar Utilizator");
    }

    @Override
    @Transactional(readOnly = true)
    public String exportProjectEventsIcs(Long projectId) {
        List<CalendarEvent> events = getEventsByProject(projectId);
        return icsCalendarService.generateIcsContent(events, "Calendar Proiect #" + projectId);
    }

    @Override
    @Transactional(readOnly = true)
    public String exportSingleEventIcs(Long eventId) {
        CalendarEvent event = calendarEventRepository.findById(eventId)
                .orElseThrow(() -> new CalendarResourceNotFoundException(eventId));
        return icsCalendarService.generateIcsContent(Collections.singletonList(event), event.getTitle());
    }

    @Override
    public int importEventsFromIcs(String icsContent, Long userId, Long projectId) {
        List<CalendarEvent> parsed = icsCalendarService.parseIcsContent(icsContent, userId, projectId);
        if (parsed.isEmpty()) {
            return 0;
        }
        List<CalendarEvent> saved = calendarEventRepository.saveAll(parsed);
        return saved.size();
    }

    @Override
    public boolean sendMeetingInvitations(CalendarInviteRequestDTO req) {
        if (req == null || req.getToEmails() == null || req.getToEmails().isEmpty()) {
            return false;
        }

        return emailService.sendMeetingInvitation(
                req.getToEmails(),
                req.getEventTitle(),
                req.getEventDate(),
                req.getStartTime(),
                req.getMeetLink(),
                req.getSenderName() != null ? req.getSenderName() : "Workspace Echipa",
                req.getDescription()
        );
    }

    @Override
    public Map<String, Object> generateQuickMeet(String platform, String title) {
        String roomCode = "is-quick-" + UUID.randomUUID().toString().substring(0, 8);
        String finalTitle = (title != null && !title.trim().isEmpty()) ? title : "Ședință Rapidă";
        String joinUrl = "https://meet.google.com/new";

        Map<String, Object> response = new HashMap<>();
        response.put("title", finalTitle);
        response.put("roomCode", roomCode);
        response.put("platform", "Google Meet");
        response.put("joinUrl", joinUrl);
        response.put("inAppUrl", joinUrl);
        response.put("createdAt", LocalDateTime.now().toString());

        return response;
    }

    private void dispatchEmailInvitationsIfPresent(CalendarEvent event) {
        if (event.getAttendees() != null && !event.getAttendees().isBlank()) {
            List<String> attendeeList = Arrays.stream(event.getAttendees().split(","))
                    .map(String::trim)
                    .filter(e -> e.contains("@"))
                    .collect(Collectors.toList());

            if (!attendeeList.isEmpty()) {
                try {
                    emailService.sendMeetingInvitation(
                            attendeeList,
                            event.getTitle(),
                            event.getEventDate(),
                            event.getStartTime(),
                            event.getMeetLink(),
                            "Echipa Proiect IS",
                            event.getDescription()
                    );
                } catch (Exception ignored) {}
            }
        }
    }
}
