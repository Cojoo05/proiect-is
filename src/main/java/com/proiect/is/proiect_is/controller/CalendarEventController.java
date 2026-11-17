package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.model.CalendarEvent;
import com.proiect.is.proiect_is.repository.CalendarEventRepository;
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

        // Automatic video meeting link generator if flagged but no link provided
        if (Boolean.TRUE.equals(event.getHasVideoMeet())) {
            if (event.getMeetRoomCode() == null || event.getMeetRoomCode().trim().isEmpty()) {
                String code = "is-room-" + UUID.randomUUID().toString().substring(0, 8);
                event.setMeetRoomCode(code);
            }
            if (event.getMeetLink() == null || event.getMeetLink().trim().isEmpty()) {
                if ("Google Meet".equalsIgnoreCase(event.getMeetPlatform())) {
                    event.setMeetLink("https://meet.google.com/new");
                } else {
                    event.setMeetLink("https://meet.jit.si/" + event.getMeetRoomCode());
                }
            }
        }

        CalendarEvent saved = calendarEventRepository.save(event);
        return ResponseEntity.ok(saved);
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
        String joinUrl;

        if ("Google Meet".equalsIgnoreCase(platform)) {
            joinUrl = "https://meet.google.com/new";
        } else {
            joinUrl = "https://meet.jit.si/" + roomCode;
        }

        Map<String, Object> response = new HashMap<>();
        response.put("title", finalTitle);
        response.put("roomCode", roomCode);
        response.put("platform", platform);
        response.put("joinUrl", joinUrl);
        response.put("inAppUrl", "https://meet.jit.si/" + roomCode);
        response.put("createdAt", LocalDateTime.now().toString());

        return ResponseEntity.ok(response);
    }
}
