package com.proiect.is.proiect_is.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;

/**
 * Data Transfer Object (DTO) pentru solicitările de expediere a invitațiilor
 * electronice (email) către participanții unui eveniment de pe platformă.
 *
 * Include suport pentru transmiterea link-ului de Google Meet și generarea
 * automată a fișierului de invitație iCalendar atașat.
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
public class CalendarInviteRequestDTO {

    /**
     * ID-ul opțional al evenimentului existent în baza de date.
     */
    private Long eventId;

    /**
     * Titlul ședinței sau al evenimentului.
     */
    @NotBlank(message = "Titlul evenimentului este obligatoriu.")
    private String eventTitle;

    /**
     * Data planificată în format YYYY-MM-DD.
     */
    @NotBlank(message = "Data evenimentului este obligatorie.")
    private String eventDate;

    /**
     * Ora de start a ședinței (HH:mm).
     */
    private String startTime;

    /**
     * Link-ul direct pentru Google Meet.
     */
    private String meetLink;

    /**
     * Numele sau rolul persoanei care inițiază invitația.
     */
    private String senderName;

    /**
     * Descrierea sau agenda propusă pentru ședință.
     */
    private String description;

    /**
     * Lista adreselor de email către care se va expedia invitația.
     */
    @NotEmpty(message = "Lista destinatarilor nu poate fi goală.")
    private List<String> toEmails;

    /**
     * Opțiune pentru includerea fișierului .ics atașat (default: true).
     */
    @Builder.Default
    private Boolean attachIcsFile = true;
}
