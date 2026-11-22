package com.proiect.is.proiect_is.controller;

import com.proiect.is.proiect_is.DTO.CalendarEventRequestDTO;
import com.proiect.is.proiect_is.DTO.CalendarEventResponseDTO;
import com.proiect.is.proiect_is.DTO.CalendarInviteRequestDTO;
import com.proiect.is.proiect_is.DTO.EventStatsDTO;
import com.proiect.is.proiect_is.mapper.CalendarEventMapper;
import com.proiect.is.proiect_is.model.CalendarEvent;
import com.proiect.is.proiect_is.service.CalendarEventService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Controller REST Enterprise pentru gestionarea operațiunilor de calendar, planificării
 * ședințelor de lucru, integrării cu Google Meet, exportului/importului iCalendar (.ics)
 * și statisticii evenimentelor din platforma Workspace IS.
 *
 * Expune atât endpoint-uri clasice Entity-based pentru compatibilitate directă cu componentele
 * existente din React, cât și endpoint-uri moderne validate DTO cu serializare optimizată.
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
@RestController
@RequestMapping("/api/calendar")
@CrossOrigin(origins = "*")
public class CalendarEventController {

    private final CalendarEventService calendarEventService;
    private final CalendarEventMapper calendarEventMapper;

    @Autowired
    public CalendarEventController(
            CalendarEventService calendarEventService,
            CalendarEventMapper calendarEventMapper) {
        this.calendarEventService = calendarEventService;
        this.calendarEventMapper = calendarEventMapper;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Endpoint-uri de Citire / Căutare Evenimente
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Returnează lista tuturor evenimentelor înregistrate în sistem.
     *
     * @return Lista completă de entități CalendarEvent
     */
    @GetMapping("/events")
    public List<CalendarEvent> getAllEvents() {
        return calendarEventService.getAllEvents();
    }

    /**
     * Caută și returnează un eveniment specific pe baza ID-ului său primar.
     *
     * @param id Identificatorul unic al evenimentului
     * @return 200 OK cu entitatea găsită sau 404 Not Found
     */
    @GetMapping("/events/{id}")
    public ResponseEntity<CalendarEvent> getEventById(@PathVariable Long id) {
        return calendarEventService.getEventById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Returnează evenimentele planificate de un anumit utilizator.
     *
     * @param userId ID-ul utilizatorului
     * @return Lista de evenimente asociate contului
     */
    @GetMapping("/user/{userId}")
    public List<CalendarEvent> getEventsByUser(@PathVariable Long userId) {
        return calendarEventService.getEventsByUser(userId);
    }

    /**
     * Returnează evenimentele asociate unui proiect specific.
     *
     * @param projectId ID-ul proiectului
     * @return Lista evenimentelor de proiect
     */
    @GetMapping("/project/{projectId}")
    public List<CalendarEvent> getEventsByProject(@PathVariable Long projectId) {
        return calendarEventService.getEventsByProject(projectId);
    }

    /**
     * Filtrează evenimentele unui proiect pentru o anumită zi.
     *
     * @param projectId ID-ul proiectului
     * @param date Data căutată în format YYYY-MM-DD
     * @return Lista evenimentelor din acea zi
     */
    @GetMapping("/project/{projectId}/date/{date}")
    public List<CalendarEvent> getProjectEventsByDate(@PathVariable Long projectId, @PathVariable String date) {
        return calendarEventService.getProjectEventsByDate(projectId, date);
    }

    /**
     * Returnează ședințele viitoare ce dispun de apel Google Meet activ.
     *
     * @param projectId ID proiect (opțional)
     * @param userId ID utilizator (opțional)
     * @return Lista ședințelor video viitoare
     */
    @GetMapping("/upcoming-meets")
    public List<CalendarEvent> getUpcomingMeetings(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long userId) {
        return calendarEventService.getUpcomingMeetings(projectId, userId);
    }

    /**
     * Returnează indicatorii statistici agregate pentru tabloul de bord (Dashboard / Analytics).
     *
     * @param userId ID utilizator (opțional)
     * @param projectId ID proiect (opțional)
     * @return 200 OK cu obiectul EventStatsDTO
     */
    @GetMapping("/stats")
    public ResponseEntity<EventStatsDTO> getEventStatistics(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long projectId) {
        EventStatsDTO stats = calendarEventService.getEventStatistics(userId, projectId);
        return ResponseEntity.ok(stats);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Endpoint-uri DTO Validate pentru Frontend Modern
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Returnează evenimentele unui utilizator formatate ca DTO îmbogățit cu proprietăți derivate.
     *
     * @param userId ID-ul utilizatorului
     * @return Lista de CalendarEventResponseDTO
     */
    @GetMapping("/events/dto/user/{userId}")
    public ResponseEntity<List<CalendarEventResponseDTO>> getEventsDTOByUser(@PathVariable Long userId) {
        List<CalendarEvent> events = calendarEventService.getEventsByUser(userId);
        return ResponseEntity.ok(calendarEventMapper.toResponseDTOList(events));
    }

    /**
     * Creează un nou eveniment folosind validarea strictă JSR-380 pe DTO.
     *
     * @param requestDTO Corpul cererii validat cu @Valid
     * @return 200 OK cu DTO-ul de răspuns îmbogățit
     */
    @PostMapping("/events/dto")
    public ResponseEntity<CalendarEventResponseDTO> createEventDTO(@Valid @RequestBody CalendarEventRequestDTO requestDTO) {
        CalendarEventResponseDTO created = calendarEventService.createEventFromDTO(requestDTO);
        return ResponseEntity.ok(created);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Endpoint-uri Clasice de Creare, Modificare și Ștergere Evenimente
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Creează un eveniment nou în calendar și expediază automat invitații pe email.
     * Păstrat pentru compatibilitate directă 1:1 cu componentele frontend existente.
     *
     * @param event Entitatea trimisă în format JSON
     * @return 200 OK cu evenimentul persistat sau 400 Bad Request
     */
    @PostMapping("/events")
    public ResponseEntity<CalendarEvent> createEvent(@RequestBody CalendarEvent event) {
        if (event.getTitle() == null || event.getTitle().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        CalendarEvent saved = calendarEventService.createEvent(event);
        return ResponseEntity.ok(saved);
    }

    /**
     * Actualizează atributele unui eveniment existent.
     *
     * @param id ID-ul evenimentului de modificat
     * @param updatedData Noile date
     * @return 200 OK cu evenimentul actualizat sau 404 Not Found
     */
    @PutMapping("/events/{id}")
    public ResponseEntity<CalendarEvent> updateEvent(@PathVariable Long id, @RequestBody CalendarEvent updatedData) {
        return calendarEventService.updateEvent(id, updatedData)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Șterge un eveniment din calendar pe baza identificatorului unic.
     *
     * @param id ID-ul evenimentului de șters
     * @return 204 No Content dacă ștergerea a reușit, sau 404 Not Found
     */
    @DeleteMapping("/events/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id) {
        boolean deleted = calendarEventService.deleteEvent(id);
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. Integrare Invitații Electronice & Quick Meet
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Endpoint dedicat pentru expedierea manuală sau retransmiterea invitațiilor pe email.
     *
     * @param payload Harta cu parametrii invitației
     * @return Rezultatul operațiunii de expediere SMTP
     */
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

        CalendarInviteRequestDTO req = CalendarInviteRequestDTO.builder()
                .eventTitle(eventTitle)
                .eventDate(eventDate)
                .startTime(startTime)
                .meetLink(meetLink)
                .senderName(senderName)
                .description(description)
                .toEmails(toEmails)
                .build();

        boolean sent = calendarEventService.sendMeetingInvitations(req);

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("sentViaSmtp", sent);
        resp.put("recipientsCount", toEmails.size());
        resp.put("message", sent ? "Invitații expediate cu succes via Gmail SMTP." : "Eroare autentificare SMTP Gmail (Google impune App Password).");
        return ResponseEntity.ok(resp);
    }

    /**
     * Generează instant o sesiune de ședință ad-hoc cu cod de cameră unic și link Google Meet.
     *
     * @param platform Platforma de comunicare (default: Google Meet)
     * @param title Titlul ședinței ad-hoc
     * @return Harta cu link-ul de acces rapid
     */
    @PostMapping("/quick-meet")
    public ResponseEntity<Map<String, Object>> generateQuickMeet(
            @RequestParam(required = false, defaultValue = "Google Meet") String platform,
            @RequestParam(required = false) String title) {
        Map<String, Object> response = calendarEventService.generateQuickMeet(platform, title);
        return ResponseEntity.ok(response);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. Export și Import Standard iCalendar (.ics RFC 5545)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Exportă toate evenimentele unui utilizator ca fișier standard .ics descărcabil.
     * Compatibil cu Google Calendar, Microsoft Outlook și Apple Calendar.
     *
     * @param userId ID-ul utilizatorului
     * @return Fișierul .ics descărcabil cu antete HTTP corespunzătoare
     */
    @GetMapping("/export/ics/user/{userId}")
    public ResponseEntity<byte[]> exportUserCalendarIcs(@PathVariable Long userId) {
        String icsContent = calendarEventService.exportUserEventsIcs(userId);
        byte[] bytes = icsContent.getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"workspace-calendar-user-" + userId + ".ics\"")
                .contentType(MediaType.parseMediaType("text/calendar; charset=utf-8"))
                .body(bytes);
    }

    /**
     * Exportă calendarul asociat unui proiect specific în format .ics.
     *
     * @param projectId ID-ul proiectului
     * @return Fișierul .ics atașat
     */
    @GetMapping("/export/ics/project/{projectId}")
    public ResponseEntity<byte[]> exportProjectCalendarIcs(@PathVariable Long projectId) {
        String icsContent = calendarEventService.exportProjectEventsIcs(projectId);
        byte[] bytes = icsContent.getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"workspace-calendar-project-" + projectId + ".ics\"")
                .contentType(MediaType.parseMediaType("text/calendar; charset=utf-8"))
                .body(bytes);
    }

    /**
     * Exportă un singur eveniment din calendar sub forma unei invitații .ics descărcabile.
     *
     * @param id ID-ul evenimentului
     * @return Fișierul .ics al evenimentului
     */
    @GetMapping("/export/ics/event/{id}")
    public ResponseEntity<byte[]> exportSingleEventIcs(@PathVariable Long id) {
        String icsContent = calendarEventService.exportSingleEventIcs(id);
        byte[] bytes = icsContent.getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"event-" + id + ".ics\"")
                .contentType(MediaType.parseMediaType("text/calendar; charset=utf-8"))
                .body(bytes);
    }

    /**
     * Importă evenimente dintr-un șir text format iCalendar (.ics).
     *
     * @param payload Harta conținând șirul icsData, userId și projectId opțional
     * @return Numărul de evenimente adăugate cu succes
     */
    @PostMapping("/import/ics")
    public ResponseEntity<Map<String, Object>> importCalendarIcs(@RequestBody Map<String, Object> payload) {
        String icsData = (String) payload.get("icsData");
        Object rawUserId = payload.get("userId");
        Object rawProjId = payload.get("projectId");

        Long userId = (rawUserId instanceof Number) ? ((Number) rawUserId).longValue() : 1L;
        Long projectId = (rawProjId instanceof Number) ? ((Number) rawProjId).longValue() : null;

        int importedCount = calendarEventService.importEventsFromIcs(icsData, userId, projectId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("importedCount", importedCount);
        response.put("message", "Au fost importate cu succes " + importedCount + " evenimente.");

        return ResponseEntity.ok(response);
    }
}
