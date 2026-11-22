package com.proiect.is.proiect_is.DTO;

import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Data Transfer Object (DTO) pentru serializarea și transmiterea detaliilor
 * unui eveniment către interfața client (React Frontend).
 *
 * Include câmpuri agregate și proprietăți calculate (ex: număr participanți,
 * interval orar formatat, status eveniment viitor) pentru a reduce complexitatea pe client.
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CalendarEventResponseDTO {

    /**
     * Identificatorul unic al evenimentului în baza de date.
     */
    private Long id;

    /**
     * Titlul evenimentului sau al ședinței.
     */
    private String title;

    /**
     * Descrierea detaliată sau agenda discuției.
     */
    private String description;

    /**
     * Data planificată pentru eveniment în format ISO (YYYY-MM-DD).
     */
    private String eventDate;

    /**
     * Ora de început a evenimentului (HH:mm).
     */
    private String startTime;

    /**
     * Ora de sfârșit estimată a evenimentului (HH:mm).
     */
    private String endTime;

    /**
     * Indicator pentru evenimente pe întreaga zi.
     */
    private Boolean allDay;

    /**
     * Categoria evenimentului (ex: "Sedinta", "Dezvoltare", "Milestone").
     */
    private String category;

    /**
     * Nivelul de prioritate asociat (ex: "low", "medium", "high", "urgent").
     */
    private String priority;

    /**
     * Regula de recurență configurată (ex: "none", "daily", "weekly").
     */
    private String recurrence;

    /**
     * Indicator dacă evenimentul conține un apel video Google Meet.
     */
    private Boolean hasVideoMeet;

    /**
     * Link-ul direct pentru accesul la conferința video.
     */
    private String meetLink;

    /**
     * Platforma asociată conferinței (default: "Google Meet").
     */
    private String meetPlatform;

    /**
     * Codul unic al camerei virtuale.
     */
    private String meetRoomCode;

    /**
     * Locația fizică sau link-ul conferinței.
     */
    private String location;

    /**
     * Lista adreselor de email sub formă de șir brut.
     */
    private String attendees;

    /**
     * Lista parsatǎ a adreselor de email ale participanților.
     */
    @Builder.Default
    private List<String> attendeeList = new ArrayList<>();

    /**
     * Numărul total de participanți invitați.
     */
    private Integer attendeesCount;

    /**
     * ID-ul proiectului din care face parte evenimentul.
     */
    private Long projectId;

    /**
     * ID-ul utilizatorului creator.
     */
    private Long userId;

    /**
     * Indicator de finalizare a evenimentului.
     */
    private Boolean completed;

    /**
     * Indicator dacă evenimentul a fost amânat.
     */
    private Boolean isDelayed;

    /**
     * Motivul amânării, dacă este cazul.
     */
    private String delayReason;

    /**
     * Data și ora creării înregistrării.
     */
    private LocalDateTime createdAt;

    /**
     * Șir formatat pentru intervalul orar (ex: "10:00 - 11:30" sau "Toată ziua").
     */
    private String formattedTimeInterval;

    /**
     * Indicator calculat dacă evenimentul urmează să aibă loc în viitor.
     */
    private Boolean isUpcoming;

    /**
     * Indicator dacă există un link Google Meet valid asociat.
     */
    private Boolean hasValidMeetLink;

    /**
     * Calculează proprietățile derivate pe baza valorilor curente din DTO.
     */
    public void computeDerivedFields() {
        // Parsare participanți
        if (this.attendees != null && !this.attendees.isBlank()) {
            this.attendeeList = Arrays.stream(this.attendees.split(","))
                    .map(String::trim)
                    .filter(e -> !e.isEmpty())
                    .toList();
            this.attendeesCount = this.attendeeList.size();
        } else {
            this.attendeeList = new ArrayList<>();
            this.attendeesCount = 0;
        }

        // Interval orar formatat
        if (Boolean.TRUE.equals(this.allDay)) {
            this.formattedTimeInterval = "Toată ziua";
        } else if (this.startTime != null && !this.startTime.isBlank()) {
            if (this.endTime != null && !this.endTime.isBlank()) {
                this.formattedTimeInterval = this.startTime + " - " + this.endTime;
            } else {
                this.formattedTimeInterval = this.startTime;
            }
        } else {
            this.formattedTimeInterval = "Fără oră specificată";
        }

        // Verificare eveniment viitor
        if (this.eventDate != null && !this.eventDate.isBlank()) {
            try {
                LocalDate eventLocalDate = LocalDate.parse(this.eventDate, DateTimeFormatter.ISO_LOCAL_DATE);
                LocalDate today = LocalDate.now();
                this.isUpcoming = !eventLocalDate.isBefore(today);
            } catch (Exception e) {
                this.isUpcoming = true;
            }
        } else {
            this.isUpcoming = false;
        }

        // Verificare link Meet valid
        this.hasValidMeetLink = (this.meetLink != null && this.meetLink.startsWith("http"));
    }
}
