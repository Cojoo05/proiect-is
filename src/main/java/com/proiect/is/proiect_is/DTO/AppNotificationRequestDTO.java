package com.proiect.is.proiect_is.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

/**
 * Data Transfer Object (DTO) pentru transmiterea și crearea unei notificări în sistem.
 *
 * Folosit pentru validarea cererilor venite de la client sau de la alte servicii interne
 * înainte de a fi persistate în tabela de notificări și distribuite prin WebSocket.
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
public class AppNotificationRequestDTO {

    /**
     * ID-ul utilizatorului destinatar al notificării.
     */
    @NotNull(message = "ID-ul utilizatorului destinatar este obligatoriu.")
    private Long recipientUserId;

    /**
     * ID-ul utilizatorului expeditor (dacă există o acțiune inițiată de un alt coleg).
     */
    private Long senderUserId;

    /**
     * Numele vizibil al expeditorului.
     */
    private String senderName;

    /**
     * Titlul scurt al notificării.
     */
    @NotBlank(message = "Titlul notificării este obligatoriu.")
    private String title;

    /**
     * Mesajul descriptiv complet al notificării.
     */
    private String message;

    /**
     * Tipul notificării (ex: "calendar", "sedinta", "sarcina", "sistem", "mesaj").
     */
    private String type;

    /**
     * Ruta sau link-ul intern către care navighează utilizatorul la apăsare.
     */
    private String link;

    /**
     * Date suplimentare în format JSON sau text liber (ex: ID-ul ședinței asociate).
     */
    private String metadata;
}
