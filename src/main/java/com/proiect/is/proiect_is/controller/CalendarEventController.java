package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.CalendarEvent;
import com.proiect.is.proiect_is.repository.CalendarEventRepository;
import com.proiect.is.proiect_is.service.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/calendar")
@CrossOrigin(origins = "*")
public class CalendarEventController {

    @Autowired
    private CalendarEventRepository calendarEventRepository;

    @Autowired
    private EmailService emailService;

    @GetMapping("/events")
    public List<CalendarEvent> getAllEvents() {
        return calendarEventRepository.findAll();
    }

    @GetMapping("/events/{id}")
    public ResponseEntity<CalendarEvent> getEventById(@PathVariable Long id) {
        return calendarEventRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/user/{userId}")
    public List<CalendarEvent> getEventsByUser(@PathVariable Long userId) {
        return calendarEventRepository.findByUserId(userId);
    }

    @GetMapping("/project/{projectId}")
    public List<CalendarEvent> getEventsByProject(@PathVariable Long projectId) {
        return calendarEventRepository.findByProjectId(projectId);
    }

    @GetMapping("/project/{projectId}/date/{date}")
    public List<CalendarEvent> getProjectEventsByDate(@PathVariable Long projectId, @PathVariable String date) {
        return calendarEventRepository.findByProjectIdAndEventDate(projectId, date);
    }

    @GetMapping("/upcoming-meets")
    public List<CalendarEvent> getUpcomingMeetings(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long userId) {
        if (projectId != null || userId != null) {
            return calendarEventRepository.findUpcomingMeetings(projectId, userId);
        }
        return calendarEventRepository.findByHasVideoMeetTrue();
    }

    @PostMapping("/events")
    public ResponseEntity<CalendarEvent> createEvent(@RequestBody CalendarEvent event) {
        if (event.getTitle() == null || event.getTitle().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        if (event.getCreatedAt() == null) {
            event.setCreatedAt(LocalDateTime.now());
        }

        // Generare automată cod cameră și link Google Meet dacă e bifat
        if (Boolean.TRUE.equals(event.getHasVideoMeet())) {
            if (event.getMeetRoomCode() == null || event.getMeetRoomCode().trim().isEmpty()) {
                String code = "is-meet-" + UUID.randomUUID().toString().substring(0, 8);
                event.setMeetRoomCode(code);
            }
            if (event.getMeetLink() == null || event.getMeetLink().trim().isEmpty()) {
                event.setMeetLink("https://meet.google.com/new");
            }
        }

        CalendarEvent saved = calendarEventRepository.save(event);

        // Dacă evenimentul are invitați (email-uri), trimitem automat invitațiile pe email
        if (event.getAttendees() != null && !event.getAttendees().isBlank()) {
            List<String> attendeeList = Arrays.stream(event.getAttendees().split(","))
                    .map(String::trim)
                    .filter(e -> e.contains("@"))
                    .toList();

            if (!attendeeList.isEmpty()) {
                try {
                    emailService.sendMeetingInvitation(
                            attendeeList,
                            saved.getTitle(),
                            saved.getEventDate(),
                            saved.getStartTime(),
                            saved.getMeetLink(),
                            "Echipa Proiect IS",
                            saved.getDescription()
                    );
                } catch (Exception ignored) {}
            }
        }

        return ResponseEntity.ok(saved);
    }

    @PostMapping("/send-invite-email")
    public ResponseEntity<Map<String, Object>> sendInviteEmail(@RequestBody Map<String, Object> payload) {
        String eventTitle = (String) payload.get("eventTitle");
        String eventDate = (String) payload.get("eventDate");
        String startTime = (String) payload.get("startTime");
        String meetLink = (String) payload.get("meetLink");
        String senderName = (String) payload.get("senderName");
        String description = (String) payload.get("description");

        @SuppressWarnings("unchecked")
        List<String> toEmails = payload.get("toEmails") instanceof List
                ? (List<String>) payload.get("toEmails")
                : Collections.emptyList();

        boolean sent = emailService.sendMeetingInvitation(
                toEmails, eventTitle, eventDate, startTime, meetLink, senderName, description
        );

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("sentViaSmtp", sent);
        resp.put("recipientsCount", toEmails.size());
        resp.put("message", sent ? "Invitații expediate cu succes via Gmail." : "Eroare autentificare SMTP Gmail (Google impune App Password).");
        return ResponseEntity.ok(resp);
    }

    @PutMapping("/events/{id}")
    public ResponseEntity<CalendarEvent> updateEvent(@PathVariable Long id, @RequestBody CalendarEvent updatedData) {
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

            CalendarEvent saved = calendarEventRepository.save(existing);
            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/events/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id) {
        if (!calendarEventRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        calendarEventRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/quick-meet")
    public ResponseEntity<Map<String, Object>> generateQuickMeet(
            @RequestParam(required = false, defaultValue = "Google Meet") String platform,
            @RequestParam(required = false) String title) {

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

        return ResponseEntity.ok(response);
    }
}
