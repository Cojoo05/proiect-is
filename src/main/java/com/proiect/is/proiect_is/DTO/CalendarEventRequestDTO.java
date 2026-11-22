package com.proiect.is.proiect_is.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Data Transfer Object (DTO) pentru primirea și validarea cererilor de creare
 * sau actualizare a unui eveniment în cadrul modulului Calendar.
 *
 * Include adnotări de validare Jakarta Validation (JSR-380) pentru asigurarea
 * integrității datelor înainte de persistarea în baza de date.
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
public class CalendarEventRequestDTO {

    /**
     * Titlul evenimentului sau al ședinței.
     * Câmp obligatoriu, nu poate fi gol și are o lungime maximă de 255 caractere.
     */
    @NotBlank(message = "Titlul evenimentului este obligatoriu.")
    @Size(max = 255, message = "Titlul nu poate depăși 255 de caractere.")
    private String title;

    /**
     * Descrierea detaliată sau agenda de discuție a evenimentului.
     */
    @Size(max = 2000, message = "Descrierea nu poate depăși 2000 de caractere.")
    private String description;

    /**
     * Data planificată pentru eveniment în format ISO (YYYY-MM-DD).
     */
    @NotBlank(message = "Data evenimentului este obligatorie.")
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
     * Indicator pentru evenimente care durează întreaga zi.
     */
    private Boolean allDay;

    /**
     * Categoria evenimentului (ex: "Sedinta", "Dezvoltare", "Review", "Milestone", "General").
     */
    private String category;

    /**
     * Nivelul de prioritate asociat (ex: "low", "medium", "high", "urgent").
     */
    private String priority;

    /**
     * Regula de recurență a evenimentului (ex: "none", "daily", "weekly", "monthly").
     */
    private String recurrence;

    /**
     * Indicator dacă evenimentul conține o sesiune video Google Meet.
     */
    private Boolean hasVideoMeet;

    /**
     * Link-ul direct pentru accesul la apelul video (ex: https://meet.google.com/xyz).
     */
    private String meetLink;

    /**
     * Platforma asociată conferinței (default: "Google Meet").
     */
    private String meetPlatform;

    /**
     * Codul unic al camerei de conferință (ex: is-meet-9a3b8c).
     */
    private String meetRoomCode;

    /**
     * Locația fizică sau virtuală a evenimentului.
     */
    private String location;

    /**
     * Lista adreselor de email ale participanților invitați, separate prin virgulă.
     */
    private String attendees;

    /**
     * ID-ul proiectului asociat (opțional, dacă evenimentul aparține unui proiect).
     */
    private Long projectId;

    /**
     * ID-ul utilizatorului care a creat sau deține evenimentul.
     */
    private Long userId;

    /**
     * Indicator de finalizare cu succes a evenimentului.
     */
    private Boolean completed;

    /**
     * Indicator dacă evenimentul sau termenul limită a suferit o amânare.
     */
    private Boolean isDelayed;

    /**
     * Motivul amânării evenimentului, completat în cazul întârzierilor.
     */
    private String delayReason;

    /**
     * Timestamp de creare a înregistrării.
     */
    private LocalDateTime createdAt;
}
